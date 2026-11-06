// Marks on the skin and things through it: war paint, scars, ear hoops, the nose ring. Tusk bands
// and caps are drawn with the tusks (face.ts), which know their shape.
//
// Paint and scars sit on the skin under the eyes, brows, nose, mouth and tusks, so each shape is
// drawn a little past what shows and the features cover the rest. Nothing may cross the head's
// outline: shapes measure the head with `edge` (the outline's half-width at a given y) and keep
// INSET inside it on every head. Marks that would hide behind a tusk steer round it (`tusksOn`).
// Marks on the cheek also keep a strip of skin from the eye (`eyeGap`) and the mouth's corners
// (`cornerGap`), and paint under the mouth from its lower edge (`mouthGap`): joined to either, paint
// reads as blood running from it, and a cut as part of it. The cheek's scars and the paint keep
// clear of a mustache that reaches the cheek or hangs past the mouth (`mustacheGap`), which is
// drawn over them. Paint that finds no room draws nothing (`paintShows`).

import { MOUTH_PROPS } from './body'
import { lowerLip, mouthCorner, tuskSpans } from './face'
import { HAT_INFO } from './hats'
import { earEdge, ears, headHalfWidth } from './heads'
import { METAL_HEX, PAINT_HEX, clashes, paletteFor } from './palette'
import { O, W, X, both, circle, d, flat, g, mix, n, outlined, path } from './svg'
import type { Row } from './svg'
import type {
  Anchors, Build, Ctx, EyewearName, Look, MetalName, MouthName, MustacheName, PaintColour, PaintName, ScarName,
  Side,
} from './types'

export const PAINT_ROWS: readonly Row<PaintName>[] = [
  ['none', 90, 40],
  ['eye-band', 0, 14],
  ['claws', 0, 12],
  ['jaw-bars', 0, 10],
  ['chin-stripes', 0, 8],
  ['chevron', 0, 10],
  ['skull', 0, 6],
  ['mud', 10, 0],
]

export const SCAR_ROWS: readonly Row<ScarName>[] = [
  ['none', 86, 55],
  ['eye-slash', 3, 18],
  ['cheek-x', 4, 10],
  ['stitches', 4, 8],
  ['split-lip', 3, 9],
]

/** Hoops per ear from a 0..99 draw: the cumulative cut-offs for 0, 1 and 2 hoops (else 3). */
const HOOP_CUTS: Record<Build, readonly [number, number, number]> = {
  peon: [65, 88, 96],
  grunt: [45, 75, 92],
}

export function hoopCount(build: Build, u: number): number {
  const [none, one, two] = HOOP_CUTS[build]
  return u < none ? 0 : u < one ? 1 : u < two ? 2 : 3
}

/** Percent chances, by build. */
export const NOSE_RING_CHANCE: Record<Build, number> = { peon: 6, grunt: 14 }
export const TUSK_BAND_CHANCE: Record<Build, number> = { peon: 0, grunt: 12 }
export const TUSK_CAP_CHANCE: Record<Build, number> = { peon: 3, grunt: 6 }

// The head's edge ----------------------------------------------------------------------------------

type Pt = readonly [number, number]

/** How far inside the head outline's centre line every mark stays (the outline itself is 1.75). */
const INSET = 2.5

/** The outline's half-width at a given y, 0 above the crown or below the chin. */
type Edge = (y: number) => number

/** Measures the head by its own outline (heads.ts), so marks follow every head shape and its jitter. */
function edgeOf({ look, a }: Ctx): Edge {
  return y => headHalfWidth(look, a, y)
}

/**
 * The furthest a mark may reach from the centre line at y while staying INSET from the outline in
 * every direction, not just sideways: where the outline runs nearly flat (the dome's shoulders, the
 * jaw curving in) the nearest point of it is above or below.
 */
function room(edge: Edge, y: number): number {
  let most = Infinity
  for (let dy = -INSET; dy <= INSET; dy += INSET / 4) {
    most = Math.min(most, edge(y + dy) - Math.sqrt(INSET * INSET - dy * dy))
  }
  return most
}

/** Line commands down (or up) the head's inset edge on `side`, from y0 to y1: for wide masks. */
function along(edge: Edge, side: Side, y0: number, y1: number): string {
  const steps = Math.max(1, Math.ceil(Math.abs(y1 - y0) / 1.5))
  let out = ''
  for (let i = 0; i <= steps; i++) {
    const y = y0 + ((y1 - y0) * i) / steps
    out += d`L${X(side, room(edge, y))} ${y} `
  }
  return out
}

// The tusks ----------------------------------------------------------------------------------------

/** A tusk as a straight stand-in from base to tip, in (distance from the centre line, y). */
interface Stand {
  base: Pt
  tip: Pt
  /** Half-width at the base; it narrows towards the tip. */
  w: number
}

/**
 * The tusks on `side` (face.ts `tuskSpans`). The straight line from base to tip runs outside a
 * tusk's own curve, which leans out only near the tip, so steering round it is on the safe side.
 */
function tusksOn(ctx: Ctx, side: Side): Stand[] {
  return tuskSpans(ctx)
    .filter(t => t.side === side)
    .map(t => ({ base: [Math.abs(t.x - 50), t.base], tip: [Math.abs(t.tipX - 50), t.tipY], w: t.halfWidth }))
}

/** How far `at` (distance, y) is from the nearest tusk's outline, outline stroke included. */
function tuskGap(stands: readonly Stand[], at: Pt): number {
  let gap = Infinity
  for (const { base, tip, w } of stands) {
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      const x = base[0] + (tip[0] - base[0]) * t
      const y = base[1] + (tip[1] - base[1]) * t
      const half = Math.max(1, w * Math.pow(1 - t, 0.6)) + W.feature / 2
      gap = Math.min(gap, Math.hypot(at[0] - x, at[1] - y) - half)
    }
  }
  return gap
}

// The eyes and the mouth ---------------------------------------------------------------------------

/** How far below the eye line E the eyes reach: the wide eye's rim, the happy eye's cheek crease. */
const EYE_FOOT = 6.6
/** How far out from the eye's centre its socket shadow reaches (face.ts), on the eye line. */
const EYE_REACH = 7.4

/**
 * How far below E each eyewear reaches over the side +1 and side −1 eye, outline included
 * (eyewear.ts): rims, lenses and the patch's leather hang lower than the eye. Paint that starts
 * just below the eye would run out from under them, as tears of blood. Brow-goggles sit up on the
 * forehead.
 */
const RIM_FOOT: Record<EyewearName, readonly [plus: number, minus: number]> = {
  none: [0, 0],
  monocle: [8.8, 0],
  'pince-nez': [7.8, 7.8],
  spectacles: [8.8, 8.8],
  goggles: [9.8, 9.8],
  'brow-goggles': [0, 0],
  eyepatch: [8.1, 0],
  'patch-monocle': [8.1, 8.8],
  shades: [8.9, 8.9],
}

/** How far below E paint must start to keep a strip of skin under the eye on `side`, or its rim. */
function eyeFoot({ look }: Ctx, side: Side): number {
  const [plus, minus] = RIM_FOOT[look.eyewear]
  return Math.max(EYE_FOOT, (side === 1 ? plus : minus) + 1)
}

/**
 * How far `at` (distance from the centre line, y) is from the eye on its side, measured from an
 * ellipse round the eye and its socket. Approximate, but on the safe side below the eye.
 */
function eyeGap({ a }: Ctx, at: Pt): number {
  return Math.hypot((at[0] - a.ED) * (EYE_FOOT / EYE_REACH), at[1] - a.E) - EYE_FOOT
}

/**
 * How far below the mouth line M each mouth reaches near the centre line, outline included (face.ts):
 * the lip's line for closed mouths (their soft shadow may reach lower), else the dropped jaw or a
 * tongue hanging out. Paint under the mouth starts a strip of skin below it.
 */
const MOUTH_FOOT: Record<MouthName, number> = {
  grim: 2, frown: 2.5, smirk: 2, wavy: 2, snarl: 3.5, roar: 10.7, grin: 8.1, gape: 11.6, tongue: 8.5, ooh: 7.1,
}

/** How far `at` (distance, y) is from the mouth's corner on `side`, outside the lip's line. */
function cornerGap(ctx: Ctx, side: Side, at: Pt): number {
  const [x, y] = mouthCorner(ctx, side)
  // Closed mouths are drawn at the brow's weight (face.ts).
  return Math.hypot(at[0] - Math.abs(x - 50), at[1] - y) - W.brow / 2
}

/** The strip of bare skin kept between the mouth and paint under it. */
const MOUTH_GAP = 3

/**
 * How far `at` (distance, y) is from the mouth on `side`: under it, from its lower edge, taken as
 * curving from the corner down to MOUTH_FOOT on the centre line (on the safe side of every mouth's
 * own curve, the gape's off-centre tongue included); out past the corner, from the corner.
 */
function mouthGap(ctx: Ctx, side: Side, at: Pt): number {
  const { a, look } = ctx
  const [cx, cy] = mouthCorner(ctx, side)
  const corner = Math.abs(cx - 50)
  const foot = a.M + MOUTH_FOOT[look.mouth]
  const below = at[0] < corner ? at[1] - (cy + (foot - cy) * Math.sqrt(1 - (at[0] / corner) ** 2)) : Infinity
  return Math.min(below, cornerGap(ctx, side, at))
}

/**
 * Where each mustache that reaches the cheek lies, as a polygon of (distance from the centre line,
 * y), its outline included: from the centre line out past the mouth's corner. The handlebar's bow,
 * then its hooked curl and wing; the curly's lip piece and the hook curling off its end; the
 * imperial's band and waxed horn; the walrus's and chevron's lobes, whose tops slope down outward
 * to their drooping ends. Then the ones that hang past the mouth to the jaw, whose ends sit by the
 * chin (J): the horseshoe's lobes and the arm hanging outside the tusks, the drooper's lip bar and
 * the strand splayed out from behind them, the braids' lip piece and plait. Measured from hair.ts on
 * both sides over every head, nose, jaw, tusk and eyewear, and pale or dark hair, which move a top,
 * shrink or shift the curls and set where the arms hang: change them together. They're drawn over
 * the paint and scars: a cut under one showed only its ends, and claw rakes or bars run under one
 * poked out round it as fangs, a tuft, extra fringe or blood running down it.
 */
const FOOTPRINTS: Partial<Record<MustacheName, (a: Anchors) => readonly Pt[]>> = {
  handlebar: a => [
    [0, a.N + 1.5], [a.MW + 2.5, a.N + 1.5], [a.MW + 3.2, a.N - 2.5], [a.MW + 5, a.N - 4.5], [a.MW + 8.5, a.N - 4.5],
    [a.MW + 10.5, a.N - 2.3], [a.MW + 11.2, a.N - 0.6], [a.MW + 11.2, a.M - 4.2], [a.MW + 10, a.M - 1.6],
    [a.MW + 8.5, a.M + 0.6], [a.MW + 7, a.M + 2.5], [0, a.M + 2.5],
  ],
  curly: a => [
    [0, a.N + 1.5], [a.MW - 2.6, a.N + 1.5], [a.MW - 1.7, a.N + 0.3], [a.MW, a.N - 1], [a.MW + 2, a.N - 4],
    [a.MW + 6.6, a.N - 5.9], [a.MW + 9.4, a.N - 5.3], [a.MW + 11.3, a.N - 3.4], [a.MW + 12.9, a.N + 2.1],
    [a.MW + 11.8, a.N + 5.8], [a.MW + 8.6, a.N + 8.6], [a.MW + 3.8, a.N + 9.2], [a.MW + 1, a.N + 9.5],
    [a.MW - 1, a.M + 0.2], [a.MW - 3.5, a.M + 1.4], [0, a.M + 1.4],
  ],
  imperial: a => [
    [0, a.M - 6.1], [a.MW + 4, a.M - 6.4], [a.MW + 5, a.M - 7.4], [a.MW + 6, a.M - 9], [a.MW + 7, a.N + 1],
    [a.MW + 8, a.N - 1.9], [a.MW + 9, a.N - 3], [a.MW + 10.8, a.N - 3], [a.MW + 10.8, a.M - 5], [a.MW + 9, a.M - 3.2],
    [a.MW + 7, a.M - 1.4], [a.MW + 4, a.M + 0.1], [a.MW + 1, a.M + 1.4], [0, a.M + 1.4],
  ],
  walrus: a => [
    [0, a.N + 2.8], [a.MW - 4, a.N + 2.8], [a.MW - 2, a.N + 3.1], [a.MW, a.N + 3.9], [a.MW + 2, a.N + 5.2],
    [a.MW + 4, a.N + 6.4], [a.MW + 5, a.N + 7.1], [a.MW + 6.2, a.N + 8.6], [a.MW + 6.2, a.M + 1.5],
    [a.MW + 5.5, a.M + 3.3], [a.MW + 4.5, a.M + 7], [a.MW + 3.5, a.M + 8], [a.MW - 3, a.M + 7.4], [4.5, a.M + 6.7],
    [1.5, a.M + 5.2], [0, a.M + 3.6],
  ],
  chevron: a => [
    [0, a.M - 10.6], [a.MW - 8, a.M - 10.6], [a.MW - 4, a.M - 8.1], [a.MW, a.M - 6.1], [a.MW + 2, a.M - 4.7],
    [a.MW + 4, a.M - 2.9], [a.MW + 5.2, a.M - 1.6], [a.MW + 5.2, a.M + 0.7], [a.MW + 3, a.M + 4.9],
    [a.MW + 1, a.M + 4.9], [a.MW - 4, a.M + 4.3], [4, a.M + 3.6], [2.2, a.M + 3.1], [0, a.M + 1.2],
  ],
  horseshoe: a => [
    [0, a.N + 0.4], [a.MW + 5.5, a.N + 0.4], [a.MW + 9.3, a.N + 1.7], [a.MW + 10.5, a.N + 3.6],
    [a.MW + 12.8, a.N + 8.5], [a.MW + 14.4, a.N + 12], [a.MW + 14.4, a.J - 10.5], [a.MW + 11.7, a.J - 7],
    [a.MW + 8.2, a.J - 3.8], [a.MW + 5.1, a.J - 3.2], [a.MW + 2.1, a.J - 6.2], [a.MW + 1.8, a.M - 1.8], [0, a.M - 1],
  ],
  drooper: a => [
    [0, a.N + 1.7], [a.MW - 9, a.N + 1.7], [a.MW - 1.8, a.N + 2.1], [a.MW + 1.8, a.N + 4.3],
    [a.MW + 6.6, a.N + 10.6], [a.MW + 7.9, a.N + 13], [a.MW + 8.9, a.J - 11.7], [a.MW + 8.9, a.J - 5.9],
    [a.MW + 7.8, a.J - 3], [a.MW + 6.8, a.J - 2.2], [a.MW + 3, a.J - 0.8], [a.MW + 1.4, a.J - 1.7],
    [a.MW - 0.2, a.J - 4.9], [a.MW - 3.2, a.J - 16], [a.MW - 4.4, a.N + 8.4], [0, a.N + 7.9],
  ],
  braids: a => [
    [0, a.N + 0.9], [a.MW + 1.5, a.N + 0.9], [a.MW + 4.9, a.N + 3.9], [a.MW + 6.5, a.N + 8.2], [a.MW + 7.7, a.N + 12],
    [a.MW + 9.5, a.J - 13.2], [a.MW + 10, a.J - 4.5], [a.MW + 9.2, a.J - 3.6], [a.MW + 5.2, a.J - 2.5],
    [a.MW + 0.9, a.J - 2.2], [a.MW - 0.8, a.J - 4.2], [a.MW - 0.8, a.M + 9.8], [a.MW - 4, a.M + 8.9],
    [a.MW - 4, a.M + 0.9], [0, a.M + 0.9],
  ],
}

/** How far `at` is from a straight line between two points (a straight cut, a polygon's side). */
function segmentGap(at: Pt, [p, q]: readonly Pt[]): number {
  if (p === undefined || q === undefined) return Infinity
  const [dx, dy] = [q[0] - p[0], q[1] - p[1]]
  const t = Math.max(0, Math.min(1, ((at[0] - p[0]) * dx + (at[1] - p[1]) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(at[0] - p[0] - dx * t, at[1] - p[1] - dy * t)
}

/**
 * How far `at` (distance from the centre line, y) is from the mustache on its side (`FOOTPRINTS`):
 * negative inside it.
 */
function mustacheGap({ a, look }: Ctx, at: Pt): number {
  const outline = FOOTPRINTS[look.mustache]?.(a)
  if (outline === undefined) return Infinity
  let [gap, inside] = [Infinity, false]
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length] ?? p
    gap = Math.min(gap, segmentGap(at, [p, q]))
    // Even-odd: a ray out from `at` crosses the outline an odd number of times from inside it.
    const crosses = p[1] > at[1] !== q[1] > at[1] && at[0] < p[0] + ((at[1] - p[1]) * (q[0] - p[0])) / (q[1] - p[1])
    if (crosses) inside = !inside
  })
  return inside ? -gap : gap
}

/**
 * The cheek the claws rake. Away from a mouth prop's corner (body.ts `mouthProp` holds it at side
 * −1, or at +1 under a patch-monocle): its stem and bowl covered the rakes' ends and left slivers
 * of paint round it, a cigar alight or a bleeding corner at 48 px. Else away from the eye slash,
 * which runs down onto the cheek through the rakes' roots; else side −1. The cross scar on side +1
 * gives way to them (`SCARS`).
 */
function clawSide({ look }: Ctx): Side {
  if (MOUTH_PROPS.includes(look.prop)) return look.eyewear === 'patch-monocle' ? -1 : 1
  return look.scar === 'eye-slash' && look.scarSide === -1 ? 1 : -1
}

// Shapes -------------------------------------------------------------------------------------------

/**
 * A brushstroke: thick and round-ended at (x0, y0), drawn to a point at (x1, y1), bowed sideways by
 * `bend`. The claws are raked on like this, and dust wiped on.
 */
function taper(x0: number, y0: number, x1: number, y1: number, w: number, bend = 0): string {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1
  const [ux, uy] = [(x1 - x0) / len, (y1 - y0) / len]
  const [nx, ny] = [-uy, ux]
  const h = w / 2
  const [mx, my] = [(x0 + x1) / 2 + nx * bend, (y0 + y1) / 2 + ny * bend]
  return (
    d`M${x0 + nx * h} ${y0 + ny * h} Q${mx + nx * h} ${my + ny * h} ${x1} ${y1} ` +
    d`Q${mx - nx * h} ${my - ny * h} ${x0 - nx * h} ${y0 - ny * h} ` +
    d`C${x0 - nx * h - ux * h * 1.3} ${y0 - ny * h - uy * h * 1.3} ${x0 + nx * h - ux * h * 1.3} ${y0 + ny * h - uy * h * 1.3} ${x0 + nx * h} ${y0 + ny * h} Z`
  )
}

/**
 * An arc as path data (cubics, no A command), from angle `from` to `to` in degrees, y down, so 90 is
 * the bottom of the circle. Rings are outlined arcs: a stroke, so `outlined` can draw them.
 */
function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) / 90))
  const step = ((to - from) / steps) * (Math.PI / 180)
  const k = (4 / 3) * Math.tan(step / 4) * r
  let a0 = from * (Math.PI / 180)
  let out = d`M${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)}`
  for (let i = 0; i < steps; i++) {
    const a1 = a0 + step
    out += d` C${cx + r * Math.cos(a0) - k * Math.sin(a0)} ${cy + r * Math.sin(a0) + k * Math.cos(a0)} ${cx + r * Math.cos(a1) + k * Math.sin(a1)} ${cy + r * Math.sin(a1) - k * Math.cos(a1)} ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`
    a0 = a1
  }
  return out
}

// Paint --------------------------------------------------------------------------------------------

/** The peon's mud: its own brown, pulled a little towards the skin so it reads as dirt, not paint. */
const MUD = '#5a3417'
/**
 * The skull is bone with soot sockets whatever the paint colour: any other mix stops reading as a
 * skull. SHADOW is the socket of a shut eye, which is only a dark line and would vanish in soot.
 */
const BONE = '#ece4cf'
const SOOT = '#221c18'
const SHADOW = '#8a8178'
/**
 * The chin chevron's stand-ins. Under the mouth, red reads as blood, and bone under an underbite's
 * cream tusks as more teeth. (Thin black paint on dark skin turns bone in orc.ts first, so it lands
 * on woad too.)
 */
const CHIN_STAND_IN: Partial<Record<PaintColour, PaintColour>> = { red: 'ochre', bone: 'woad' }
/**
 * The chin's daubs: half their width, the skin between their tops, how far each drops per unit out,
 * and their longest and shortest length.
 */
const CHIN_HALF = 2.2
const CHIN_GAP = 6
const CHIN_DROP = 1
const CHIN_LONG = 7
const CHIN_SHORT = 4.5

/** A fat line of paint with round ends: bars and stripes. */
function daub(data: string, colour: string, w: number): string {
  return path(data, { fill: 'none', stroke: colour, sw: w, cap: 'round' })
}

/** Dust: a paler, drier brown than the mud, wiped on rather than smeared. */
const DUST = '#8c6a45'

/**
 * Dust wiped across the side −1 forehead, in the band between the brow ridge and a hat's edge: a
 * dab where the fingers landed, trailing off sideways into dry bristle streaks. Only where that band
 * shows (no hat that covers it, no fringe over it); a tilted brim would leave a sliver of it.
 */
function dustSwipe({ a, look, p }: Ctx, edge: Edge): string {
  if (HAT_INFO[look.hat].coversForehead || (look.frontHair && look.hair === 'fringe')) return ''
  const colour = mix(DUST, p.skin, 0.15)
  // Clear of the brow ridge's top (B − 3), and lifted with it when the brow is raised.
  const { inner, outer } = look.brow.m
  const y = a.B - 7 + Math.min(0, inner, outer)
  // From just off the centre line out to near the skull's edge, never past it.
  const [x0, x1] = [3, Math.min(a.ED + 5, room(edge, y) - 1.5)]
  // The dab, then three streaks from it of different lengths, the outer ones fanned a little.
  const streaks = [
    [-1.2, 1, 2.6],
    [0.3, 0.8, 3],
    [1.5, 0.65, 2.2],
  ] as const
  return (
    flat(taper(X(-1, x0), y, X(-1, x0 + 4), y - 0.2, 4.4), colour) +
    streaks
      .map(([dy, k, w]) => flat(taper(X(-1, x0 + 1.5), y + dy, X(-1, x0 + 1.5 + (x1 - x0 - 1.5) * k), y + dy * 1.4, w), colour))
      .join('')
  )
}

type PaintDraw = (ctx: Ctx, edge: Edge) => string

const PAINTS: Record<PaintName, PaintDraw> = {
  none: () => '',

  // A bandit band from ear to ear over both eyes, dipping under each eye; the brows hide its top.
  'eye-band': ({ a, p }, edge) => {
    const top = a.E - 4.5
    const bottom = a.E + 4.5
    const xt = room(edge, top)
    const xb = room(edge, bottom)
    return flat(
      d`M${50 - xt} ${top} Q50 ${top - 1.5} ${50 + xt} ${top} ` +
        along(edge, 1, top, bottom) +
        d`C${50 + a.ED + 3} ${bottom + 2} ${55} ${bottom + 0.5} 50 ${a.E + 2} ` +
        d`C${45} ${bottom + 0.5} ${50 - a.ED - 3} ${bottom + 2} ${50 - xb} ${bottom} ` +
        along(edge, -1, bottom, top) +
        'Z',
      p.paint,
    )
  },

  // Three claw rakes down one cheek (`clawSide`), from under the eye slanting out towards the jaw.
  // They stand outside that side's tusks, which would otherwise hide the inner rake and leave a
  // smudge. They start a strip of skin below the eye (or its rim) and stop short of the mouth's
  // corner: run into either, red rakes read as blood from it. A mustache on the cheek is drawn over
  // them (`FOOTPRINTS`), and cuts them into stubs: at a wide one's ends red ones bled from the mouth's
  // corner, bone ones were fangs or a tuft on it; under a hanging one's arm they poked out past it
  // as extra fringe or blood running down it. Under one they start higher and further out, beside
  // the eye's outer corner, where the mustache's top is lower, and stop a strip of skin above it.
  // Where that leaves a rake under 5 long, too short to read as a claw (a curl climbs the cheek
  // beside the eye, an arm hangs beside the mouth, a rim hangs low, a narrow cheek), there are none.
  claws: (ctx, edge) => {
    const { a, look, p } = ctx
    const side = clawSide(ctx)
    const stands = tusksOn(ctx, side)
    const under = FOOTPRINTS[look.mustache] !== undefined
    // The round root bulges up about 1.5 past `top` (`taper`), leaving a strip of skin above it. Out
    // beside the eye's corner, where the rakes start under a mustache, the eye's foot is higher:
    // they start 2 higher there and keep that strip.
    const top = a.E + eyeFoot(ctx, side) + (under ? 0 : 2)
    const len = a.M + 4 - top
    // Out by this much per unit down, and each rake out starts this much lower, where the cheek is
    // wider: a raking hand, and room for three apart on the narrowest head.
    const slant = 0.25
    const step = 2
    const root = 4
    const clear = (d0: number) => {
      for (let s = 0; s <= 1; s += 0.125) {
        if (tuskGap(stands, [d0 + slant * len * s, top + len * s]) < (root / 2) * (1 - s) + 0.3) return false
      }
      return true
    }
    let d0 = a.ED + (under ? 5 : 1)
    while (d0 < a.ED + 8 && !clear(d0)) d0 += 0.5
    // As far apart as the cheek allows (the outer rake's root inside it), never so close they merge.
    const outer = room(edge, top + step * 2) - root / 2
    const gap = Math.max(4.6, Math.min(5.5, (outer - d0) / 2))
    d0 = Math.min(d0, outer - gap * 2)
    const rakes = [0, 1, 2].map(i => {
      const x0 = d0 + gap * i
      const y0 = top + step * i
      const tip = (reach: number): Pt => [x0 + slant * reach, y0 + reach]
      // A strip of skin of 2 between the mustache and the rake, root to point.
      const bare = (reach: number) =>
        [0, 0.25, 0.5, 0.75, 1].every(s => mustacheGap(ctx, tip(reach * s)) >= (root / 2) * (1 - s) + 2)
      // Each rake out is a little shorter, and each stops before its point would leave the cheek,
      // come near the mouth's corner (which cuts the inner one short) or reach the mustache.
      const stop = (reach: number) =>
        tip(reach)[0] > room(edge, tip(reach)[1]) - 0.6 || cornerGap(ctx, side, tip(reach)) < 2.5 || !bare(reach)
      let k = len - i * 1.5
      while (k > 4 && stop(k)) k -= 0.5
      return { x0, y0, end: tip(k), shown: k >= 5 && bare(k) }
    })
    if (under && rakes.some(rake => !rake.shown)) return ''
    // The bend bows each rake the same way on either cheek.
    return rakes
      .map(({ x0, y0, end }) => flat(taper(X(side, x0), y0, X(side, end[0]), end[1], root, -0.5 * side), p.paint))
      .join('')
  },

  // Two straight bars down each cheek, from below the cheekbone out towards the jaw's corner. Each
  // keeps clear of the eye, the mouth's corner and the tusks: beside the mouth, red bars read as
  // blood streaming from its corners and bone ones as more tusks. So the inner bar stops short where
  // the cheek is narrow or the corner high. They lean in from the outline at the top, so they never
  // run along it as a second outline. On the cheek with the cross scar (side +1) they stop above
  // it: paint over a cut hides it at 48 px, and red resuming below it reads as the cut bleeding.
  // They stop a strip of skin short of a mustache on the cheek (`FOOTPRINTS`), which is drawn over
  // them: run on under a hanging one's arm, red read as blood running down it, bone as extra fangs.
  'jaw-bars': (ctx, edge) => {
    const { a, look, p } = ctx
    const half = 1.7
    // The outer bar's line: a wide strip of skin inside the outline at the cheekbone, a narrow one
    // at the jaw's corner. The inner bar runs a bar and a gap further in.
    const [y0, y1] = [a.E + 9, a.M + 4]
    const [x0, x1] = [room(edge, y0) - half - 2.4, room(edge, y1) - half - 0.9]
    const cross = look.scar === 'cheek-x' ? cheekCross(ctx, edge) : []
    const crossTop = Math.min(...cross.flat().map(([, y]) => y))
    return both(side => {
      const stands = tusksOn(ctx, side)
      const bars = [0, 1].map(i => {
        const at = (y: number): Pt => [x0 + ((x1 - x0) * (y - y0)) / (y1 - y0) - i * 4.8, y]
        // A tusk, drawn in front, may hide a bar's edge but not its middle.
        const clear = (y: number) =>
          eyeGap(ctx, at(y)) >= half + 1.4 &&
          cornerGap(ctx, side, at(y)) >= half + 2.5 &&
          tuskGap(stands, at(y)) >= 0.6 &&
          mustacheGap(ctx, at(y)) >= half + 2 &&
          (side === -1 || y < crossTop) &&
          cross.every(cut => segmentGap([X(side, at(y)[0]), y], cut) >= GROOVE + half + 1) &&
          // The round end must still clear the jaw as it curves in.
          at(y)[0] + half * 0.7 <= room(edge, y + half * 0.7)
        // The longest clear run from below the eye down to the jaw's corner, in half units.
        let [top, bottom] = [0, -1]
        let start: number | null = null
        for (let y = a.E + EYE_FOOT; y <= a.M + 5.5; y += 0.5) {
          if (y <= a.M + 5 && clear(y)) start ??= y
          else if (start !== null) {
            if (y - 0.5 - start > bottom - top) [top, bottom] = [start, y - 0.5]
            start = null
          }
        }
        return { top, bottom, at }
      })
      // A short inner bar reads as paint beside a long one, but on its own, cut short by a mustache
      // or the cross, it's a dab of colour on the cheek: a blush, or a cut. Then that cheek has none.
      if (Math.max(...bars.map(({ top, bottom }) => bottom - top)) < 7) return ''
      return bars
        .filter(({ top, bottom }) => bottom - top >= 4)
        .map(({ top, bottom, at }) =>
          daub(d`M${X(side, at(top)[0])} ${top} L${X(side, at(bottom)[0])} ${bottom}`, p.paint, half * 2),
        )
        .join('')
    })
  },

  // Two daubs slanting down and out on the chin, one each side of its middle with a wide strip of
  // skin between their tops, as low as the chin allows. A chevron pointing up, joined at the top, was
  // a second frowning mouth under a frown or a grim mouth (and the mouth itself under a mustache that
  // hides it); pointing down, or as ticks slanting up to the mouth's corners, a second grin. Nothing
  // runs down from the mouth either: bars hanging from the lower lip read as dribble in any colour (a
  // grille in black), and upright ticks beside an open mouth as tears or dribble. So they keep a
  // strip of skin (`MOUTH_GAP`) under the mouth, and under a mustache hanging over it or beside it
  // (`FOOTPRINTS`), and where a dropped jaw or a hanging tongue fills the chin there are none. They
  // never come in red or bone (`CHIN_STAND_IN`): under the mouth, red reads as blood, bone as teeth.
  // They stay symmetric; a tusk, drawn in front, may hide an edge.
  'chin-stripes': (ctx, edge) => {
    const { a, look } = ctx
    const colour = PAINT_HEX[CHIN_STAND_IN[look.paintColour] ?? look.paintColour]
    const half = CHIN_HALF
    const sides = [1, -1] as const
    // Inside the jaw, round ends and all, and clear of the mouth, the mustache and the tusks.
    const inside = ([x, y]: Pt) =>
      [0, 1, 2, 3, 4, 5, 6, 7].every(k => {
        const turn = (k * Math.PI) / 4
        return x + half * Math.cos(turn) <= room(edge, y + half * Math.sin(turn))
      })
    const clear = (pt: Pt) =>
      inside(pt) &&
      mustacheGap(ctx, pt) >= half + MOUTH_GAP &&
      sides.every(side => mouthGap(ctx, side, pt) >= half + MOUTH_GAP && tuskGap(tusksOn(ctx, side), pt) >= 0.6)
    // Each daub on side +1, from its top (`CHIN_GAP` of skin from the other's) down and out by
    // `CHIN_DROP` per unit out: the longest that fits, CHIN_LONG down to CHIN_SHORT, each length as
    // low as the jaw allows, where it's furthest from the mouth.
    const len = Math.hypot(1, CHIN_DROP)
    const [ux, uy] = [1 / len, CHIN_DROP / len]
    const x0 = CHIN_GAP / 2 + half
    for (let long = CHIN_LONG; long >= CHIN_SHORT; long -= 0.5) {
      const along = (top: number) => [0, 0.25, 0.5, 0.75, 1].map((s): Pt => [x0 + ux * long * s, top + uy * long * s])
      let top = a.J - uy * long
      while (top > a.M && !along(top).every(inside)) top -= 0.5
      if (!along(top).every(clear)) continue
      const [x1, y1] = [x0 + ux * long, top + uy * long]
      return daub(both(side => d`M${X(side, x0)} ${top} L${X(side, x1)} ${y1} `), colour, half * 2)
    }
    return ''
  },

  // A chevron pointing up between the eyes, its arms sweeping down under both eyes onto the cheeks.
  // (Hats come down to B−3 and the brow ridges fill B−3..B+5, so a chevron on the forehead would
  // show only bareheaded; this one shows under every hat.)
  chevron: ({ a, p }, edge) => {
    const apex = a.E - 2.5
    const foot = a.N + 2
    const reach = Math.min(a.ED + 8.5, room(edge, foot + 2.5))
    const t = 5.5
    return flat(
      d`M50 ${apex} L${50 + reach} ${foot} L${50 + reach - 1.5} ${foot + t} L50 ${apex + t + 1} ` +
        d`L${50 - reach + 1.5} ${foot + t} L${50 - reach} ${foot} Z`,
      p.paint,
    )
  },

  // A bone-white skull over the upper face, forehead to cheekbones and down to the nose, hollowed
  // under the cheekbones, with soot sockets round both eyes for the eyes to glow out of.
  skull: ({ a, look }, edge) => {
    const top = a.B - 9
    const xt = room(edge, top)
    const xn = room(edge, a.N - 1)
    // Down the inset edge to the cheekbones, in under them to the nose, and back up the other side.
    const mask =
      d`M${50 - xt} ${top} Q50 ${top - 2} ${50 + xt} ${top} ` +
      along(edge, 1, top, a.N - 1) +
      d`Q${50 + a.ED + 2} ${a.N - 2} ${50 + a.ED - 2} ${a.N + 3} Q${55} ${a.N + 4} 50 ${a.N + 3} ` +
      d`Q${45} ${a.N + 4} ${50 - a.ED + 2} ${a.N + 3} Q${50 - a.ED - 2} ${a.N - 2} ${50 - xn} ${a.N - 1} ` +
      along(edge, -1, a.N - 1, top) +
      'Z'
    const socket = (s: Side) => {
      const x = (dist: number) => X(s, a.ED + dist)
      const eye = (s === 1 ? look.eye.p : look.eye.m) ?? 'round'
      const fill = eye === 'happy' || eye === 'closed' ? SHADOW : SOOT
      return flat(
        d`M${x(-6.5)} ${a.E - 1} C${x(-6.5)} ${a.E - 7} ${x(6.5)} ${a.E - 7} ${x(6.5)} ${a.E - 1} ` +
          d`C${x(6.5)} ${a.E + 4.5} ${x(2.5)} ${a.E + 7} ${x(0)} ${a.E + 7} C${x(-3.5)} ${a.E + 7} ${x(-6.5)} ${a.E + 4.5} ${x(-6.5)} ${a.E - 1} Z`,
        fill,
      )
    }
    return flat(mask, BONE) + both(socket)
  },

  // A smudge of mud on the side +1 cheekbone, dragged down by the fingers, a fleck beside it, and
  // dust wiped across the side −1 forehead (`dustSwipe`). (A second smudge by the jaw, dragged
  // down beside the mouth, read as food or drool round it.)
  mud: (ctx, edge) => {
    const { a, p } = ctx
    const colour = mix(MUD, p.skin, 0.12)
    const smudge =
      'M-5 -1 C-5 -3.5 -2 -4.2 0.5 -3.6 C3 -4.6 6.2 -3 5.6 -0.4 C7.2 0.6 8.6 2.6 8.8 4.6 C7.4 4.4 6 3.2 5 2.6 ' +
      'C5.2 4 5.6 5.6 5 7 C3.6 6 3 4.6 2.4 3.6 C0.4 4.6 -3 4 -4.5 2.5 C-5.5 1.5 -5.5 0 -5 -1 Z'
    return (
      g(flat(smudge, colour), { transform: `translate(${n(X(1, a.ED + 3))} ${n(a.E + 8.5)}) scale(1.1)` }) +
      circle(X(1, a.ED + 10.5), a.E + 6, 1.3, { fill: colour, stroke: 'none' }) +
      dustSwipe(ctx, edge)
    )
  },
}

/** Layer 9: war paint (or the peon's mud smudge), inside the head outline. */
export function paint(ctx: Ctx): string {
  return PAINTS[ctx.look.paint](ctx, edgeOf(ctx))
}

/**
 * Whether `look`'s paint draws anything on the head with anchors `a`: the claws, the jaw bars and
 * the chin's daubs give way to the mustache, the mouth, the tusks, the eyewear, a mouth prop and the
 * cheek's scar, and may find no room. For resolve, which shouldn't count or keep paint that never
 * shows. It runs the drawing itself, so the two can't disagree; the colours don't change the fit.
 */
export function paintShows(look: Look, a: Anchors): boolean {
  return paint({ look, a, p: paletteFor(look) }) !== ''
}

// Scars --------------------------------------------------------------------------------------------

/** A cut: a line (two points) or a quadratic curve (three), on the canvas. */
type Cut = readonly Pt[]

/** The light falls from the drawing's upper right, where the eyes' glints sit. */
const LIGHT: Pt = [Math.SQRT1_2, -Math.SQRT1_2]
/** The groove's width, and how far the ridge rides off the groove's centre line, towards the light. */
const GROOVE_W = W.feature + 0.8
const RIDGE_OFF = 1.5
/** How far a scar reaches past its centre line: the ridge's lit side. */
const GROOVE = RIDGE_OFF + W.detail / 2

/** A cut as path data, moved by `shift` and with each end drawn in by `trim` along it. */
function cutData(cut: Cut, shift: Pt = [0, 0], trim = 0): string {
  const [p0, p1, p2] = cut
  if (p0 === undefined || p1 === undefined) return ''
  const pt = ([x, y]: Pt): Pt => [x + shift[0], y + shift[1]]
  // Towards `to` by `trim`: the end pulled in along the cut.
  const inward = (from: Pt, to: Pt): Pt => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1
    return pt([from[0] + ((to[0] - from[0]) * trim) / len, from[1] + ((to[1] - from[1]) * trim) / len])
  }
  if (p2 === undefined) {
    const [a, b] = [inward(p0, p1), inward(p1, p0)]
    return d`M${a[0]} ${a[1]} L${b[0]} ${b[1]} `
  }
  const [a, q, b] = [inward(p0, p1), pt(p1), inward(p2, p1)]
  return d`M${a[0]} ${a[1]} Q${q[0]} ${q[1]} ${b[0]} ${b[1]} `
}

/** The ridge's shift off a cut: square to its chord, on the lit side. */
function ridgeShift(cut: Cut): Pt {
  const first = cut[0] ?? [0, 0]
  const last = cut[cut.length - 1] ?? first
  const len = Math.hypot(last[0] - first[0], last[1] - first[1]) || 1
  let [nx, ny] = [-(last[1] - first[1]) / len, (last[0] - first[0]) / len]
  if (nx * LIGHT[0] + ny * LIGHT[1] < 0) [nx, ny] = [-nx, -ny]
  return [nx * RIDGE_OFF, ny * RIDGE_OFF]
}

/**
 * Healed cuts: a dark groove, with a pale ridge raised along its lit side and stopping short of its
 * ends. The groove carries the scar at 48 px on every skin, where a pale line alone vanishes (and
 * reads as wet); the ridge makes it a scar rather than a drawn line.
 */
function scar({ p }: Ctx, cuts: readonly Cut[]): string {
  const groove = cuts.map(cut => cutData(cut)).join('')
  const ridge = cuts.map(cut => cutData(cut, ridgeShift(cut), 1.2)).join('')
  return (
    path(groove, { fill: 'none', stroke: mix(p.skinDark, O, 0.45), sw: GROOVE_W }) +
    path(ridge, { fill: 'none', stroke: mix(p.skinLight, '#fff6e8', 0.25), sw: W.detail })
  )
}

/** Stitch thread across a cut: dark, since pale stitches vanish at 48 px. */
function thread({ p }: Ctx, data: string): string {
  return path(data, { fill: 'none', stroke: mix(p.skinDark, O, 0.75), sw: W.detail })
}

/** A point on a quadratic, and the unit normal there. */
function onQuad(p0: Pt, p1: Pt, p2: Pt, t: number): { at: Pt; normal: Pt } {
  const u = 1 - t
  const at: Pt = [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]
  const tx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
  const ty = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
  const len = Math.hypot(tx, ty) || 1
  return { at, normal: [-ty / len, tx / len] }
}

/**
 * The stitched cut on side +1, on the canvas: from the forehead over the end of the brow and round
 * the outside of the eye, to end on the cheekbone.
 */
function stitchedCut({ a }: Ctx, edge: Edge): readonly [Pt, Pt, Pt] {
  return [
    [X(1, a.ED - 3), a.B - 10],
    [X(1, Math.min(a.ED + 11, room(edge, a.B) - GROOVE)), a.B],
    [X(1, Math.min(a.ED + 6, room(edge, a.N + 2) - 3)), a.N + 2],
  ]
}

/** Where the stitches cross the stitched cut, along it, and how far each reaches either side. */
const STITCHES = [0.1, 0.32, 0.54, 0.76, 0.96] as const
const STITCH_REACH = 2.8

/** The stitches across a stitched cut, each as its two ends on the canvas. */
function stitchesOn(cut: readonly [Pt, Pt, Pt]): (readonly [Pt, Pt])[] {
  return STITCHES.map(t => {
    const { at, normal } = onQuad(...cut, t)
    const [dx, dy] = [normal[0] * STITCH_REACH, normal[1] * STITCH_REACH]
    return [[at[0] - dx, at[1] - dy], [at[0] + dx, at[1] + dy]]
  })
}

/**
 * Whether the stitched cut and its stitches clear the mustache: a walrus or chevron lies lower, and
 * mostly a drooper, but the handlebar's and curly's curls climb to where it ends, the imperial's
 * horn beside it, and the horseshoe's lobes and the braids' lip piece reach out under its end.
 */
function stitchesClear(ctx: Ctx, edge: Edge): boolean {
  const cut = stitchedCut(ctx, edge)
  const gap = ([x, y]: Pt) => mustacheGap(ctx, [x - 50, y])
  return gap(cut[2]) >= GROOVE && stitchesOn(cut).every(ends => ends.every(end => gap(end) >= W.detail / 2))
}

/**
 * The cheek-x scar's two cuts, on the canvas: a long cut slanting down the side +1 cheek towards the
 * jaw, and a shorter one across it off its middle. A neat X beside the eye reads as a cartoon
 * knocked-out eye; low on the cheek and uneven, it reads as a scar. It sits as far out as the cheek
 * allows, and as high as keeps a strip of skin below the eye and clears the tusk, the mouth's
 * corner and a mustache. Where it would be pressed against a tusk or a mustache there are no cuts
 * (the stitched cut instead, `SCARS`), unless the mustache reaches that too: then it moves down onto
 * the jaw, below the mouth, if even that will do. Jaw-bars on that cheek break round it.
 */
function cheekCross(ctx: Ctx, edge: Edge): Cut[] {
  const { a } = ctx
  const stands = tusksOn(ctx, 1)
  // The cuts' ends round the centre, as (out, down): the long cut from upper inner to lower outer.
  const cuts: readonly Cut[] = [
    [[-3, -4.3], [3.2, 4]],
    [[2.8, -2.6], [-2.2, 1.8]],
  ]
  const ends = cuts.flat()
  // How well the cross fits at y, as far out as the cheek allows there: the worst of its gaps. Down
  // on the jaw it sits under the mouth, which hangs well below its corners when open: there it
  // keeps a strip of skin from the mouth's whole lower edge, or it reads as a crumb or dribble.
  const outmost = (y: number) => Math.min(a.CW - 6, ...ends.map(([u, v]) => room(edge, y + v) - GROOVE - u))
  const fit = (y: number, jaw: boolean) => {
    const dist = outmost(y)
    return Math.min(
      ...ends.map(([u, v]): number => {
        const pt: Pt = [dist + u, y + v]
        return Math.min(
          eyeGap(ctx, pt) - 3.5,
          cornerGap(ctx, 1, pt) - GROOVE - 1,
          jaw ? mouthGap(ctx, 1, pt) - GROOVE - MOUTH_GAP : Infinity,
          tuskGap(stands, pt) - GROOVE,
          mustacheGap(ctx, pt) - GROOVE - 1,
        )
      }),
    )
  }
  // Whether the cross at y runs into a tusk or under the mustache, both drawn over it. The ridge
  // rides on the cuts' lit side, away from the tusk, so it's the groove that would touch that.
  const pressed = (y: number) => {
    const dist = outmost(y)
    return ends.some(([u, v]) => {
      const pt: Pt = [dist + u, y + v]
      return tuskGap(stands, pt) < GROOVE_W / 2 || mustacheGap(ctx, pt) < GROOVE
    })
  }
  // The highest spot between `from` and `to` that fits, else the best of them.
  const search = (from: number, to: number, jaw = false) => {
    let [y, best] = [from, -Infinity]
    for (let at = from; at <= to; at += 0.5) {
      const score = fit(at, jaw)
      if (score > best) [y, best] = [at, score]
      if (score >= 0) break
    }
    return { y, best }
  }
  // Down the cheek from the nose: where no spot keeps every strip of skin, the best one, unless
  // that's pressed. Pressed against a big tusk on the bean's narrow cheek, the cross made one blob
  // with the tusk's tip at 48 px (a chipped tusk); under a mustache only its ends showed, as
  // smudges. The stitched cut comes before the jaw: down there beside a tusk or under a walrus's
  // tip the cross read as a crumb or a goatee, and stuck to an open mouth it reads as one too.
  let { y } = search(a.N + 1, a.M - 2)
  if (pressed(y)) {
    if (stitchesClear(ctx, edge)) return []
    const jaw = search(a.M - 1.5, a.J - 5, true)
    if (jaw.best < 0) return []
    y = jaw.y
  }
  const dist = outmost(y)
  return cuts.map(cut => cut.map(([u, v]): Pt => [X(1, dist + u), y + v]))
}

const SCARS: Record<ScarName, (ctx: Ctx, edge: Edge) => string> = {
  none: () => '',

  // From the forehead down through the brow and the eye and out across the cheek, clear of the
  // tusks; the eye and brow are drawn over it, so it shows above the brow and well down the cheek.
  'eye-slash': (ctx, edge) => {
    const { a, look } = ctx
    const s = look.scarSide
    const bottom = a.E + 12
    const x1 = Math.min(a.ED + 7, room(edge, bottom + GROOVE) - GROOVE)
    return scar(ctx, [[[X(s, a.ED - 4), a.B - 9], [X(s, a.ED), a.E - 1], [X(s, x1), bottom]]])
  },

  // The cross (`cheekCross`) on side +1. When the claws take that cheek, away from a mouth prop
  // (`clawSide`), it's cut as an eye slash on the prop's side instead, which stays above the prop.
  // Where the cross has no room it's the stitched cut by the eye, if that clears the mustache.
  'cheek-x': (ctx, edge) => {
    if (ctx.look.paint === 'claws' && clawSide(ctx) === 1) return SCARS['eye-slash'](ctx, edge)
    const cuts = cheekCross(ctx, edge)
    if (cuts.length > 0) return scar(ctx, cuts)
    return stitchesClear(ctx, edge) ? SCARS.stitches(ctx, edge) : ''
  },

  // The stitched cut (`stitchedCut`), stitched across. Hats cover the forehead, so the lower
  // stitches sit beside the eye.
  stitches: (ctx, edge) => {
    const cut = stitchedCut(ctx, edge)
    const ticks = stitchesOn(cut).map(([p, q]) => d`M${p[0]} ${p[1]} L${q[0]} ${q[1]} `)
    return scar(ctx, [cut]) + thread(ctx, ticks.join(''))
  },

  // A short split down through both lips, off the middle, stitched across above and below the
  // mouth. It goes on the side with more room inside its tusk (the side a lone tusk leaves bare),
  // halfway out to the corner or as far as that tusk allows, so the tusk never hides it. (At the
  // corner it merges with the mouth's own outline into a blot.)
  'split-lip': ctx => {
    const { a } = ctx
    const top = a.M - 5
    const bottom = lowerLip(ctx) + 3
    // The furthest out the cut fits on a side, clear of its tusks.
    const fit = (side: Side) => {
      const stands = tusksOn(ctx, side)
      let dist = a.MW / 2
      const clear = (c: number) => [top, (top + bottom) / 2, bottom].every(y => tuskGap(stands, [c, y]) >= GROOVE)
      while (dist > 3 && !clear(dist)) dist -= 0.5
      return dist
    }
    const side: Side = fit(-1) > fit(1) ? -1 : 1
    const x = X(side, fit(side))
    const ticks = [top + 1.6, bottom - 1.6].map(y => d`M${x - 2} ${y} L${x + 2} ${y + 0.4} `).join('')
    return scar(ctx, [[[x - side * 0.4, top], [x + side * 0.6, bottom]]]) + thread(ctx, ticks)
  },
}

/** Layer 10: scars. The eye slash goes on `look.scarSide`. */
export function scars(ctx: Ctx): string {
  return SCARS[ctx.look.scar](ctx, edgeOf(ctx))
}

// Hoops --------------------------------------------------------------------------------------------

/**
 * Hoop radii. A lone hoop is the biggest; a row of them, root outwards, is smaller, so two or three
 * spread along the rim as piercings rather than piling up at the root as a coil (or a Slinky, or
 * ringlets beside braids).
 */
const LONE_R = 4.2
const ROW_R = [3.6, 3.1, 2.7] as const
/** Space between neighbouring rings, beyond their radii: their colours never touch. */
const HOOP_GAP = 3

/**
 * The eyewear whose rims (or dark lenses) sit across the eye line, level with the ear's root, with
 * arms or straps running back to it. Hoops at the root hung beside the rims in the same metal, a
 * row of rings across the face; under these, each ear takes one hoop, as far out as it fits.
 */
const RIMMED: readonly EyewearName[] = ['spectacles', 'goggles', 'pince-nez', 'shades']

interface Hoop {
  /** The ring's centre on the canvas. */
  c: Pt
  r: number
}

/**
 * How far out along an ear's lower edge (root 0, tip 1) a hoop may hang: short of a pointed tip,
 * where it gets too thin to hang a ring on.
 */
const HOOP_REACH = 0.84

/** How far a ring's outline reaches either side of its centre line (`outlined`). */
const RING_OUT = (W.detail + 2.5) / 2

/** Whether a ring at `c` keeps 1.75 of canvas past its outline. */
function onCanvas(c: Pt, r: number): boolean {
  return Math.abs(c[0] - 50) + r + RING_OUT <= 48.25 && c[1] + r + RING_OUT <= 98.25
}

/**
 * Up to `radii.length` hoops along this ear's lower edge, root outwards (or tip inwards, `outmost`).
 * Each hangs from its piercing a little out from the edge and down, and each keeps clear of the
 * last. They hang where a ring clears the head (the lobe itself is under the head's outline on the
 * wider heads), short of the tip and the canvas edge, so a short ear may hold fewer, or none.
 */
function hoopsOn(ctx: Ctx, edge: Edge, side: Side, radii: readonly number[], outmost: boolean): Hoop[] {
  // heads.ts runs the lower edge from the tip (0) to the root (1); here t runs root outwards.
  const on = (t: number) => earEdge(ctx, side, 1 - t)
  const steps = Array.from({ length: Math.round(HOOP_REACH * 50) + 1 }, (_, i) => i / 50)
  const out: Hoop[] = []
  for (const t of outmost ? steps.reverse() : steps) {
    const r = radii[out.length]
    if (r === undefined) break
    const [x, y] = on(t)
    const [xa, ya] = on(t - 0.02)
    const [xb, yb] = on(t + 0.02)
    const len = Math.hypot(xb - xa, yb - ya) || 1
    // The edge's normal on the hanging side (the one pointing down), tipped halfway to straight down.
    const flip = xb - xa >= 0 ? 1 : -1
    const nx = (-(yb - ya) / len) * flip
    const ny = ((xb - xa) / len) * flip
    const hang = Math.hypot(nx, ny + 1) || 1
    const c: Pt = [x + (nx / hang) * (r - 1), y + ((ny + 1) / hang) * (r - 1)]
    // The ring's inner side may tuck under the head's outline by 1, no more.
    if (Math.abs(c[0] - 50) - r < edge(c[1]) - 1 || !onCanvas(c, r)) continue
    const last = out[out.length - 1]
    if (last && Math.hypot(c[0] - last.c[0], c[1] - last.c[1]) < last.r + r + HOOP_GAP) continue
    out.push({ c, r })
  }
  return out
}

/**
 * How far a droopy ear's ring may climb its lower edge from the lowest point, and the background it
 * keeps between its outline and the head's.
 */
const LOBE_RISE = 1.5
const LOBE_CLEAR = 1.5

/**
 * A droopy ear's ring. Hung along its lower edge, it lay against the cheek, face on beside the
 * jaw, where in iron or silver it read as a neck bolt (and with a flat black fringe, as a famous
 * film monster's). It dangles from the lobe instead: centred straight below the edge's lowest point
 * (the tip, under any droop), its top 1 above the edge. Where the canvas's edge or the head leaves
 * no room it moves in along the lobe, no higher than LOBE_RISE; it keeps LOBE_CLEAR from the head
 * all round, or there is none.
 */
function lobeHoop(ctx: Ctx, edge: Edge, side: Side): Hoop | undefined {
  const r = LONE_R
  // The lower edge from the tip (heads.ts t = 0) halfway to the root.
  const spots = Array.from({ length: 51 }, (_, i) => earEdge(ctx, side, i / 100))
  const lowest = Math.max(...spots.map(([, y]) => y))
  const clear = (c: Pt) =>
    Array.from({ length: 36 }, (_, i) => (i * Math.PI) / 18).every(turn => {
      const [x, y] = [c[0] + r * Math.cos(turn), c[1] + r * Math.sin(turn)]
      return Math.abs(x - 50) - RING_OUT >= edge(y) + W.silhouette / 2 + LOBE_CLEAR
    })
  for (const [x, y] of spots.slice(spots.findIndex(([, y]) => y === lowest))) {
    if (y < lowest - LOBE_RISE) break
    const c: Pt = [x, y + r - 1]
    if (onCanvas(c, r) && clear(c)) return { c, r }
  }
  return undefined
}

/**
 * The warm metal a droopy ear's ring takes: in iron or silver it's the bolt, in gold or bronze an
 * earring. Iron goes bronze and silver gold, or the other where that one is near the skin's colour.
 */
function lobeMetal({ look, p }: Ctx): string {
  if (look.metal === 'gold' || look.metal === 'bronze') return p.metal
  const warm: readonly MetalName[] = look.metal === 'iron' ? ['bronze', 'gold'] : ['gold', 'bronze']
  return METAL_HEX[warm.find(metal => !clashes(METAL_HEX[metal][0], p.skin)) ?? 'gold'][0]
}

/**
 * The side a monocle's chain hangs on (eyewear.ts). It sweeps off the rim across the cheekbone and
 * down past the jaw, right where the lower hoops hang, so a grey chain over grey hoops reads as
 * threaded through them: that ear goes without.
 */
const CHAIN_SIDE: Partial<Record<EyewearName, Side>> = { monocle: 1, 'patch-monocle': -1 }

/**
 * Layer 6, after the ears: hoops along the side +1 ear's lower edge, and side −1's with `hoopsBoth`.
 * Under a monocle they hang on the ear away from its chain instead; under rimmed eyewear, one an
 * ear, away from the rims. A droopy ear takes one, from its lobe (`lobeHoop`), threaded through it:
 * its top passes behind the lobe and the rest in front. The ears come before this layer (orc.ts),
 * so they're drawn again over the whole ring, then its lower arc over them.
 */
export function hoops(ctx: Ctx): string {
  const { look, p } = ctx
  if (look.hoops <= 0) return ''
  const edge = edgeOf(ctx)
  const chain = CHAIN_SIDE[look.eyewear]
  const sides: readonly Side[] = chain !== undefined ? [chain === 1 ? -1 : 1] : look.hoopsBoth ? [1, -1] : [1]
  if (look.ears === 'droopy') {
    const rings = sides.flatMap(side => lobeHoop(ctx, edge, side) ?? [])
    if (rings.length === 0) return ''
    const metal = lobeMetal(ctx)
    const whole = rings.map(({ c, r }) => outlined(arc(c[0], c[1], r, -90, 270), metal)).join('')
    // The lower arc, below the lobe's outline (−20° to 200°), in colour only: its own outline would
    // lie on the ear's there, and its ends, drawn across the ring's colour, left dark seams. It's a
    // filled band, not a butt-capped stroke: ImageMagick's own renderer closes an open butt-capped
    // curve with a bar across its ends, which turned the hoop into a D-shaped buckle.
    const band = (cx: number, cy: number, r: number) =>
      arc(cx, cy, r + W.detail / 2, -20, 200) + arc(cx, cy, r - W.detail / 2, 200, -20).replace(/^M/, ' L') + ' Z'
    const lower = rings.map(({ c, r }) => path(band(c[0], c[1], r), { fill: metal, stroke: 'none' })).join('')
    return whole + ears(ctx) + lower
  }
  const rimmed = RIMMED.includes(look.eyewear)
  const radii = rimmed ? ROW_R.slice(0, 1) : look.hoops === 1 ? [LONE_R] : ROW_R.slice(0, look.hoops)
  return sides
    .map(side =>
      hoopsOn(ctx, edge, side, radii, rimmed)
        .map(({ c, r }) => outlined(arc(c[0], c[1], r, -90, 270), p.metal))
        .join(''),
    )
    .join('')
}

// The nose ring ------------------------------------------------------------------------------------

/**
 * Layer 19: a bull ring through the bottom of the nose, over the mustache. Its top runs up into the
 * nostrils, so only the hanging U shows: a closed ring this small reads as a bead.
 */
export function noseRing(ctx: Ctx): string {
  const { a, p, look } = ctx
  if (!look.noseRing) return ''
  return outlined(arc(50, a.N + 3.2, 3.6, -38, 218), p.metal)
}
