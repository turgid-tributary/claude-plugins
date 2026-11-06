// Eyewear: one slot, so goggles, monocle, spectacles and eyepatch exclude each other. One-sided
// pieces go on side +1 (the viewer's left after the flip); patch-monocle puts the patch on +1 and
// the monocle on −1.
//
// Lenses are translucent, so the eye (and with it the expression) shows through; over a shut eye
// they're fainter still, so its lid reads (`glassOver`). Rims are coloured rings over a dark ring,
// like `outlined`, so they read on skin and on either background.
//
// The brow ridges (face.ts `brows`) are drawn again over most pieces: an orc's heavy brow overhangs
// its goggles and clamps its monocle, and the brows carry the expression however big the rims get.

import { brows } from './face'
import { headHalfWidth } from './heads'
import { W, X, at, both, circle, d, ellipse, flat, mix, outlined, path, shape } from './svg'
import type { Row } from './svg'
import type { Anchors, BrowPose, Ctx, EyewearName, Side } from './types'

/**
 * [name, peon, grunt, gentleman]; the gentleman column is read under a gentleman hat. Each column
 * totals 103: a reweighting that keeps the total leaves every roll where it was, so it changes only
 * the faces whose rolls fall where it moves a row's edge.
 *
 * The monocle stays a treat rather than a uniform: any gent eyewear also tips the mustache,
 * neckwear and prop tables to their gentleman columns. At 1 orc in 8 its chain ran down a face in
 * every row of a sheet, and nearly 1 in 4 was a gentleman. These weights give about 1 in 10 a
 * monocle (patch-monocle included), 4 to a 48-tile sheet, 1 in 8 a monocle or pince-nez, and make
 * 1 in 5 a gentleman.
 *
 * Brow-goggles outweigh goggles because resolve() turns them into goggles under any hat that
 * covers the forehead, which most orcs wear: these weights land near 2% pushed-up goggles and 5%
 * over the eyes. The patch is a grunt's mark, but always over the same eye: at 12 it led his
 * eyewear, and with the eye-slash scar a quarter of grunts read as one-eyed, so a 48-tile sheet
 * held a crew of lookalike pirates.
 */
export const EYEWEAR_ROWS: readonly Row<EyewearName>[] = [
  ['none', 71, 74, 47],
  ['monocle', 6, 4, 28],
  ['pince-nez', 3, 1, 10],
  ['spectacles', 7, 2, 6],
  ['goggles', 2, 2, 2],
  ['brow-goggles', 8, 4, 1],
  ['eyepatch', 2, 8, 3],
  ['patch-monocle', 1, 2, 4],
  ['shades', 3, 6, 2],
]

// Colours ----------------------------------------------------------------------------------------

/** Clear glass: a pale blue, mostly see-through. */
const GLASS = '#dff4ff'
/** Goggle lens tints, picked by `team2` so goggles vary without a prng draw of their own. */
const TINTS = ['#f2a93b', '#6fd39a', '#6ab8e8', '#e8665a'] as const
/** Shades: a dark smoky lens, and the sky reflected in its lower half. */
const SMOKE = '#232a31'
const SKY = '#56738a'
/** The eyepatch's leather, near black but warm, its sheen, and its strap. */
const PATCH = '#2b231d'
const PATCH_SHEEN = '#5a4b3e'
const PATCH_STRAP = '#4a3a2c'
const GLINT = '#ffffff'

/**
 * The metal eyewear is made of. Iron's base tone has the lightness of a mid green skin, so its
 * thin rims vanished into the face at 48 px; eyewear lifts it halfway to its light tone (which
 * still shows above it as the rim's shine).
 */
function trim({ look, p }: Ctx): string {
  return look.metal === 'iron' ? mix(p.metal, p.metalLight, 0.5) : p.metal
}

// Helpers ----------------------------------------------------------------------------------------

/** A coloured oval ring that reads anywhere: the outline ring under the colour, like `outlined`. */
function ring(cx: number, cy: number, rx: number, ry: number, colour: string, w: number = W.detail): string {
  return (
    ellipse(cx, cy, rx, ry, { fill: 'none', sw: w + 2.5 }) + ellipse(cx, cy, rx, ry, { fill: 'none', stroke: colour, sw: w })
  )
}

/** A tinted lens with no outline (the ring drawn over it gives the edge). */
function lens(cx: number, cy: number, rx: number, ry: number, tint: string, fo: number): string {
  return ellipse(cx, cy, rx, ry, { fill: tint, fo, stroke: 'none' })
}

/**
 * The glass's opacity over a shut eye (the sleepy mood's, the wink's, a smile's). Full-strength
 * glass tinted the socket's shadow into a coloured disc in the rim, which read at 48 px as a big
 * open iris and washed out the lid's line: sleepy orcs looked wide awake and the wink was lost.
 * At 0.2 a red or amber lens still left a brown disc; this faint, the lid reads on skin, and the
 * rim and glint still say glass. The half lid (grumpy, smug) keeps full glass: its eye is open.
 */
const SHUT_FO = 0.12

/** The lens opacity `fo` for the eye on `side`, faint when that eye is shut. */
function glassOver({ look }: Ctx, side: Side, fo: number): number {
  const shape = side === 1 ? look.eye.p : look.eye.m
  return shape === 'closed' || shape === 'happy' ? Math.min(fo, SHUT_FO) : fo
}

/** A point on an ellipse at `deg` degrees (0 is +x, −90 is up), `k` of the way out. */
function onOval(cx: number, cy: number, rx: number, ry: number, deg: number, k = 1): [number, number] {
  const t = (deg * Math.PI) / 180
  return [cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]
}

/** An arc of an ellipse from `from` to `to` degrees, as one Q curve (fine up to ~90°). */
function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number): string {
  const half = ((to - from) / 2) * (Math.PI / 180)
  const [x1, y1] = onOval(cx, cy, rx, ry, from)
  const [qx, qy] = onOval(cx, cy, rx, ry, (from + to) / 2, 1 / Math.cos(half))
  const [x2, y2] = onOval(cx, cy, rx, ry, to)
  return d`M${x1} ${y1} Q${qx} ${qy} ${x2} ${y2}`
}

/** The glint: a short white arc inside the lens's upper right, which the flip shows upper left. */
function glint(cx: number, cy: number, rx: number, ry: number, k = 0.62, w = 1.5): string {
  return path(arc(cx, cy, rx * k, ry * k, -80, -24), { fill: 'none', stroke: GLINT, sw: w })
}

/** Light catching the top of a metal rim: a thin arc of the light metal along the ring. */
function shine(cx: number, cy: number, rx: number, ry: number, colour: string): string {
  return path(arc(cx, cy, rx, ry, -100, -35), { fill: 'none', stroke: colour, sw: 1.1 })
}

type Pt = readonly [number, number]
type Cubic = readonly [Pt, Pt, Pt, Pt]

function cubicAt([p0, p1, p2, p3]: Cubic, t: number): Pt {
  const u = 1 - t
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const
  return [
    k[0] * p0[0] + k[1] * p1[0] + k[2] * p2[0] + k[3] * p3[0],
    k[0] * p0[1] + k[1] * p1[1] + k[2] * p2[1] + k[3] * p3[1],
  ]
}

/** A run of joined cubics as path data. */
function cubics(run: readonly Cubic[]): string {
  const [first] = run
  if (first === undefined) return ''
  const steps = run.map(([, p1, p2, p3]) => d`C${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`)
  return `${d`M${first[0][0]} ${first[0][1]}`} ${steps.join(' ')}`
}

/** Points every `step` units along a run of cubics, measured by walking each in short chords. */
function spaced(run: readonly Cubic[], step: number): Pt[] {
  const out: Pt[] = []
  let left = 0
  for (const seg of run) {
    let prev = cubicAt(seg, 0)
    for (let i = 1; i <= 48; i++) {
      const next = cubicAt(seg, i / 48)
      let chord = Math.hypot(next[0] - prev[0], next[1] - prev[1])
      while (left <= chord) {
        const k = chord === 0 ? 0 : left / chord
        prev = [prev[0] + (next[0] - prev[0]) * k, prev[1] + (next[1] - prev[1]) * k]
        out.push(prev)
        chord -= left
        left = step
      }
      left -= chord
      prev = next
    }
  }
  return out
}

/**
 * A bead chain along `run`: metal beads on a dark cord. Unlike an outlined line, which read as a
 * solid tube, the dark gaps between beads say "chain" at 128 px and thin it to a fine line at 48.
 */
function beadChain(run: readonly Cubic[], colour: string): string {
  const cord = path(cubics(run), { fill: 'none', sw: 3.4 })
  return cord + spaced(run, 2.9).map(([x, y]) => circle(x, y, 1.15, { fill: colour, stroke: 'none' })).join('')
}

// The pieces -------------------------------------------------------------------------------------

/** Monocle rim radius: round the eye with room for its widest shape. */
const MONOCLE_R = 6.3

/**
 * How far out mutton chops reach, outline included: hair.ts `beardChops` runs their edge down at
 * max(CW + 2.4, JW + 2) and juts its tufts about 3.5 past that. A chain hung where it would hang
 * on a bare cheek runs down that edge, grey on brown, and chain and chop tangle into one smear.
 */
const chopsOut = (a: Anchors) => Math.max(a.CW + 2.4, a.JW + 2) + 3.5
/** The chain's centre line beside the chops: its cord's half-width, and air between their tufts. */
const CHOPS_GAP = 3

/**
 * A monocle on `side`: glass, rim, and a bead chain that leaves the rim's outer side nearly level,
 * drapes over the cheekbone and down outside the cheek and jaw (clear of tusks and mustache) to a
 * T-bar fob at the collar.
 */
function monocle(ctx: Ctx, side: Side): string {
  const { look, a, p } = ctx
  const metal = trim(ctx)
  const cx = X(side, a.ED)
  const cy = a.E
  const r = MONOCLE_R
  // Leaving the rim 20° below level keeps the drape above the handlebar's and curly's curls,
  // which reach MW + 10 out, just under the nose.
  const start = onOval(cx, cy, side * r, r, 20)
  // Hangs just outside the wider of cheek and jaw corner, with room for the head's outline, or
  // outside mutton chops: it drapes over their narrow top, then clears their bushy edge.
  const hang = X(side, look.beard === 'chops' ? chopsOut(a) + CHOPS_GAP : Math.max(a.CW, a.JW + 1) + 2.6)
  const fob: Pt = [X(side, a.JW + 2), a.COLLAR]
  const chain: Cubic[] = [
    // A rounded drape, not a crook: out over the cheekbone, easing down onto the hang line.
    [start, [start[0] + side * 6, start[1] + 1], [hang, a.N - 5], [hang, a.N + 1]],
    [[hang, a.N + 1], [hang, a.M + 6], [X(side, a.JW + 2.5), fob[1] - 7], fob],
  ]
  // The fob is a short bar, as if through a buttonhole.
  const bar = outlined(d`M${fob[0] - 2.6} ${fob[1] + 0.6} L${fob[0] + 2.6} ${fob[1] - 0.6}`, metal, 2.2)
  return (
    beadChain(chain, metal) +
    bar +
    lens(cx, cy, r, r, GLASS, 0.3) +
    ring(cx, cy, r, r, metal, 2.4) +
    shine(cx, cy, r, r, p.metalLight) +
    glint(cx, cy, r, r)
  )
}

/**
 * Pince-nez: two small oval rims pinched low on the nose bridge by an arched spring, and a short
 * slack cord from the outer rim back to the ear.
 */
function pinceNez(ctx: Ctx): string {
  const { look, a } = ctx
  const metal = trim(ctx)
  const rx = 4.8
  const ry = 4.2
  const ox = a.ED - 0.5
  const cy = a.E + 1.2
  const spring = outlined(
    d`M${X(1, ox - rx)} ${cy - 0.5} C${X(1, 2.5)} ${cy - 4} ${X(-1, 2.5)} ${cy - 4} ${X(-1, ox - rx)} ${cy - 0.5}`,
    metal,
  )
  // A slack cord from the outer rim back over the temple to the ear: it sags a little past the rim,
  // then rises across the skull's outline to end on the ear's root, where it shows. Swagged lower,
  // it hooked into a C over the handlebar's and curly's curls (MW + 5 to MW + 10 out, inked from
  // about E + 3 down) and ended under the outline, short of the ear.
  const [sx, sy] = onOval(X(1, ox), cy, rx, ry, -10)
  const ex = X(1, headHalfWidth(look, a, a.earY) + 1.5)
  const cord = outlined(d`M${sx} ${sy} C${sx + 3} ${a.E + 2.6} ${ex - 4} ${a.earY + 1} ${ex} ${a.earY}`, metal)
  // Rims a little over the minimum and paler glass, so the lenses read as glass over the eye
  // socket's shadow at 48 px rather than as more of it.
  const glasses = both(side => {
    const cx = X(side, ox)
    return (
      lens(cx, cy, rx, ry, GLASS, glassOver(ctx, side, 0.36)) +
      ring(cx, cy, rx, ry, metal, 2.3) +
      glint(cx, cy, rx, ry, 0.6, 1.3)
    )
  })
  return cord + spring + glasses
}

/** Round spectacles: rims round the eyes, a bridge over the nose, arms back to the skull edge. */
function spectacles(ctx: Ctx): string {
  const { a } = ctx
  const metal = trim(ctx)
  const r = 5.7
  const cy = a.E + 0.6
  const arms = both(side => outlined(d`M${X(side, a.ED + r)} ${cy - 1} L${X(side, a.SW + 0.8)} ${cy - 2.5}`, metal))
  const bridge = outlined(d`M${X(1, a.ED - r + 0.3)} ${cy - 1.8} Q50 ${cy - 4.5} ${X(-1, a.ED - r + 0.3)} ${cy - 1.8}`, metal)
  // As the pince-nez: heavier rims and paler glass, since the brow redrawn over them hides their tops.
  const glasses = both(side => {
    const cx = X(side, a.ED)
    return lens(cx, cy, r, r, GLASS, glassOver(ctx, side, 0.36)) + ring(cx, cy, r, r, metal, 2.4) + glint(cx, cy, r, r)
  })
  return arms + bridge + glasses
}

/** How far a brow is raised over the middle of its eye (negative is up), as `brows` draws it. */
const browMid = (pose: BrowPose) => Math.min(0, (pose.inner + pose.outer) / 2)

/**
 * Brass goggles: chunky rings round tinted lenses on a leather strap. `up` pushes them onto the
 * forehead, tipped back so the lenses face up: flatter ovals, more opaque glass. They sit at
 * B−7.5 rather than B−6, where the brow (redrawn over them) props up just their bottom rim. A
 * raised brow lifts them with it, by up to 3, or it would swallow half of each lens; only
 * bare-headed, since the fez, crown and party hat sit just above them.
 */
function goggles(ctx: Ctx, up: boolean): string {
  const { look, a, p } = ctx
  const metal = trim(ctx)
  const tint = at(TINTS, look.team2)
  const rx = up ? 6.2 : 6.6
  const ry = up ? 4.3 : 6.6
  const ox = up ? a.ED - 1 : a.ED
  // The higher brow sets the lift: the bridge keeps both lenses level.
  const lift = look.hat === 'none' ? Math.max(-3, Math.min(browMid(look.brow.p), browMid(look.brow.m))) : 0
  const cy = up ? a.B - 7.5 + lift : a.E + 0.5
  // Pushed up, the strap ends at the skull's edge at its height, which narrows above the temple.
  const reach = up ? headHalfWidth(look, a, cy) + 1.2 : a.SW + 1.2
  const strap = both(side => outlined(d`M${X(side, ox + rx)} ${cy} L${X(side, reach)} ${cy - (up ? 0 : 1)}`, p.leather, 4))
  const bridge = outlined(d`M${X(1, ox - rx)} ${cy - 0.5} L${X(-1, ox - rx)} ${cy - 0.5}`, p.metalDark, 2.6)
  const cups = both(side => {
    const cx = X(side, ox)
    return (
      lens(cx, cy, rx, ry, tint, up ? 0.7 : glassOver(ctx, side, 0.42)) +
      ring(cx, cy, rx, ry, metal, 2.8) +
      shine(cx, cy, rx, ry, p.metalLight) +
      glint(cx, cy, rx, ry, 0.42)
    )
  })
  return strap + bridge + cups
}

/** The eyepatch's leather: a rounded shield over the eye on `side`, with a sheen. */
function patch({ a }: Ctx, side: Side): string {
  const cx = X(side, a.ED + 0.4)
  const cy = a.E + 0.6
  const x = (dx: number) => cx + side * dx
  return (
    shape(
      d`M${x(-6)} ${cy - 3.6} Q${cx} ${cy - 6.6} ${x(6.3)} ${cy - 3.9} C${x(7)} ${cy + 3} ${x(4)} ${cy + 6.2} ${cx} ${cy + 6.2} ` +
        d`C${x(-3.8)} ${cy + 6.2} ${x(-6.6)} ${cy + 3} ${x(-6)} ${cy - 3.6} Z`,
      PATCH,
    ) + flat(d`M${x(1.2)} ${cy - 3.6} Q${x(4.4)} ${cy - 4} ${x(4.7)} ${cy - 0.4} Q${x(3.2)} ${cy - 2.4} ${x(1.2)} ${cy - 3.6} Z`, PATCH_SHEEN)
  )
}

/**
 * The patch's straps: a short one to its own skull edge, and one rising steeply over its brow and
 * across the forehead to the far skull edge, high enough to clear the other brow (and a monocle).
 * Both end just inside the skull's outline at their height, so they tuck round the head instead
 * of poking past it where the dome narrows.
 */
function patchStraps({ look, a }: Ctx, side: Side): string {
  const cx = X(side, a.ED + 0.4)
  const cy = a.E + 0.6
  const other: Side = side === 1 ? -1 : 1
  const edge = (y: number) => headHalfWidth(look, a, y) - 0.5
  // A raised free brow (the uncovered eye's) lifts the far strap with it, so it still passes over.
  const free = side === 1 ? look.brow.m : look.brow.p
  const lift = Math.min(0, free.inner, free.outer)
  const nearY = cy - 4
  const farY = a.B - 11 + lift * 0.5
  const near = outlined(d`M${cx + side * 6.2} ${cy - 2.6} L${X(side, edge(nearY))} ${nearY}`, PATCH_STRAP, 2.6)
  const far = outlined(
    d`M${cx - side * 4} ${cy - 4.6} C${cx - side * 6} ${a.B - 4 + lift * 0.6} ${X(other, 6)} ${a.B - 9 + lift} ` +
      d`${X(other, edge(farY))} ${farY}`,
    PATCH_STRAP,
    2.6,
  )
  return near + far
}

/** Round shades: dark smoky lenses with the sky in their lower half and a glint, on a dark frame. */
function shades({ a }: Ctx): string {
  const r = 6.5
  const cy = a.E + 0.9
  const ox = a.ED + 0.4
  const frame = path(d`M${X(1, ox - r + 0.5)} ${cy - 2.5} Q50 ${cy - 4.5} ${X(-1, ox - r + 0.5)} ${cy - 2.5}`, {
    fill: 'none',
    sw: W.feature + 0.4,
  })
  const arms = both(side => path(d`M${X(side, ox + r)} ${cy - 1.5} L${X(side, a.SW + 0.8)} ${cy - 3}`, { fill: 'none', sw: W.feature }))
  const lenses = both(side => {
    const cx = X(side, ox)
    const sky = d`M${cx - r + 1} ${cy + 1} Q${cx} ${cy + 3} ${cx + r - 1} ${cy + 1} ` +
      d`Q${cx + r - 1.8} ${cy + r - 1.2} ${cx} ${cy + r - 1} Q${cx - r + 1.8} ${cy + r - 1.2} ${cx - r + 1} ${cy + 1} Z`
    return circle(cx, cy, r, { fill: SMOKE, sw: W.feature + 0.4 }) + flat(sky, SKY, 0.7) + glint(cx, cy, r, r, 0.58, 1.8)
  })
  return arms + frame + lenses
}

interface Piece {
  /** Drawn under the redrawn brows. */
  under: (ctx: Ctx) => string
  /** Drawn over them (straps across the forehead). */
  over?: (ctx: Ctx) => string
  /** Redraw the brows over `under`. */
  brows: boolean
}

const PIECES: Record<EyewearName, Piece> = {
  none: { under: () => '', brows: false },
  monocle: { under: ctx => monocle(ctx, 1), brows: true },
  // Small and low: the brows already clear them.
  'pince-nez': { under: pinceNez, brows: false },
  spectacles: { under: spectacles, brows: true },
  goggles: { under: ctx => goggles(ctx, false), brows: true },
  // The brow ridge props the pushed-up goggles from below.
  'brow-goggles': { under: ctx => goggles(ctx, true), brows: true },
  eyepatch: { under: ctx => patch(ctx, 1), over: ctx => patchStraps(ctx, 1), brows: true },
  'patch-monocle': { under: ctx => patch(ctx, 1) + monocle(ctx, -1), over: ctx => patchStraps(ctx, 1), brows: true },
  // Shades sit in front of the brows, the cool look; the brows' tops still show above them.
  shades: { under: shades, brows: false },
}

/** Layer 21: eyewear, over the brows and front hair, under the hat. */
export function eyewear(ctx: Ctx): string {
  const piece = PIECES[ctx.look.eyewear]
  return piece.under(ctx) + (piece.brows ? brows(ctx) : '') + (piece.over?.(ctx) ?? '')
}
