// The body: the neck and the garment, grunt shoulder armour, neckwear, and props (a pickaxe behind
// the shoulder, or something in the mouth).
//
// The head covers almost everything above the chin, so the body is a band along the bottom edge: the
// neck flaring out from under the jaw into the shoulders, the garment from the shoulder line down
// and off the sides, and below the chin a strip where neckwear shows. Everything is placed from
// the jaw (JW, M, J) and the shoulder line (SHOULDER), never from fixed numbers, because the four
// heads (and their jitter) put the chin anywhere from y 81 to 87.

import { mouthCorner, tuskSpans } from './face'
import { earEdge, headHalfWidth } from './heads'
import { METAL_HEX, TEAM_HEX, clashes } from './palette'
import type { Palette } from './palette'
import {
  MIRROR, O, W, X, at, both, circle, d, ellipse, flat, g, mix, n, outlined, path, shade, shape, toHsl,
} from './svg'
import type { Row } from './svg'
import type {
  Anchors, ClothingName, Ctx, Draw, EyewearName, Look, MustacheName, NeckwearName, PropName, ShoulderName, Side,
} from './types'

/** A point, [x, y]. */
type Pt = readonly [number, number]

/**
 * The tabard is the grunt's one garment in a per-repo team colour, and at 48 px the strongest cue
 * (after the hat) for telling grunts apart, so it's the most common; harness and vest are the
 * same brown leather over green, and mail the same grey as the pauldrons.
 */
export const CLOTHING_ROWS: readonly Row<ClothingName>[] = [
  ['burlap-v', 30, 0],
  ['burlap-round', 25, 0],
  ['burlap-patched', 20, 0],
  ['burlap-rope', 15, 0],
  ['burlap-strap', 10, 0],
  ['harness', 0, 25],
  ['vest', 0, 20],
  ['mail', 0, 15],
  ['tabard', 0, 40],
]

/**
 * Spiked, great and plate are all iron, the same grey bump in the bottom corners at 48 px, so
 * together they stay under half the grunts; fur, bone and bare shoulders make up the rest. Bone is
 * kept rare: its pair of skulls is the loudest shoulder at 48 px, and at a fifth of grunts the
 * same two skulls in the bottom corners made unlike grunts look alike. Fur does that least.
 */
export const SHOULDER_ROWS: readonly Row<ShoulderName>[] = [
  ['none', 100, 18],
  ['spiked', 0, 20],
  ['great', 0, 14],
  ['fur', 0, 30],
  ['plate', 0, 8],
  ['bone', 0, 10],
]

/**
 * [name, peon, grunt, gentleman]. Bow ties and cravats stay rare off the gent column, so they still
 * read as the gentleman's joke. The gent column is read for both builds, so it leaves out the
 * grunt's spiked collar and keeps the peon's scarf rare.
 */
export const NECKWEAR_ROWS: readonly Row<NeckwearName>[] = [
  ['none', 76, 67, 33],
  ['bow-tie', 2, 2, 30],
  ['cravat', 1, 1, 22],
  ['tooth-necklace', 8, 16, 4],
  ['amulet', 7, 6, 8],
  ['spiked-collar', 0, 8, 0],
  ['scarf', 6, 0, 3],
]

/**
 * [name, peon, grunt, gentleman]. The gent column is read for both builds, so it leaves out the
 * peon's wheat and pickaxe: a pauldroned grunt in a top hat shouldn't be chewing a stalk.
 */
export const PROP_ROWS: readonly Row<PropName>[] = [
  ['none', 72, 84, 58],
  ['pipe', 4, 4, 26],
  ['cigar', 2, 6, 12],
  ['wheat', 12, 0, 0],
  ['toothpick', 0, 6, 4],
  ['pickaxe', 10, 0, 0],
]

/** Props that sit in the mouth (the rest ride behind the shoulder). */
export const MOUTH_PROPS: readonly PropName[] = ['pipe', 'cigar', 'wheat', 'toothpick']

// Fixed colours the palette doesn't carry. Mail and armour are always iron: the look's metal is for
// trim and trinkets, and gold armour would swamp the face.
const [IRON, IRON_LIGHT, IRON_DARK] = METAL_HEX.iron
const ROPE = '#d9b86c'
const WOOD = '#8a5a32'
const WOOD_DARK = '#5e3b1f'
const BONE = '#ece3c8'
const STRAW = '#e6c260'
const STRAW_DARK = '#b88f34'
const CIGAR = '#9a6034'
const EMBER = '#ff6a2a'
const EMBER_HOT = '#ffd84a'
const SMOKE = '#d9d9d9'
/** The pipe bowl's charred tobacco. */
const CHAR = '#3a2414'
/** The amulet's gem when the accent would melt into its metal: teal stands apart from all four. */
const GEM = '#22a39a'
/** Bow ties pick from these by `look.neckColour`; all light enough for a dark terminal. */
const BOW_HEX = ['#c23b33', '#2f5fc8', '#e0b23c', '#6a3fa0', '#2f9b98', '#d9d4c6', '#e07a26'] as const
/**
 * Cravat silks, picked by `look.neckColour`: wine, royal blue and violet, which stand off tan
 * sacking, green skin and grey mail alike. No pale ones: cream, ivory or pale gold, cut by the
 * knot's and blades' outlines, read at 48 px as teeth or a scrap of bone under the chin (a
 * blue-white as ice, a pale pink as a tongue); a darker navy or plum sank into the chin's outline.
 */
const SILK_HEX = ['#9a2440', '#2f5bc0', '#7e48b8'] as const

// The frame -------------------------------------------------------------------------------------

/**
 * The garment's line across the shoulders: `top` by the neck, `edge` where it leaves each side of
 * the canvas, and `nw` the neck's half-width there. Peons slump; grunts are square and thick-necked.
 */
interface Frame {
  top: number
  edge: number
  nw: number
}

function frame(look: Look, a: Anchors): Frame {
  const grunt = look.build === 'grunt'
  return { top: a.SHOULDER - (grunt ? 4 : 3), edge: a.SHOULDER + (grunt ? 6 : 9), nw: a.JW - (grunt ? 7 : 9) }
}

/**
 * The neck: from just inside the jaw corners, sweeping out in a concave curve (the traps) to meet
 * the garment `flare` beyond the jaw, and down off the bottom. The sweep is what shows beside the
 * jaw, so a wider flare makes a thicker-necked orc.
 */
function neckPath(a: Anchors, f: Frame, flare: number): string {
  const l = (dist: number) => 50 - dist
  const r = (dist: number) => 50 + dist
  return [
    d`M${l(a.JW - 1)} ${a.M + 2} C${l(a.JW - 1)} ${a.M + 11} ${l(a.JW + flare * 0.45)} ${f.top - 3} ${l(a.JW + flare)} ${f.top + 2}`,
    d`L${l(a.JW + flare)} 101 L${r(a.JW + flare)} 101 L${r(a.JW + flare)} ${f.top + 2}`,
    d`C${r(a.JW + flare * 0.45)} ${f.top - 3} ${r(a.JW - 1)} ${a.M + 11} ${r(a.JW - 1)} ${a.M + 2} Z`,
  ].join(' ')
}

/**
 * The curve over the side +1 shoulder, from the end of the flat run by the neck out past the side
 * edge: [x0, y0, x1, y1, x2, y2, x3, y3]. Side −1 mirrors it.
 */
function shoulderCurve(f: Frame): readonly number[] {
  return [50 + f.nw + 4, f.top, 86, f.top, 98, f.top + 2, 103, f.edge]
}

/**
 * The shoulders as one mass: over each shoulder from the side edges, in to the neck, then
 * `neckline` (which must run from (50 − nw, top) to (50 + nw, top)), and off the bottom.
 */
function massPath(f: Frame, neckline: string): string {
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0] = shoulderCurve(f)
  return [
    d`M${100 - x3} 101 L${100 - x3} ${y3} C${100 - x2} ${y2} ${100 - x1} ${y1} ${100 - x0} ${y0}`,
    d`L${50 - f.nw} ${f.top}`,
    neckline,
    d`L${x0} ${y0} C${x1} ${y1} ${x2} ${y2} ${x3} ${y3} L${x3} 101 Z`,
  ].join(' ')
}

/** The shoulder curve on `side`, walked inward from the side edge to the flat by the neck. */
function shoulderIn(f: Frame, side: Side): string {
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0] = shoulderCurve(f)
  const x = (value: number) => (side === 1 ? value : 100 - value)
  return d`L${x(x3)} ${y3} C${x(x2)} ${y2} ${x(x1)} ${y1} ${x(x0)} ${y0}`
}

/** Necklines, each from (50 − nw, top) to (50 + nw, top). */
const vNeck = (f: Frame, depth: number) => d`L50 ${f.top + depth} L${50 + f.nw} ${f.top}`
const roundNeck = (f: Frame, depth: number) => d`Q50 ${f.top + 2 * depth} ${50 + f.nw} ${f.top}`

/** A cubic as [x0, y0, x1, y1, x2, y2, x3, y3], its x growing from x0 to x3. */
type Curve = readonly number[]

/** One coordinate of the cubic p0 → p3 (controls p1, p2) at t. */
function bez(t: number, p0: number, p1: number, p2: number, p3: number): number {
  return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3
}

/** The point at t along the cubic p0 → p3 (controls p1, p2). */
function cubicAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  return [bez(t, p0[0], p1[0], p2[0], p3[0]), bez(t, p0[1], p1[1], p2[1], p3[1])]
}

/** The curve's y where it reaches x (found by bisection). */
function yAtX(curve: Curve, x: number): number {
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0] = curve
  let lo = 0
  let hi = 1
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (bez(mid, x0, x1, x2, x3) < x) lo = mid
    else hi = mid
  }
  return bez(lo, y0, y1, y2, y3)
}

/** The garment's top edge at x: flat by the neck, then the shoulder curve. */
function topAt(f: Frame, x: number): number {
  const curve = shoulderCurve(f)
  const dx = 50 + Math.abs(x - 50)
  return dx <= (curve[0] ?? 0) ? f.top : yAtX(curve, dx)
}

// Torso -------------------------------------------------------------------------------------------

/** The neck, shadowed, sweeping into the traps beside the jaw; a thicker one for a bare chest. */
function neck(ctx: Ctx, f: Frame, flare = 10): string {
  return shape(neckPath(ctx.a, f, flare), ctx.p.skinDark, W.silhouette)
}

/** A bare chest (harness, vest): the shoulders in skin, the neck's shadow above, a pec line each side. */
function chest(ctx: Ctx, f: Frame): string {
  const { p } = ctx
  const pecs = both(s => {
    const x = (dist: number) => 50 + s * dist
    return path(d`M${x(3)} ${f.top + 9} Q${x(10)} ${f.top + 12} ${x(18)} ${f.top + 8}`, { sw: W.detail })
  })
  return (
    neck(ctx, f, 13) +
    shape(massPath(f, roundNeck(f, 2)), p.skin, W.silhouette) +
    flat(d`M${50 - f.nw} ${f.top} Q50 ${f.top + 8} ${50 + f.nw} ${f.top} Z`, p.skinDark) +
    pecs
  )
}

/** A burlap sack over the shoulders, shaded round the outside of each. */
function sack(ctx: Ctx, f: Frame, neckline: string): string {
  const { a, p } = ctx
  return shape(massPath(f, neckline), p.burlap, W.silhouette) + roundness(a, f, p.burlapDark)
}

/**
 * The shadow side of each shoulder: a darker crescent along its outer, lower part, so the mass
 * reads as two round shoulders and not a shelf.
 */
function roundness(a: Anchors, f: Frame, colour: string): string {
  return both(s => {
    const x = (dist: number) => 50 + s * dist
    const inner = Math.min(a.JW + 7, 42)
    return flat(d`M${x(53)} ${f.edge + 1} C${x(50)} ${f.top + 8} ${x(inner + 3)} ${f.top + 9} ${x(inner)} 101 L${x(53)} 101 Z`, colour)
  })
}

/** A rolled hem along a round neckline. */
function hem(f: Frame, depth: number, colour: string): string {
  return outlined(d`M${50 - f.nw + 1} ${f.top + 0.5} Q50 ${f.top + 2 * depth} ${50 + f.nw - 1} ${f.top + 0.5}`, colour, 2.4)
}

/** A strap's centreline: from `from` out on the side +1 shoulder to `to` out, off the bottom, on −1. */
function strapLine(f: Frame, from: number, to: number): readonly [x0: number, y0: number, x1: number, y1: number] {
  return [50 + from, f.top - 2, 50 - to, 104]
}

/** A strap from the side +1 shoulder down across the chest and off the bottom on side −1. */
function strap(f: Frame, fill: string, dark: string, from: number, to: number, width: number): string {
  const [x0, y0, x1, y1] = strapLine(f, from, to)
  const dx = (width / 2) * 0.86
  const dy = (width / 2) * 0.5
  return (
    shape(d`M${x0 - dx} ${y0 - dy} L${x0 + dx} ${y0 + dy} L${x1 + dx} ${y1 + dy} L${x1 - dx} ${y1 - dy} Z`, fill, W.feature) +
    path(d`M${x0} ${y0 + 1} L${x1} ${y1 + 1}`, { stroke: dark, sw: W.detail, fill: 'none' })
  )
}

/**
 * Mail: staggered rows of rings drawn as scallops, big enough to stay a pattern at 48 px. Kept
 * inside the shirt by `topAt` and clear of the neckline (there are no clip paths), and outside
 * |x − 50| < `skip` (where a tabard covers it).
 */
function rings(f: Frame, skip: number): string {
  let rows = ''
  for (let row = 0; row < 4; row++) {
    const y = f.top + 4 + row * 4.5
    const shift = row % 2 === 0 ? 0 : 3
    for (let x = -1 + shift; x < 101; x += 6) {
      const centre = Math.abs(x + 3 - 50)
      const neckline = centre < f.nw + 3 && y < f.top + 6
      if (centre < skip + 3 || neckline || y - 1 < topAt(f, x) + 2 || y - 1 < topAt(f, x + 6) + 2) continue
      rows += d`M${x} ${y} Q${x + 3} ${y + 4} ${x + 6} ${y} `
    }
  }
  return path(rows.trim(), { stroke: IRON_DARK, sw: W.detail, fill: 'none' })
}

/**
 * The tabard's body and trim: the team colour trimmed in the second, unless the team colour would
 * read as leather (TEAM_HEX's brown, the tone of a harness or vest): at 48 px that tabard read as
 * one, and lost the team cue. Then the second colour takes the body (or, both brown, the next team
 * colour along) and the brown the trim. Only the drawn indices are used, so no draws change.
 */
function tabardColours(look: Look, p: Palette): [body: string, trim: string] {
  const along = TEAM_HEX.map((_, i) => at(TEAM_HEX, look.team + 1 + i))
  const body = [p.team, p.team2, ...along].find(colour => !clashes(colour, p.leather)) ?? p.team
  const trim = body === p.team ? p.team2 : p.team
  return [body, trim === body ? shade(body, -22) : trim]
}

const CLOTHES: Record<ClothingName, (ctx: Ctx, f: Frame) => string> = {
  'burlap-v': (ctx, f) => {
    const { p } = ctx
    const depth = 13
    const chest = flat(d`M${50 - f.nw} ${f.top} L50 ${f.top + depth} L${50 + f.nw} ${f.top} Z`, p.skin)
    const shadow = flat(d`M${50 - f.nw} ${f.top} L50 ${f.top + depth * 0.45} L${50 + f.nw} ${f.top} Z`, p.skinDark)
    return neck(ctx, f) + chest + shadow + sack(ctx, f, vNeck(f, depth))
  },
  'burlap-round': (ctx, f) => neck(ctx, f) + sack(ctx, f, roundNeck(f, 4)) + hem(f, 4, ctx.p.burlapDark),
  'burlap-patched': (ctx, f) => {
    const { a, p } = ctx
    // A pale square of sacking on the side +1 shoulder, cross-stitched on. It sits just under the
    // jaw corner and below the chin's line, whole in the strip under the head: further out, the
    // shoulder's curve took it off the bottom corner. On a long jaw it rides up a little under the
    // jaw corner instead, so its lowest stitch (8.4 below its centre) stays on the canvas.
    const cx = 50 + Math.min(a.JW, 30) - 1
    const cy = Math.min(Math.max(topAt(f, cx) + 7, a.J + 5), 99 - 8.4)
    const patch = mix(p.burlap, '#f6ead0', 0.65)
    const corners = [[-6, -5], [6, -6], [6.5, 5], [-5.5, 6]] as const
    const stitches = corners
      .map(([x, y]) => d`M${cx + x - 1.4} ${cy + y - 1.4} L${cx + x + 1.4} ${cy + y + 1.4} M${cx + x + 1.4} ${cy + y - 1.4} L${cx + x - 1.4} ${cy + y + 1.4}`)
      .join(' ')
    const outline = corners.map(([x, y], i) => (i === 0 ? d`M${cx + x} ${cy + y}` : d`L${cx + x} ${cy + y}`)).join(' ') + ' Z'
    return (
      neck(ctx, f) +
      sack(ctx, f, roundNeck(f, 4)) +
      hem(f, 4, p.burlapDark) +
      shape(outline, patch, W.feature) +
      path(stitches, { sw: W.detail })
    )
  },
  'burlap-rope': (ctx, f) => {
    const { a, p } = ctx
    // A sack gathered at the neck by a drawstring, knotted on side +1 with two loose ends running
    // off the bottom. The knot is big, and hangs below the chin's line (on a long jaw, a little
    // below the drawstring), so it stays a spot of rope at 48 px.
    const knotX = 50 + f.nw * 0.5
    const knotY = Math.max(f.top + 3.2, a.J + 4.5)
    const rope = outlined(d`M${50 - f.nw + 1} ${f.top + 0.5} Q50 ${f.top + 8} ${50 + f.nw - 1} ${f.top + 0.5}`, ROPE, 2.4)
    const ends =
      outlined(d`M${knotX} ${knotY} Q${knotX - 2.5} ${knotY + 6} ${knotX - 1.5} ${knotY + 13}`, ROPE, 2.6) +
      outlined(d`M${knotX} ${knotY} Q${knotX + 3.5} ${knotY + 5} ${knotX + 5} ${knotY + 12}`, ROPE, 2.6)
    // Gathers: short creases fanning down from the drawstring.
    const gathers = [-0.6, -0.25, 0.25].map(t =>
      path(d`M${50 + f.nw * t} ${f.top + 4} L${50 + f.nw * t * 1.3} ${f.top + 9}`, { stroke: p.burlapDark, sw: W.detail }),
    )
    return neck(ctx, f) + sack(ctx, f, roundNeck(f, 4)) + gathers.join('') + rope + ends + circle(knotX, knotY, 3.4, { fill: ROPE, sw: W.detail })
  },
  'burlap-strap': (ctx, f) => {
    const { a, p } = ctx
    // A satchel strap across the chest, with a metal buckle where it passes below the chin: the
    // light spot on the dark strap is what tells it from plain sacking at 48 px.
    const [from, to] = [f.nw + 4, 22]
    const [x0, y0, x1, y1] = strapLine(f, from, to)
    const by = a.J + 7
    const bx = x0 + ((x1 - x0) * (by - y0)) / (y1 - y0)
    const angle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI
    // In the buckle's own frame: x along the strap, y across it (the strap is 7.5 wide).
    const buckle = g(
      shape('M-3 -5.2 L3 -5.2 L3 5.2 L-3 5.2 Z', p.metal, W.detail) + flat('M-1.1 -3 L1.1 -3 L1.1 3 L-1.1 3 Z', p.leatherDark),
      { transform: `translate(${n(bx)} ${n(by)}) rotate(${n(angle)})` },
    )
    return neck(ctx, f) + sack(ctx, f, roundNeck(f, 4)) + hem(f, 4, p.burlapDark) + strap(f, p.leather, p.leatherDark, from, to, 7.5) + buckle
  },
  harness: (ctx, f) => {
    const { p } = ctx
    // Two straps crossing on the chest at a round buckle.
    const one = strap(f, p.leather, p.leatherDark, f.nw + 3, f.nw + 3, 6)
    const straps = one + g(one, { transform: MIRROR })
    const by = f.top + 10
    const buckle = circle(50, by, 4.2, { fill: p.metal, sw: W.feature }) + circle(50, by, 1.6, { fill: p.metalDark, sw: W.detail })
    return chest(ctx, f) + straps + buckle
  },
  vest: (ctx, f) => {
    const { a, p } = ctx
    // Two leather panels over the shoulders, open down the middle over the bare chest.
    const panels = both(s => {
      const x = (dist: number) => 50 + s * dist
      const panel = d`M${x(f.nw - 2)} ${f.top} L${x(9)} 101 L${x(53)} 101 ` + shoulderIn(f, s) + ' Z'
      const lapel = d`M${x(f.nw - 2)} ${f.top} L${x(9)} 101 L${x(14)} 101 L${x(f.nw + 3)} ${f.top} Z`
      return shape(panel, p.leather, W.silhouette) + flat(lapel, p.leatherDark)
    })
    return chest(ctx, f) + panels + roundness(a, f, p.leatherDark)
  },
  mail: (ctx, f) => {
    const { p } = ctx
    return neck(ctx, f) + shape(massPath(f, roundNeck(f, 4)), IRON, W.silhouette) + rings(f, 0) + hem(f, 4, p.leather)
  },
  tabard: (ctx, f) => {
    const { look, p } = ctx
    const [team, trim] = tabardColours(look, p)
    const w = f.nw + 1
    const panel = d`M${50 - w} ${f.top - 2} L${50 - w - 3} 101 L${50 + w + 3} 101 L${50 + w} ${f.top - 2} Z`
    const inner = d`M${50 - w + 3.5} ${f.top} L${50 - w + 1} 101 L${50 + w - 1} 101 L${50 + w - 3.5} ${f.top} Z`
    return (
      neck(ctx, f) +
      shape(massPath(f, roundNeck(f, 4)), IRON, W.silhouette) +
      rings(f, w + 4) +
      shape(panel, trim, W.silhouette) +
      shape(inner, team, W.detail) +
      hem(f, 4, p.leather)
    )
  },
}

/** Layer 3: the neck and the garment over the shoulders, off the bottom and sides. */
export function torso(ctx: Ctx): string {
  const f = frame(ctx.look, ctx.a)
  return CLOTHES[ctx.look.clothing](ctx, f)
}

// Ear hoops --------------------------------------------------------------------------------------
// Where marks.ts hangs the ear hoops, which the pauldrons' spikes and horns keep clear of: a copy of
// its LONE_R, ROW_R, HOOP_GAP, RIMMED, HOOP_REACH, LOBE_RISE, LOBE_CLEAR, onCanvas, hoopsOn, lobeHoop
// and the ears `hoops` hangs them on (under a monocle's chain, the prop's side: CHAINED, below).
// Keep the two in step.

/** An ear hoop on the canvas: its centre and radius. */
interface Hoop {
  c: Pt
  r: number
}

/** A lone hoop's radius, and a row's, root outwards. */
const LONE_R = 4.2
const ROW_R = [3.6, 3.1, 2.7] as const
/** Space between neighbouring rings, beyond their radii. */
const HOOP_GAP = 3
/** The eyewear under which each ear takes one hoop, as far out as it fits. */
const RIMMED: readonly EyewearName[] = ['spectacles', 'goggles', 'pince-nez', 'shades']
/** How far out along an ear's lower edge (root 0, tip 1) a hoop hangs. */
const HOOP_REACH = 0.84
/** How far a droopy ear's ring may climb its lower edge from the lowest point, and what it keeps off the head. */
const LOBE_RISE = 1.5
const LOBE_CLEAR = 1.5
/** Half a ring's outlined width (outlined()'s, round W.detail): from its radius out to its edge. */
const RING_HALF = (W.detail + 2.5) / 2

/** Whether a ring at `c` keeps 1.75 of canvas past its outline. */
function ringFits(c: Pt, r: number): boolean {
  return Math.abs(c[0] - 50) + r + 2.5 <= 48.5 && c[1] + r + 2.5 <= 99
}

/**
 * Up to `radii.length` hoops along this ear's lower edge, root outwards (or tip inwards, `outmost`),
 * each a little out from the edge and down, where it clears the head, the canvas and the last one.
 */
function hoopsOn(ctx: Ctx, side: Side, radii: readonly number[], outmost: boolean): Hoop[] {
  const { look, a } = ctx
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
    if (Math.abs(c[0] - 50) - r < headHalfWidth(look, a, c[1]) - 1 || !ringFits(c, r)) continue
    const last = out[out.length - 1]
    if (last && Math.hypot(c[0] - last.c[0], c[1] - last.c[1]) < last.r + r + HOOP_GAP) continue
    out.push({ c, r })
  }
  return out
}

/**
 * A droopy ear's one ring, dangling straight below its lower edge's lowest point, or moved in along
 * the lobe (no higher than LOBE_RISE) where the canvas or the head leaves no room; it keeps
 * LOBE_CLEAR off the head all round, or there is none.
 */
function lobeHoop(ctx: Ctx, side: Side): Hoop[] {
  const { look, a } = ctx
  const r = LONE_R
  const spots = Array.from({ length: 51 }, (_, i) => earEdge(ctx, side, i / 100))
  const lowest = Math.max(...spots.map(([, y]) => y))
  const clear = (c: Pt) =>
    Array.from({ length: 36 }, (_, i) => (i * Math.PI) / 18).every(turn => {
      const [x, y] = [c[0] + r * Math.cos(turn), c[1] + r * Math.sin(turn)]
      return Math.abs(x - 50) - RING_HALF >= headHalfWidth(look, a, y) + W.silhouette / 2 + LOBE_CLEAR
    })
  for (const [x, y] of spots.slice(spots.findIndex(([, y]) => y === lowest))) {
    if (y < lowest - LOBE_RISE) break
    const c: Pt = [x, y + r - 1]
    if (ringFits(c, r) && clear(c)) return [{ c, r }]
  }
  return []
}

/**
 * The hoops on this ear, each with its radius out to its outline's edge. They hang on side +1's ear,
 * and side −1's with `hoopsBoth`; under a monocle's chain only on the ear away from it. Rimmed
 * eyewear leaves each ear one, as far out as it fits; a droopy ear takes one, from its lobe.
 */
function hoopRings(ctx: Ctx, side: Side): Hoop[] {
  const { look } = ctx
  const chained = CHAINED.includes(look.eyewear)
  const hung = chained ? side === (look.eyewear === 'patch-monocle' ? 1 : -1) : side === 1 || look.hoopsBoth
  if (look.hoops <= 0 || !hung) return []
  const rimmed = RIMMED.includes(look.eyewear)
  const radii = rimmed ? ROW_R.slice(0, 1) : look.hoops === 1 ? [LONE_R] : ROW_R.slice(0, look.hoops)
  const rings = look.ears === 'droopy' ? lobeHoop(ctx, side) : hoopsOn(ctx, side, radii, rimmed)
  return rings.map(({ c, r }) => ({ c, r: r + RING_HALF }))
}

// Shoulders -------------------------------------------------------------------------------------
// Each pauldron is drawn for side +1 in its own coordinates: the origin just outside the jaw
// corner on the shoulder line, +x outward, y down. The inner edge tucks under the jaw (the head is
// drawn over it), so the armour never crosses the neck; the outer half may run off the side edge,
// which a wide jaw leaves only ~15 units of, so the spikes stand on the inner half (TIP_EDGE).

type Pauldron = Exclude<ShoulderName, 'none' | 'fur'>

/**
 * Where each pauldron sits: its origin `inset` in from just outside the jaw corner and `lift` above
 * the shoulder line, its art drawn at `k`× (strokes divided back by `thin`). The iron domes are big
 * and raised: on the shoulder line most of a dome fell off the bottom corner, too small to make a
 * grunt broad. The great pauldron sits a little further in, so more of its one huge dome is on the
 * canvas, and 2 under the shoulder line. The bone skull is 15% smaller than the iron domes, out at
 * the jaw corner and lower: at their size and spot its two skulls were the loudest thing on a
 * grunt at 48 px, two more faces beside his own.
 */
const PLACE: Record<Pauldron, { inset: number; lift: number; k: number }> = {
  spiked: { inset: 4, lift: 4, k: 1.15 },
  plate: { inset: 4, lift: 4, k: 1.15 },
  great: { inset: 2, lift: -2, k: 1.3 },
  bone: { inset: 1, lift: 1, k: 0.98 },
}

/** A stroke width in a pauldron's art: divided back by its scale, so it's drawn at `w`. */
const thin = (kind: Pauldron, w: number) => w / PLACE[kind].k

/** The pauldron's origin on the canvas, at `lift` above the shoulder line. */
function shoulderOrigin(a: Anchors, f: Frame, side: Side, kind: Pauldron, lift: number): Pt {
  return [50 + side * (Math.min(a.JW + 4, 35) - PLACE[kind].inset), f.top - 1 - lift]
}

/**
 * Each pauldron's top, from its inner foot over the crown to its outer foot: what its spikes or
 * horns stand on, and slide along. The bone skull is the spiked one's round dome.
 */
const DOME_ARCH: readonly Curve[] = [[-3, 9, -4, -4, 3, -14, 13, -14], [13, -14, 23, -14, 30, -6, 31, 9]]
const ARCH: Record<Pauldron, readonly Curve[]> = {
  spiked: DOME_ARCH,
  great: [[-3, 2, -4, -9, 3, -16, 12, -16], [12, -16, 21, -16, 27, -9, 28, 3]],
  plate: [[-3, 0, -4, -9, 3, -15, 13, -15], [13, -15, 23, -15, 30, -8, 31, 1]],
  bone: DOME_ARCH,
}

/** An arch as path data, from a move to its inner foot. */
function archData(arch: readonly Curve[]): string {
  const [x = 0, y = 0] = arch[0] ?? []
  return [`M${x} ${y}`, ...arch.map(curve => `C${curve.slice(2).join(' ')}`)].join(' ')
}

/** The arch's top at x. */
function archY(arch: readonly Curve[], x: number): number {
  const [inner = [], outer = []] = arch
  return yAtX(x <= (inner[6] ?? 0) ? inner : outer, x)
}

/** A round iron dome, its rim, and the shine on its inner shoulder. */
const DOME = `${archData(DOME_ARCH)} C21 13 6 13 -3 9 Z`
const RIM = 'M-3 9 C6 13 21 13 31 9 L31 14 C21 18 6 18 -3.5 14 Z'
const SHINE = 'M1 -3 C3 -9 8 -12 14 -12 C9 -10 6 -7 4.5 -1 Z'

/**
 * The bone pauldron's parts on the DOME: a horned beast's skull over the leather pad's band (its
 * ends run into the dome's outline, which covers them). The skull is aged bone, its lower half
 * (the face below the brow) and its outer side in shadow, so it sits back as costume behind the
 * orc's own face; the horns are a shade lighter. Its face sits in the part of the dome every head
 * leaves on the canvas: past x 16, the widest jaw's skull runs off the side edge. Two slanted
 * sockets and a nose hole, dark in the bone, and a row of teeth along the cap's lower edge, light
 * on the dark pad, are what read as a skull at 48 px.
 */
const SKULL = '#cdbf9a'
const SKULL_SHADE = '#a8996f'
const HORN = '#ddd1ae'
const HOLE = '#2a221d'
const PAD = 'M-4.5 3.5 C6 7.5 21 7.5 32 3.5 L32 9 C21 13 6 13 -3 9 Z'
const CAP_EDGE = 'M-3.4 3.6 C6 7.5 21 7.5 30.9 3.6'
const CAP_SHADE = 'M31 4 C30 -6 24 -12.5 17 -13.8 C22 -10.5 25.5 -5 26 5.2 Z'
/** The shadowed lower half of the skull, from just under the sockets' middles down to the pad. */
const FACE_SHADE = 'M-4.5 -2.5 C6 0.5 21 0.5 32 -2.5 L32 3.5 C21 7.5 6 7.5 -4.5 3.5 Z'
/**
 * A socket centred on (x, y), its top edge sloping down to its inner end (toward the skull's
 * middle, at `toward`): a glare. Round, as a skull's are (small dots read as a cute face), but at
 * 0.8 of the size first drawn: black and that big on bone, they outstared the orc's own eyes.
 */
function socket(x: number, y: number, toward: Side): string {
  const pt = (dx: number, dy: number) => d`${x + toward * dx * 0.8} ${y + dy * 0.8}`
  return [
    `M${pt(2.3, -0.4)} C${pt(0.9, -1.9)} ${pt(-1.2, -2.8)} ${pt(-2.2, -2.1)}`,
    `C${pt(-2.9, -1.4)} ${pt(-2.7, 1.4)} ${pt(-1.9, 2.2)}`,
    `C${pt(-0.7, 3)} ${pt(1.4, 2.8)} ${pt(2.2, 1.6)}`,
    `C${pt(2.6, 0.9)} ${pt(2.6, 0.1)} ${pt(2.3, -0.4)} Z`,
  ].join(' ')
}
const SOCKETS = socket(6.4, -3.6, 1) + ' ' + socket(13.2, -3.6, -1)
/** The nose hole between and below the sockets: an upturned heart. */
const NASAL = 'M9.8 -0.2 C10.7 0.8 11.5 2 11.2 3 Q10.5 3.6 9.8 2.9 Q9.1 3.6 8.4 3 C8.1 2 8.9 0.8 9.8 -0.2 Z'
/**
 * The skull's upper teeth, hanging over the dark pad from the cap's lower edge (each top at the
 * edge's y there, so the edge's stroke covers its outline).
 */
const TEETH = ([[5.6, 6], [9.7, 6.4], [13.8, 6.5]] as const)
  .map(([x, y]) => d`M${x - 1.6} ${y} L${x + 1.6} ${y} L${x + 1.2} ${y + 3.2} Q${x} ${y + 4.4} ${x - 1.2} ${y + 3.2} Z`)
  .join(' ')
/**
 * A spike or horn a pauldron raises toward the ear, in the pauldron's frame: its path, its tip, the
 * x of its foot on the dome, and points round its outline (what must keep clear of an ear hoop).
 */
interface Riser {
  data: string
  tip: Pt
  foot: number
  outline: readonly Pt[]
}

/** Where along each edge of a spike or horn its outline is sampled. */
const ALONG = Array.from({ length: 9 }, (_, i) => i / 8)

/** A spike standing on (x, y), its tip at (tx, ty), `w` either side at the root. */
type Spike = readonly [x: number, y: number, tx: number, ty: number, w: number]

function spike([x, y, tx, ty, w]: Spike): Riser {
  const tip: Pt = [tx, ty]
  const from: Pt = [x - w, y + 1]
  const up: Pt = [(x + tx) / 2 - w * 0.4, (y + ty) / 2]
  const down: Pt = [(x + tx) / 2 + w * 0.4, (y + ty) / 2]
  const to: Pt = [x + w, y]
  return {
    data: d`M${from[0]} ${from[1]} Q${up[0]} ${up[1]} ${tx} ${ty} Q${down[0]} ${down[1]} ${to[0]} ${to[1]} Z`,
    tip,
    foot: x,
    outline: ALONG.flatMap(t => [quadAt(from, up, tip, t), quadAt(tip, down, to, t)]),
  }
}

/** A horn: a cubic up its inner edge to the tip, and one back down its outer edge. */
type Horn = readonly [from: Pt, c1: Pt, c2: Pt, tip: Pt, c3: Pt, c4: Pt, to: Pt]

function horn([from, c1, c2, tip, c3, c4, to]: Horn): Riser {
  const xy = ([x, y]: Pt) => d`${x} ${y}`
  return {
    data: `M${xy(from)} C${xy(c1)} ${xy(c2)} ${xy(tip)} C${xy(c3)} ${xy(c4)} ${xy(to)} Z`,
    tip,
    foot: (from[0] + to[0]) / 2,
    outline: ALONG.flatMap(t => [cubicAt(from, c1, c2, tip, t), cubicAt(tip, c3, c4, to, t)]),
  }
}

/**
 * The two horns, thick at the root so they stay bone at 48 px, short and curving in toward the
 * head: upright they read as a rabbit's ears, and tall, beside the jaw, as a second pair of tusks.
 */
const HORNS: readonly Riser[] = ([
  [[1.6, -9], [1.2, -15], [0.6, -19], [-0.8, -23], [3.8, -20.5], [8, -16.5], [9.6, -11.4]],
  [[9.6, -12], [10, -18], [9.6, -22], [8.2, -26], [12.8, -23], [16, -18.5], [16.4, -12]],
] as const).map(horn)

/**
 * The spikes on the spiked dome and the great pauldron. A droopy ear's lobe hangs over their top,
 * where these stand, and hid them (on a bean, both of the spiked dome's): under one they're short,
 * the outer one leaning out, and the pauldron sinks until their tips show below the lobe (`seatFor`).
 */
const SPIKES: Record<'spiked' | 'great', { tall: readonly Riser[]; short: readonly Riser[] }> = {
  spiked: {
    tall: ([[4, -11, 2, -25, 3.6], [12, -12, 12, -26, 3.6]] as const).map(spike),
    short: ([[4, -11, 3.5, -20.5, 3.8], [12, -12.5, 14, -20.5, 3.8]] as const).map(spike),
  },
  great: { tall: [spike([8, -14, 6, -25, 3.6])], short: [spike([8, -14, 9.5, -21.5, 3.8])] },
}

/** What a pauldron raises toward the ear: horns, or spikes (the short ones under a droopy ear). */
function risersOf(kind: Pauldron, look: Look): readonly Riser[] {
  if (kind === 'plate') return []
  if (kind === 'bone') return HORNS
  return SPIKES[kind][look.ears === 'droopy' ? 'short' : 'tall']
}

/** How far a spike or horn standing on `foot` moves to slide `slide` out along the pauldron's top: [dx, dy]. */
function along(kind: Pauldron, foot: number, slide: number): Pt {
  return [slide, archY(ARCH[kind], foot + slide) - archY(ARCH[kind], foot)]
}

/** Where a pauldron sits: its lift above the shoulder line, and how far out its spikes or horns slide. */
interface Seat {
  lift: number
  slide: number
}

/** The furthest out (canvas x) a spike's or horn's tip stands, its outline still on the canvas. */
const TIP_EDGE = 97
/** The step, in the pauldron's units, its spikes or horns slide out by. */
const SLIDE_STEP = 0.5
/** How far a spike or horn keeps from an ear hoop's outer edge, outline to outline. */
const HOOP_CLEAR = 2
/**
 * The furthest a pauldron sinks below the shoulder line (its origin's lift), to clear a droopy lobe
 * or ear hoops. Past it too little of the dome is left on the canvas to make a grunt broad.
 */
const SINK_FLOOR = 12

/**
 * How far below its lift the pauldron must sink so that, standing where `placed` puts them on the
 * canvas, every tip keeps its outline 1 clear of a droopy lobe's (the lobe's lowest point within
 * 2.5 of the tip, its pointed end included), and every outline point HOOP_CLEAR off each hoop.
 */
function sinkFor(placed: readonly { tip: Pt; outline: readonly Pt[] }[], lobe: readonly Pt[], hoops: readonly Hoop[]): number {
  let sink = 0
  for (const { tip } of placed) {
    const over = lobe.filter(([ex]) => Math.abs(ex - tip[0]) < 2.5).map(([, ey]) => ey)
    if (over.length > 0) sink = Math.max(sink, Math.max(...over) + W.silhouette / 2 + 1 + W.feature / 2 - tip[1])
  }
  // Each point lies inside a hoop's clearance for a span of sinks; step past every span it's in.
  const spans = placed.flatMap(({ outline }) =>
    outline.flatMap(([x, y]) =>
      hoops.flatMap(({ c: [cx, cy], r }) => {
        const reach = r + HOOP_CLEAR + W.feature / 2
        const h = Math.sqrt(Math.max(0, reach * reach - (x - cx) ** 2))
        return h > 0 ? [[cy - h - y, cy + h - y] as const] : []
      }),
    ),
  )
  for (let moved = true; moved; ) {
    moved = false
    for (const [lo, hi] of spans) {
      if (lo < sink && sink < hi) {
        sink = hi
        moved = true
      }
    }
  }
  return sink
}

/**
 * Where the pauldron sits. Its own lift, unless a droopy lobe or an ear hoop hangs where its spikes
 * or horns rise: at 48 px a spike behind a hoop read as the hoop's chain, or the hoops as rivets on
 * a lattice. Then they slide out along the dome toward the canvas edge (TIP_EDGE), as little as
 * clears them; where no slide does, they stay put and the pauldron sinks instead, as far as it must
 * (down to SINK_FLOOR). Both shoulders sit the same, clear of the hoops on either ear (the great
 * pauldron is on side +1 only).
 */
function seatFor(ctx: Ctx, f: Frame, kind: Pauldron): Seat {
  const { lift, k } = PLACE[kind]
  const risers = risersOf(kind, ctx.look)
  const lobe = ctx.look.ears === 'droopy' ? Array.from({ length: 21 }, (_, i) => earEdge(ctx, 1, i / 20)) : []
  // Side −1's hoops, mirrored onto side +1's shoulder, which both pauldrons copy.
  const facing = kind === 'great' ? [] : hoopRings(ctx, -1).map(({ c: [x, y], r }) => ({ c: [100 - x, y] as const, r }))
  const hoops = [...hoopRings(ctx, 1), ...facing]
  if (risers.length === 0 || (lobe.length === 0 && hoops.length === 0)) return { lift, slide: 0 }
  const [ox, oy] = shoulderOrigin(ctx.a, f, 1, kind, lift)
  const onCanvas = ([x, y]: Pt, [dx, dy]: Pt): Pt => [ox + k * (x + dx), oy + k * (y + dy)]
  // The spikes or horns slid `slide` out, on the canvas: each tip, and the outline the dome leaves.
  const placedAt = (slide: number) =>
    risers.map(riser => {
      const shift = along(kind, riser.foot, slide)
      const shows = riser.outline.filter(([x, y]) => y + shift[1] < archY(ARCH[kind], x + shift[0]))
      return { tip: onCanvas(riser.tip, shift), outline: shows.map(point => onCanvas(point, shift)) }
    })
  const sink = sinkFor(placedAt(0), lobe, hoops)
  if (sink === 0) return { lift, slide: 0 }
  for (let slide = SLIDE_STEP; ; slide += SLIDE_STEP) {
    const placed = placedAt(slide)
    if (placed.some(({ tip }) => tip[0] > TIP_EDGE)) break
    if (sinkFor(placed, lobe, hoops) === 0) return { lift, slide }
  }
  return { lift: Math.max(-SINK_FLOOR, lift - sink), slide: 0 }
}

const PAULDRONS: Record<Pauldron, (ctx: Ctx) => string> = {
  spiked: () =>
    shape(DOME, IRON, thin('spiked', W.silhouette)) +
    flat(SHINE, IRON_LIGHT) +
    shape(RIM, IRON_DARK, thin('spiked', W.feature)),
  // One huge pauldron (side +1 only): three lames and a spike.
  great: () =>
    shape(`${archData(ARCH.great)} C18 7 6 7 -3 2 Z`, IRON, thin('great', W.silhouette)) +
    flat('M0.5 -6 C2 -11 6 -14 12 -14 C7 -12 4.5 -9 3 -4 Z', IRON_LIGHT) +
    shape('M-3 2 C6 7 18 7 28 3 L28 8 C18 12 6 12 -3.5 7 Z', IRON, thin('great', W.feature)) +
    shape('M-3.5 7 C6 12 18 12 28 8 L28 13 C18 17 6 17 -4 12 Z', IRON_DARK, thin('great', W.feature)) +
    circle(3, -1, 1.1, { fill: O, stroke: 'none' }) +
    circle(12, 0.5, 1.1, { fill: O, stroke: 'none' }),
  // Riveted plates: a cap and two lames, with a row of rivets on each.
  plate: () =>
    shape(`${archData(ARCH.plate)} C21 5 6 5 -3 0 Z`, IRON, thin('plate', W.silhouette)) +
    flat('M1 -6 C3 -11 8 -13 14 -13 C9 -11 6 -8 4.5 -4 Z', IRON_LIGHT) +
    shape('M-3 0 C6 5 21 5 31 1 L31 7 C21 11 6 11 -3.5 6 Z', IRON, thin('plate', W.feature)) +
    shape('M-3.5 6 C6 11 21 11 31 7 L31 13 C21 17 6 17 -4 12 Z', IRON_DARK, thin('plate', W.feature)) +
    [[3, -8], [11, -10], [4, 4.5], [12, 6], [4, 10.5], [12, 12]]
      .map(([x = 0, y = 0]) => circle(x, y, 1.3, { fill: O, stroke: 'none' }))
      .join(''),
  // A horned beast's skull on a dark leather pad. A brown leather dome with bone only in the horns
  // melted into a fur mantle or vest at 48 px (acorns, a bear); a plain cream cap read as baking
  // whatever was on it (upright stitches: a muffin in its case; a cross of lashing: a hot cross
  // bun). The skull's face is what says bone.
  bone: ({ p }) =>
    // The dome is filled, banded and shaded, then outlined last over the flat parts' ends.
    flat(DOME, SKULL) +
    flat(CAP_SHADE, SKULL_SHADE) +
    flat(FACE_SHADE, SKULL_SHADE) +
    flat(PAD, p.leatherDark) +
    shape(TEETH, SKULL, thin('bone', W.detail)) +
    path(DOME, { fill: 'none', sw: thin('bone', W.silhouette) }) +
    path(CAP_EDGE, { fill: 'none', sw: thin('bone', W.feature) }) +
    flat(SOCKETS, HOLE) +
    flat(NASAL, HOLE) +
    shape(RIM, p.leatherDark, thin('bone', W.feature)),
}

/** Bumps along a run of points: each segment bulges out by `puff` (positive bulges up). */
function fluff(points: readonly (readonly [number, number])[], puff: number): string {
  let out = ''
  for (let i = 1; i < points.length; i++) {
    const [x0 = 0, y0 = 0] = points[i - 1] ?? []
    const [x1 = 0, y1 = 0] = points[i] ?? []
    // The segment's normal, turned to point up.
    const len = Math.hypot(x1 - x0, y1 - y0) || 1
    let nx = (y1 - y0) / len
    let ny = -(x1 - x0) / len
    if (ny > 0) {
      nx = -nx
      ny = -ny
    }
    out += d` Q${(x0 + x1) / 2 + nx * puff} ${(y0 + y1) / 2 + ny * puff} ${x1} ${y1}`
  }
  return out
}

/**
 * The fur mantle: a shaggy pelt over each shoulder, from under the jaw out off the side edges,
 * open down the chest so the garment shows, with tufts hanging along the bottom.
 */
function furMantle(ctx: Ctx): string {
  const { a, p, look } = ctx
  const f = frame(look, a)
  return both(s => {
    const x = (dist: number) => 50 + s * dist
    // The top: lumps rising from under the jaw corner and rolling out over the shoulder.
    const top: [number, number][] = [
      [x(a.JW - 3), a.M + 3],
      [x(a.JW + 3), a.M + 5],
      [x(a.JW + 9), a.M + 10],
      [x(a.JW + 15), f.top - 3],
      [x(56), f.top + 1],
    ]
    // The bottom: tufts from the side edge back in to the chest.
    const inner = f.nw + 3
    const bottom: string[] = []
    const steps = 7
    for (let i = 0; i <= steps; i++) {
      const dist = 56 - ((56 - inner) * i) / steps
      const y = f.top + 12 + (i % 2 === 0 ? 0 : 3.5) - i * 0.3
      bottom.push(d`L${x(dist)} ${y}`)
    }
    const pelt = [
      d`M${x(a.JW - 3)} ${a.M + 3}`,
      fluff(top, 3),
      bottom.join(' '),
      d`L${x(inner - 1)} ${f.top - 4}`,
      'Z',
    ].join(' ')
    // A few lighter locks of fur.
    const locks = [0.25, 0.5, 0.75]
      .map(t => {
        const dist = a.JW + 2 + (54 - a.JW - 2) * t
        const y = f.top + 2 + t * 2
        return path(d`M${x(dist)} ${y} Q${x(dist + 1.5)} ${y + 3} ${x(dist + 0.5)} ${y + 6}`, { stroke: p.furLight, sw: W.feature, fill: 'none' })
      })
      .join('')
    // The lit top of the pelt: the same lumps, closed along a line a few units below them.
    const [first = [0, 0], ...rest] = top
    const lit =
      d`M${first[0]} ${first[1]}` + fluff(top, 3) + ' ' +
      [...rest].reverse().map(([px, py]) => d`L${px} ${py + 4}`).join(' ') + d` L${first[0]} ${first[1] + 4} Z`
    return shape(pelt, p.fur, W.silhouette) + flat(lit, p.furLight) + locks
  })
}

/**
 * Layer 4: grunt shoulder armour, outside the neck; the head is drawn over its inner end. Spikes and
 * horns stand behind the dome, which covers their roots.
 */
export function shoulders(ctx: Ctx): string {
  const { a, look } = ctx
  const kind = look.shoulders
  if (kind === 'none') return ''
  if (kind === 'fur') return furMantle(ctx)
  const f = frame(look, a)
  const { lift, slide } = seatFor(ctx, f, kind)
  const risers = risersOf(kind, look).map(riser => {
    const [dx, dy] = along(kind, riser.foot, slide)
    const art = shape(riser.data, kind === 'bone' ? HORN : IRON_LIGHT, thin(kind, W.feature))
    return slide === 0 ? art : g(art, { transform: `translate(${n(dx)} ${n(dy)})` })
  })
  const art = risers.join('') + PAULDRONS[kind](ctx)
  const { k } = PLACE[kind]
  const place = (side: Side) => {
    const [x, y] = shoulderOrigin(a, f, side, kind, lift)
    return g(art, { transform: `translate(${n(x)} ${n(y)}) scale(${side * k} ${k})` })
  }
  return kind === 'great' ? place(1) : both(place)
}

// Neckwear ----------------------------------------------------------------------------------------
// Drawn under the head: only what hangs below the chin shows, so everything hangs from just under
// it (J, COLLAR), where even a long jaw leaves a strip of 13 units.

/**
 * A curve hanging under the chin from behind the jaw, lowest (at x 50) at `low`: a cord, or a
 * band's top edge. Returns its path and its y at any x.
 */
function sling(a: Anchors, low: number, spread = 8): { d: string; y: (x: number) => number } {
  const half = a.JW - spread
  const y0 = a.J - 6
  return {
    d: d`M${50 - half} ${y0} Q50 ${2 * low - y0} ${50 + half} ${y0}`,
    y: (x: number) => {
      const t = Math.min(1, Math.max(0, (x - 50 + half) / (2 * half)))
      return y0 + 4 * t * (1 - t) * (low - y0)
    },
  }
}

/** A band round the neck: `sling` thickened downward by `w`. */
function band(a: Anchors, low: number, w: number, spread = 8): string {
  const half = a.JW - spread
  const y0 = a.J - 6
  return d`M${50 - half} ${y0} Q50 ${2 * low - y0} ${50 + half} ${y0} L${50 + half} ${y0 + w} Q50 ${2 * low - y0 + w} ${50 - half} ${y0 + w} Z`
}

/** A fang hanging from (x, y), `len` long and `w` either side at the root, its tip curling toward `lean`. */
function fang(x: number, y: number, len: number, lean: number, w: number): string {
  return d`M${x - w} ${y} C${x - w + 0.2} ${y + len * 0.45} ${x + lean - 0.27 * w} ${y + len * 0.75} ${x + lean} ${y + len} C${x + lean + 0.64 * w} ${y + len * 0.65} ${x + w} ${y + len * 0.35} ${x + w} ${y} Z`
}

/** What a cravat lies on: the bare chest in a V or an open garment, else the garment. */
function chestUnder(look: Look, p: Palette): string {
  if (look.clothing === 'burlap-v' || look.clothing === 'harness' || look.clothing === 'vest') return p.skin
  if (look.clothing === 'mail') return IRON
  if (look.clothing === 'tabard') return tabardColours(look, p)[0]
  return p.burlap
}

/**
 * The cravat's silk: `look.neckColour`'s, or the first one along from it that stands off what it
 * lies on and the chin above it (wine on a red tabard, violet on a purple one). Only the drawn
 * index is used, so no draws change.
 */
function silk(look: Look, p: Palette): string {
  const under = chestUnder(look, p)
  const wears = (colour: string) => !clashes(colour, under) && !clashes(colour, p.skin)
  return SILK_HEX.map((_, i) => at(SILK_HEX, look.neckColour + i)).find(wears) ?? SILK_HEX[0]
}

const NECKWEAR: Record<NeckwearName, Draw> = {
  none: () => '',
  'bow-tie': ({ a, look }) => {
    const colour = at(BOW_HEX, look.neckColour)
    const y = a.COLLAR
    const wings = both(s => {
      const x = (dist: number) => 50 + s * dist
      return (
        shape(d`M${x(1)} ${y} L${x(12)} ${y - 6} Q${x(14.5)} ${y} ${x(12)} ${y + 6} Z`, colour, W.feature) +
        flat(d`M${x(3)} ${y + 0.5} L${x(11)} ${y + 4.4} L${x(11.8)} ${y + 1.6} Z`, shade(colour, -16))
      )
    })
    return wings + shape(d`M46.5 ${y - 3.5} L53.5 ${y - 3.5} L54 ${y + 3.5} L46 ${y + 3.5} Z`, shade(colour, -6), W.feature)
  },
  // A gentleman's silk stock: a band of silk wound round the neck and knotted under the chin, its
  // two blades crossed below the knot. The back one falls short to side −1, in shadow; the front
  // one hangs lower across it to side +1, with a sheen down it and a pin through it. It fills the
  // strip under the chin and ends above the canvas's edge, so all of it shows even on a long jaw.
  // A pale jabot there, hemmed in scallops, read at 48 px as a tooth or a scrap of bone.
  cravat: ({ a, look, p }) => {
    const colour = silk(look, p)
    const y = a.J
    const bottom = Math.min(y + 15, 97)
    // The knot's foot: 5 under the chin, less on a long jaw so the blades keep 6 below it.
    const foot = Math.min(y + 5, bottom - 6)
    const w = 10.5
    // Each blade swells out from under the knot and tapers to a blunt point: rounded, a red one
    // hanging under the chin read as a tongue.
    const back = [
      d`M${X(1, 1)} ${foot - 1} C${X(-1, 5)} ${foot} ${X(-1, w)} ${bottom - 8} ${X(-1, w)} ${bottom - 5}`,
      d`L${X(-1, w - 3)} ${bottom - 1.5} Q${X(-1, 2)} ${bottom - 2.5} 50 ${foot + 3} Z`,
    ].join(' ')
    const front = [
      d`M${X(-1, 3.5)} ${foot - 1} L${X(1, 4)} ${foot - 1}`,
      d`C${X(1, 7)} ${foot + 1} ${X(1, w)} ${bottom - 7} ${X(1, w)} ${bottom - 3.5}`,
      d`L${X(1, w - 4.5)} ${bottom} Q${X(-1, 0.5)} ${bottom - 0.8} ${X(-1, 1.5)} ${bottom - 3}`,
      d`C${X(-1, 2.5)} ${bottom - 6} ${X(-1, 2.5)} ${foot + 2} ${X(-1, 3.5)} ${foot - 1} Z`,
    ].join(' ')
    const sheen = [
      d`M${X(1, 3.5)} ${foot + 0.8}`,
      d`C${X(1, 6.5)} ${foot + 2.2} ${X(1, w - 2.5)} ${bottom - 7} ${X(1, w - 2)} ${bottom - 3.8}`,
      d`C${X(1, w - 4)} ${bottom - 6.5} ${X(1, 5.5)} ${foot + 3.4} ${X(1, 3.5)} ${foot + 0.8} Z`,
    ].join(' ')
    const knot = [
      d`M${X(-1, 5)} ${y - 1.5} L${X(1, 5)} ${y - 1.5}`,
      d`Q${X(1, 5.6)} ${foot - 0.6} ${X(1, 4)} ${foot} Q50 ${foot + 0.9} ${X(-1, 4)} ${foot}`,
      d`Q${X(-1, 5.6)} ${foot - 0.6} ${X(-1, 5)} ${y - 1.5} Z`,
    ].join(' ')
    return (
      shape(band(a, y + 3, 5, 5), shade(colour, -6), W.feature) +
      shape(back, shade(colour, -12), W.feature) +
      shape(front, colour, W.feature) +
      flat(sheen, shade(colour, 14)) +
      shape(knot, shade(colour, -8), W.detail) +
      circle(X(1, 2), foot + 2.8, 1.8, { fill: p.metal, stroke: 'none' })
    )
  },
  // Trophy fangs on a leather thong slung low on the chest: three big ones with metal beads
  // between, each turned out along the thong's curve. Five small fangs in a tight row on a cord
  // hugging the chin, all pointing down, read as a lower row of teeth (on a red tabard, a second
  // mouth), so these are few, spaced and splayed, on a thong that shows.
  'tooth-necklace': ({ a, p }) => {
    // The thong dips 4 below the chin, clear of its outline; on a long jaw it stops at y 89.5 and
    // the fangs shorten instead, ending by y 98.
    const low = Math.min(a.J + 4, 89.5)
    const c = sling(a, low, 6)
    const slope = (x: number) => c.y(x + 0.5) - c.y(x - 0.5)
    const hung = ([[0, 11, 3.3], [11, 9.5, 2.9], [-11, 9.5, 2.9]] as const).map(([dx, len, w]) => {
      // Drawn hanging from the origin, then turned square to the thong; the tip curls outward.
      const y = c.y(50 + dx)
      const art = shape(fang(0, -0.5, Math.min(len, 98 - y), Math.sign(dx) * 1.2, w), BONE, W.detail)
      const turn = (Math.atan(slope(50 + dx)) * 180) / Math.PI
      return g(art, { transform: `translate(${n(50 + dx)} ${n(y)}) rotate(${n(turn)})` })
    })
    const beads = [-5.25, 5.25].map(dx => circle(50 + dx, c.y(50 + dx), 1.7, { fill: p.metal, sw: W.detail }))
    // The fangs over the thong, roots and all, so as much bone shows as the strip allows.
    return outlined(c.d, p.leather, 2) + hung.join('') + beads.join('')
  },
  // A round medallion right under the chin: a bright metal disc with a glint and a gem, big enough
  // to stay a spot of colour at 48 px (a diamond at W.feature was mostly outline).
  amulet: ({ a, look, p }) => {
    const low = a.J + 3
    const c = sling(a, low, 10)
    const r = 5
    // Hung from the cord's lowest point, but whole (outline included) on a long jaw.
    const hung = low + 1 + r
    const y = Math.min(hung, 99 - r - W.detail / 2)
    // A full beard covers the cord and hangs over the pendant's top. Where the jaw leaves the
    // pendant no room to hang (it rides up onto the canvas's edge), only its lower half showed
    // under the beard's hem: a gold scrap on the bottom edge. There it's left off.
    if (look.beard === 'full' && y < hung) return ''
    // The accent, unless it would melt into the metal (gold on gold, cream on silver).
    const melts = clashes(p.accent, p.metal) || (toHsl(p.accent)[2] > 70 && toHsl(p.metal)[2] > 70)
    const gem = melts ? GEM : p.accent
    // Lit from the upper right, like the monocle (the flip shows it upper left).
    const glint = d`M${50 + 3.9} ${y - 0.8} Q${50 + 3.3} ${y - 3.3} ${50 + 0.8} ${y - 3.9} L${50 + 0.7} ${y - 2.9} Q${50 + 2.5} ${y - 2.5} ${50 + 2.9} ${y - 0.7} Z`
    return (
      outlined(c.d, p.leather, 2) +
      circle(50, y, r, { fill: p.metal, sw: W.detail }) +
      flat(glint, p.metalLight) +
      circle(50, y + 0.3, 2.2, { fill: gem, stroke: 'none' })
    )
  },
  'spiked-collar': ({ a, p }) => {
    const low = a.J + 3
    const w = 5
    const top = sling(a, low, 6)
    const spikes = [-12, -6, 0, 6, 12].map(dx => {
      const x = 50 + dx
      const y = top.y(x) + w - 0.5
      return shape(d`M${x - 2.6} ${y} L${x + dx * 0.12} ${y + 6.5} L${x + 2.6} ${y} Z`, p.metalLight, W.feature)
    })
    const studs = [-9, -3, 3, 9].map(dx => circle(50 + dx, top.y(50 + dx) + w / 2, 1, { fill: p.metalLight, stroke: 'none' }))
    return spikes.join('') + shape(band(a, low, w, 6), p.leatherDark, W.feature) + studs.join('')
  },
  // A team scarf: a fat wrap round the neck and a striped tail hanging on side −1.
  scarf: ({ a, p }) => {
    const trim = p.team2 === p.team ? shade(p.team, -22) : p.team2
    const low = a.J + 4
    const edge = sling(a, low, 5)
    const tx = 50 - 8
    const ty = low + 2
    // The tail widens from 4 to 5.5 either side of tx as it hangs.
    const hw = (y: number) => 4 + (1.5 * (y - ty)) / (101 - ty)
    const tail = d`M${tx - hw(ty)} ${ty} L${tx + hw(ty)} ${ty} L${tx + hw(101)} 101 L${tx - hw(101)} 101 Z`
    const sy = ty + 5
    const stripe = d`M${tx - hw(sy)} ${sy} L${tx + hw(sy)} ${sy} L${tx + hw(sy + 3)} ${sy + 3} L${tx - hw(sy + 3)} ${sy + 3} Z`
    return (
      shape(tail, p.team, W.feature) +
      flat(stripe, trim) +
      shape(band(a, low, 7, 5), p.team, W.feature) +
      path(d`M38 ${edge.y(38) + 3.5} Q50 ${low + 6} 62 ${edge.y(62) + 3.5}`, { stroke: trim, sw: W.feature, fill: 'none' })
    )
  },
}

/** Layer 5: neckwear under the chin (bow tie, cravat, necklaces, collar, scarf). */
export function neckwear(ctx: Ctx): string {
  return NECKWEAR[ctx.look.neckwear](ctx)
}

// Props -----------------------------------------------------------------------------------------

/**
 * Layer 1: the pickaxe. Its handle rises from behind the side −1 shoulder, close beside the jaw, to
 * an iron head beside the skull (or the cheek, under a horned helm); the ears, head and hat are
 * drawn over it.
 */
export function backProp(ctx: Ctx): string {
  const { a, look } = ctx
  if (look.prop !== 'pickaxe') return ''
  // A horned helm's horn fills the spot beside the skull, and the ear the one below it, so there
  // the pick rides low, its blade beside the cheek under the ear (even a droopy one, which hangs to
  // about earY + 12). Elsewhere it stands beside the skull, but an ear whose tip rises that high
  // (bat, or a long one) would hide all of it but a nub: there it lifts until its points (9.3 below
  // its centre, outline included) clear the tip, but no higher than keeps its collar (8 above) at
  // y 2.
  const tipY = earEdge(ctx, -1, 0)[1]
  const top =
    look.hat === 'horned-helm'
      ? { x: 20, y: a.earY + 17 }
      : { x: Math.max(50 - a.SW - 8, 20), y: Math.min(Math.max(15, a.C - 2), Math.max(10, tipY - 9.3)) }
  const bottom = { x: 50 - a.JW - 4, y: 100 }
  // The handle's lean from upright, in radians: it turns the head's own frame (handle along +y).
  const lean = () => Math.atan2(top.x - bottom.x, bottom.y - top.y)
  // The head's outer point, (−17, 8) in its frame, keeps its outline 3 inside the edge: the lean
  // swung it out to x 2.5, flattened on the edge. Moving the head in leans the handle a little
  // more, which swings the point back out a fraction (most on a horned helm's short handle), so a
  // few passes settle it.
  for (let pass = 0; pass < 3; pass++) {
    const outer = top.x - 17 * Math.cos(lean()) - 8 * Math.sin(lean())
    top.x += Math.max(0, 3 + W.feature / 2 - outer)
  }
  const len = Math.hypot(bottom.x - top.x, bottom.y - top.y)
  const ux = (top.x - bottom.x) / len
  const uy = (top.y - bottom.y) / len
  const angle = (lean() * 180) / Math.PI
  const handle = outlined(d`M${bottom.x} ${bottom.y} L${top.x + ux * 4} ${top.y + uy * 4}`, WOOD, 3.8, 'butt')
  // A big crescent of iron, both points curving down toward the handle, through a narrow collar.
  const head =
    shape('M-17 8 C-12 -2 -6 -5.5 0 -5.5 C6 -5.5 12 -2 17 8 C11 3 6 1.5 0 1.5 C-6 1.5 -11 3 -17 8 Z', IRON, W.feature) +
    flat('M-11 0.5 C-7 -2.6 -3.5 -3.6 0 -3.6 C3.5 -3.6 7 -2.6 11 0.5 C7 -1.4 3.5 -1.9 0 -1.9 C-3.5 -1.9 -7 -1.4 -11 0.5 Z', IRON_LIGHT) +
    shape('M-2.4 -6.5 L2.4 -6.5 L2.4 2.5 L-2.4 2.5 Z', IRON_DARK, W.detail)
  return handle + g(head, { transform: `translate(${n(top.x)} ${n(top.y)}) rotate(${n(angle)})` })
}

/** The cigar's tilt, down and out, in degrees. */
const CIGAR_TILT = 18

/** A straight stem from (−1, 0) to (x1, y1), cut to start at `from`: square-ended when cut. */
function stem(from: number, x1: number, y1: number, colour: string, w: number): string {
  const y0 = ((from + 1) * y1) / (x1 + 1)
  return outlined(d`M${from} ${y0} L${x1} ${y1}`, colour, w, from > -1 ? 'butt' : 'round')
}

/** The point at t along the quadratic p0 → p2 (control p1). */
function quadAt(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]
}

/** The quadratic p0 → p2 (control p1), cut to start where it reaches x = from (its x only grows). */
function quadFrom(p0: Pt, p1: Pt, p2: Pt, from: number): string {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 20 && from > p0[0]; i++) {
    const mid = (lo + hi) / 2
    if (quadAt(p0, p1, p2, mid)[0] < from) lo = mid
    else hi = mid
  }
  // The rest of a quadratic from t is the quadratic from B(t), through lerp(p1, p2, t), to p2.
  const [x, y] = quadAt(p0, p1, p2, lo)
  const c = [p1[0] + (p2[0] - p1[0]) * lo, p1[1] + (p2[1] - p1[1]) * lo] as const
  return d`M${x} ${y} Q${c[0]} ${c[1]} ${p2[0]} ${p2[1]}`
}

/**
 * Mouth props, each drawn in its own coordinates: the origin at the mouth corner, +x pointing out
 * (away from the face), y down. The caller turns them onto their side. `from` is where the stem
 * starts, in the prop's own x: −1 (just inside the corner, round-ended), or further out with a
 * square end when a strand of mustache, or a wide one's end, covers the corner and the stem comes
 * out from under it.
 */
const MOUTH_ART: Record<PropName, (ctx: Ctx, from: number) => string> = {
  none: () => '',
  pickaxe: () => '',
  // A bent briar: the stem out of the corner, the bowl upright.
  pipe: (_, from) =>
    stem(from, 8.5, 3.2, WOOD_DARK, 2.6) +
    shape('M7 -4 L17 -4 L16.5 3 C16 8 8 8 7.5 3 Z', WOOD) +
    ellipse(12, -4, 5, 1.5, { fill: CHAR, sw: W.detail }),
  // A fat cigar with a band, its end glowing. Cut short under a mustache, it loses its inner end's
  // outline (the mustache's covers that edge) and its band moves out to stay in sight.
  cigar: ({ p }, from) => {
    const start = from > -1 ? from / Math.cos((CIGAR_TILT * Math.PI) / 180) : -1
    const body = from > -1 ? d`M${start} 2.8 L${start} -2.8 L12.5 -2.8 L12.5 2.8 Z` : 'M-1 -2.8 L12.5 -2.8 L12.5 2.8 L-1 2.8 Z'
    const band = Math.max(2.5, start + 1)
    return g(
      (from > -1
        ? flat(body, CIGAR) + path(d`M${start} -2.8 L12.5 -2.8 L12.5 2.8 L${start} 2.8`, { fill: 'none' })
        : shape(body, CIGAR)) +
        shape(d`M${band} -3 L${band + 3} -3 L${band + 3} 3 L${band} 3 Z`, p.accent, W.detail) +
        shape('M12.5 -2.8 Q16 -2.8 16 0 Q16 2.8 12.5 2.8 Z', EMBER, W.detail) +
        circle(14, 0, 1, { fill: EMBER_HOT, stroke: 'none' }),
      { transform: `rotate(${CIGAR_TILT})` },
    )
  },
  // A wheat stalk with its ear of grain.
  wheat: (_, from) =>
    outlined(quadFrom([-1, 0], [8, 1], [14, 5], from), STRAW, 2.2, from > -1 ? 'butt' : 'round') +
    shape('M13 4 Q17 0.5 25 6.5 Q18 10 13 4 Z', STRAW, W.detail) +
    path('M15 5 L22 6.5', { stroke: STRAW_DARK, sw: W.detail }),
  // A bone toothpick, knuckle end out.
  toothpick: (_, from) =>
    stem(from, 9.5, 3.4, BONE, 2.6) +
    circle(10.2, 1.9, 2.1, { fill: BONE, sw: W.detail }) +
    circle(9, 5, 2.1, { fill: BONE, sw: W.detail }),
}

/**
 * The mustaches that cover the mouth's corners: orc.ts's WIDE_MUSTACHES (keep the two in step). A
 * raised corner (a smirk's hook, a grin's, a snarl's) lies under them, up by the nose, and a prop
 * held there lay across the mustache, its pipe bowl at the eye and its smoke in the brow. Under
 * these the prop is held at the level (grim) mouth's corner instead, whatever the mouth does: below
 * the slim ones, under the outer edge of the walrus and chevron.
 */
const WIDE_MUSTACHES: readonly MustacheName[] = ['walrus', 'chevron', 'imperial', 'handlebar', 'curly']

/**
 * The mustaches a stem comes out from under, each with how far past MW its outline's outer edge
 * reaches where the stem crosses it (measured from hair.ts's shapes, across the four heads): the
 * strands hanging straight down past the corner (horseshoe, drooper, braids), and the walrus and
 * chevron, whose outer ends cover the level corner. A stem drawn from the corner would lie on top
 * of them, so it starts at that edge instead. The other wide ones end above the level corner.
 */
const TUCK_REACH: Partial<Record<MustacheName, number>> = {
  horseshoe: 6.1,
  drooper: 5.9,
  braids: 6.3,
  walrus: 5.3,
  chevron: 3.3,
}

/** The furthest out a stem may start (in the prop's own x) before the prop moves out instead. */
const TUCK_MAX = 4.5

/**
 * The eyewear whose chain makes marks.ts hang the hoops on the ear away from it: the same side
 * the prop takes to stay clear of the chain.
 */
const CHAINED: readonly EyewearName[] = ['monocle', 'patch-monocle']

/**
 * Whether the pauldron on `side` raises spikes or horns (the great one is on side +1 only). They
 * stand under the ear, where the smoke drifts, and at 48 px a pale wisp across a cream horn or a
 * grey spike ran together into one blob.
 */
function spiky(look: Look, side: Side): boolean {
  const kind = look.shoulders
  if (kind === 'none' || kind === 'fur' || (kind === 'great' && side === -1)) return false
  return risersOf(kind, look).length > 0
}

/** Where the smoke rises in each smoking prop's frame: off the pipe bowl's char, over the ember. */
const SMOKE_FROM: Partial<Record<PropName, Pt>> = { pipe: [15, -6], cigar: [15, 1] }

/**
 * The smoke: a wisp leaning out from where it rises, away from the face, as two quadratics'
 * (control, end) offsets. Rising straight up from the bowl, it ran along the cheek's outline to
 * the ear: at 48 px a pale crack in the head's silhouette (and, beside a handlebar's or curly's
 * curl, one tangle with it).
 */
const WISP: readonly [c1: Pt, p1: Pt, c2: Pt, p2: Pt] = [[6, -0.5], [5.5, -4.5], [5, -8.5], [9.5, -10]]

/**
 * How far the wisp keeps from the head's outline and the ear's lower edge: their outlines' half
 * widths and its own (W.detail plus outlined()'s 2.5).
 */
const SMOKE_CLEAR = 4

/** The sizes the wisp may take, largest first: a short one still fits under most ears. */
const WISP_SCALES = [1, 0.85, 0.7] as const

/**
 * The wisp rising from (x, y) at scale k: its path, and points along it above its foot (the first
 * 3k units, by the bowl or ember, which may cross the head's outline as they do).
 */
function wisp([x, y]: Pt, k: number): { data: string; points: Pt[] } {
  const out = ([dx, dy]: Pt): Pt => [x + k * dx, y + k * dy]
  const [c1, p1, c2, p2] = [out(WISP[0]), out(WISP[1]), out(WISP[2]), out(WISP[3])]
  const quads = [[[x, y], c1, p1], [p1, c2, p2]] as const
  const points = quads
    .flatMap(([p0, c, p]) => [0.25, 0.5, 0.75, 1].map(t => quadAt(p0, c, p, t)))
    .filter(([, py]) => py <= y - 3 * k)
  return { data: d`M${x} ${y} Q${c1[0]} ${c1[1]} ${p1[0]} ${p1[1]} Q${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`, points }
}

/**
 * Whether the points, in the frame of a prop at (x, y) turned to `side`, all keep SMOKE_CLEAR off
 * the head's outline and under the ear on that side.
 */
function smokeFits(ctx: Ctx, side: Side, [x, y]: Pt, points: readonly Pt[]): boolean {
  const ear = Array.from({ length: 21 }, (_, i) => earEdge(ctx, side, i / 20))
  return points.every(([px, py]) => {
    const [cx, cy] = [x + side * px, y + py]
    const offHead = Math.abs(cx - 50) - headHalfWidth(ctx.look, ctx.a, cy) >= SMOKE_CLEAR
    return offHead && ear.every(([ex, ey]) => Math.abs(ex - cx) > 2 || cy >= ey + SMOKE_CLEAR)
  })
}

/**
 * Layer 18: a prop in a mouth corner, angled down and out past the tusks (under a wide mustache,
 * the level mouth's corner). It takes the side −1 corner, unless a monocle's chain hangs down that
 * side of the face (patch-monocle wears the monocle on −1): then the side +1 corner, under the patch.
 */
export function mouthProp(ctx: Ctx): string {
  const { a, look } = ctx
  if (!MOUTH_PROPS.includes(look.prop)) return ''
  const side: Side = look.eyewear === 'patch-monocle' ? 1 : -1
  // Under a wide mustache, the level mouth's corner, wherever this mouth's lies under it.
  const held = WIDE_MUSTACHES.includes(look.mustache) ? { ...ctx, look: { ...look, mouth: 'grim' as const } } : ctx
  const [cx, cy] = mouthCorner(held, side)
  // Never inside a tusk's base, whatever the mouth: the stem starts just outside the outermost tusk
  // on its side (a big tusk, or double tusks' outer fang, runs past the corner).
  const edges = tuskSpans(ctx)
    .filter(t => t.side === side)
    .map(t => Math.abs(t.x - 50) + t.halfWidth + 0.4)
  let dist = Math.max(Math.abs(cx - 50), ...edges)
  // Under a strand or a wide mustache's end the stem starts a unit inside its outline, so it reads
  // as coming out from behind it; the prop moves out only if that would leave too little stem.
  let from = -1
  const reach = TUCK_REACH[look.mustache]
  if (reach !== undefined) {
    const edge = a.MW + reach - 1
    dist = Math.max(dist, edge - TUCK_MAX)
    from = Math.max(-1, edge - dist)
  }
  // The smoke drifts out under the ear, where any ear hoops on this side hang (hoopsBoth, or under
  // a chained monocle, which sends them here) and a pauldron's spikes or horns rise: then it goes.
  // Else the largest wisp that keeps off the head and under the ear rises, if any does (a droopy
  // ear, or a pipe held up at a grin's corner, leaves none).
  const x = 50 + side * dist
  const hooped = look.hoops > 0 && (look.hoopsBoth || CHAINED.includes(look.eyewear))
  const source = SMOKE_FROM[look.prop]
  const smoke =
    source === undefined || hooped || spiky(look, side)
      ? undefined
      : WISP_SCALES.map(k => wisp(source, k)).find(w => smokeFits(ctx, side, [x, cy], w.points))
  const puff = smoke === undefined ? '' : outlined(smoke.data, SMOKE, W.detail)
  return g(MOUTH_ART[look.prop](ctx, from) + puff, { transform: `translate(${n(x)} ${n(cy)}) scale(${side} 1)` })
}
