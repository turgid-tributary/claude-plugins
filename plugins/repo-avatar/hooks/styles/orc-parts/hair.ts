// Hair (back and front, and the bald scalp's shine), mustaches and beards.
//
// Everything is placed by the anchors (crown C, seat SEAT, skull half-width SW, brow B, nose N,
// mouth M, chin J, cheek CW, jaw JW, mouth MW, tusks TD), so each part fits all four heads. Hair
// is flat fills with the thick outline, a darker same-hue shade for depth and a lighter streak,
// which is what keeps black hair visible on a dark terminal.

import { tuskSpans } from './face'
import { HAT_INFO } from './hats'
import { anchorsFor, headHalfWidth } from './heads'
import { W, X, both, circle, d, ellipse, flat, g, hex, mix, n, outlined, path, rect, shade, shape, toHsl } from './svg'
import type { Row } from './svg'
import type {
  Anchors, BeardName, Ctx, Draw, EyewearName, HairColour, HairName, Look, MouthName, MustacheName, NoseName, Side,
} from './types'

export const HAIR_ROWS: readonly Row<HairName>[] = [
  ['bald', 40, 14],
  ['tuft', 16, 0],
  ['topknot', 22, 24],
  ['mohawk', 0, 30],
  ['spikes', 0, 10],
  ['ponytail', 10, 8],
  ['braids', 0, 12],
  ['fringe', 8, 0],
]

/** Hair drawn behind the head and ears; it shows under every hat. */
export const BACK_HAIR: readonly HairName[] = ['ponytail', 'braids']

/** [name, peon, grunt, gentleman] */
export const MUSTACHE_ROWS: readonly Row<MustacheName>[] = [
  // Clean-shaven is the commonest look outside the gentleman set, so the tusks often show bare:
  // the grunt's underbite above all, which a wide mustache (walrus, chevron, handlebar, curly,
  // imperial) puts behind it, leaving no tusk at 48 px. So the wide ones are kept to about a
  // quarter of orcs, and the hanging ones, which leave the tusks in front, take a little more. The
  // curled and waxed ones (handlebar, curly, imperial) were half of all mustaches, and their cheek
  // curls look alike at 48 px, so the sheet kept repeating one shape.
  ['none', 79, 90, 41],
  ['handlebar', 5, 4, 22],
  ['walrus', 7, 5, 11],
  // Rare, and never in the grunt column, whose underbite it would hide: no imperial can show the
  // tusks whole and still read as a mustache (a band with the tusks in front is an open mouth
  // between two fangs), so it hides all but their tips, as the other wide ones do.
  ['imperial', 2, 0, 5],
  // Never drawn by a seed: between the nose and the mouth line, the tusks in front of it, it can't
  // hold a pixel of colour at 48 px, and its flicks read as smile creases. Its share went to the
  // handlebar and curly. It stays drawable for a forced preview.
  ['pencil', 0, 0, 0],
  ['chevron', 6, 5, 6],
  // Not raised with the other hanging ones: three earlier shapes of it read as lips, as teeth and
  // as a muzzle.
  ['horseshoe', 4, 6, 3],
  ['drooper', 4, 6, 4],
  ['curly', 4, 2, 15],
  ['braids', 1, 5, 1],
]

export const BEARD_ROWS: readonly Row<BeardName>[] = [
  ['none', 80, 84],
  ['tuft', 10, 10],
  ['braided', 2, 6],
  ['chops', 8, 6],
  ['full', 6, 8],
]

// Geometry helpers ------------------------------------------------------------------------------

type Pt = readonly [number, number]

interface Tones {
  base: string
  /** A darker shade of the same hue: partings, strands, a beard behind a mustache. */
  dark: string
  /** The streak's colour. */
  light: string
}

/**
 * A colour's flat-shading set: the base, a darker shade for depth, a lighter streak. The streak is
 * stronger on dark hair (`strong`), since it's all that shows of black hair on a dark terminal.
 */
function tones(base: string, strong = toHsl(base)[2] < 30): Tones {
  return { base, dark: shade(base, -13), light: mix(base, '#ffffff', strong ? 0.5 : 0.34) }
}

/** A light streak along a lock: W.feature, so it still shows at 48 px. */
function streak(data: string, t: Tones, sw: number = W.feature): string {
  return path(data, { stroke: t.light, sw })
}

/**
 * A dark strand line inside a lock: what makes a flat fill read as hair. `deep` darkens it further
 * on pale hair, where the dark shade barely shows and a white or ash lock reads as bone.
 */
function strand(data: string, t: Tones, deep = false): string {
  const pale = deep && toHsl(t.base)[2] > 55
  return path(data, { stroke: pale ? shade(t.base, -28) : t.dark, sw: W.detail })
}

/** A cubic Bézier sampled at `count` evenly spaced t (both ends included). */
function sample(p0: Pt, p1: Pt, p2: Pt, p3: Pt, count: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const u = 1 - t
    const k0 = u * u * u
    const k1 = 3 * u * u * t
    const k2 = 3 * u * t * t
    const k3 = t * t * t
    out.push([k0 * p0[0] + k1 * p1[0] + k2 * p2[0] + k3 * p3[0], k0 * p0[1] + k1 * p1[1] + k2 * p2[1] + k3 * p3[1]])
  }
  return out
}

function pt(list: readonly Pt[], i: number): Pt {
  const item = list[Math.max(0, Math.min(list.length - 1, i))]
  if (item === undefined) throw new Error('hair: empty point list')
  return item
}

/** A smooth open curve through points: quadratic segments through the midpoints. */
function smooth(points: readonly Pt[]): string {
  const first = pt(points, 0)
  let out = d`M${first[0]} ${first[1]}`
  out += smoothOn(points)
  return out
}

/** The segments of `smooth` without the opening M, to continue a path already at points[0]. */
function smoothOn(points: readonly Pt[]): string {
  let out = ''
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = pt(points, i)
    const [nx, ny] = pt(points, i + 1)
    out += d` Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`
  }
  const last = pt(points, points.length - 1)
  return out + d` L${last[0]} ${last[1]}`
}

/** The unit normal (pointing to the spine's left) at point i. */
function normal(spine: readonly Pt[], i: number): Pt {
  const [ax, ay] = pt(spine, i - 1)
  const [bx, by] = pt(spine, i + 1)
  const len = Math.hypot(bx - ax, by - ay) || 1
  return [-(by - ay) / len, (bx - ax) / len]
}

/** A tapering strand along a spine, `half` its half-width at each point: closed path data. */
function ribbon(spine: readonly Pt[], half: readonly number[]): string {
  const left: Pt[] = []
  const right: Pt[] = []
  spine.forEach(([x, y], i) => {
    const [nx, ny] = normal(spine, i)
    const h = half[i] ?? 0
    left.push([x + nx * h, y + ny * h])
    right.push([x - nx * h, y - ny * h])
  })
  return `${smooth(left)}${smoothOn([pt(left, left.length - 1), ...right.reverse()])} Z`
}

/** The angle of the spine at point i, in degrees, for rotating bands across it. */
function angleAt(spine: readonly Pt[], i: number): number {
  const [ax, ay] = pt(spine, i - 1)
  const [bx, by] = pt(spine, i + 1)
  return (Math.atan2(by - ay, bx - ax) * 180) / Math.PI
}

/** Draws `art` in a frame at point i of the spine: x runs along the spine, y across it. */
function onSpine(spine: readonly Pt[], i: number, art: string): string {
  const [x, y] = pt(spine, i)
  return g(art, { transform: `translate(${n(x)} ${n(y)}) rotate(${n(angleAt(spine, i))})` })
}

/** A braid tassel's length past the rope's end (or its bead), in end half-widths. */
const TASSEL = 1.9
/** How much wider than the plait's end a bead is. */
const BEAD = 0.4

/** How a braid looks beyond its rope (see `braid`). */
interface BraidStyle {
  /** The light tick's width (default W.detail). */
  tick?: number
  /** The Vs' colour (default the outline's), always at W.detail. */
  vee?: string
  /** What ties the tassel on: a band (the default) or a bead, in `band`'s colour, or nothing. */
  knot?: 'band' | 'bead' | 'none'
  /** The tassel's colour (default the rope's). */
  tassel?: string
}

/**
 * A plaited braid down a spine: a rope with a V at every plait (the V is what reads as a braid at
 * 48 px), a light tick on each plait so dark hair shows on a dark terminal, and past the last point
 * a tassel flaring into three bristles, tied on by a band or a bead, or by nothing. The half-width
 * tapers from `top` to `hw` at the end.
 */
function braid(spine: readonly Pt[], top: number, hw: number, t: Tones, band: string, style: BraidStyle = {}): string {
  const { tick = W.detail, vee, knot = 'band', tassel: brush = t.base } = style
  const last = spine.length - 1
  const width = (i: number) => top + ((hw - top) * i) / last
  const rope = shape(ribbon(spine, spine.map((_, i) => width(i))), t.base)
  const veePaint = vee === undefined ? { sw: W.detail } : { stroke: vee, sw: W.detail }
  let marks = ''
  for (let i = 1; i < last; i++) {
    const k = width(i)
    const step = Math.hypot(pt(spine, i + 1)[0] - pt(spine, i)[0], pt(spine, i + 1)[1] - pt(spine, i)[1])
    const v = path(d`M${-step * 0.42} ${-k * 0.92} L${step * 0.18} 0 L${-step * 0.42} ${k * 0.92}`, veePaint)
    const shine = path(d`M${-step * 0.05} ${-k * 0.55} L${step * 0.35} ${-k * 0.12}`, { stroke: t.light, sw: tick })
    marks += onSpine(spine, i, v + shine)
  }
  // The tassel carries the rope's edges on past its end and flares into three bristles, so the braid
  // ends in hair, not a point. It starts back over the rope's rounded end, filled there and outlined
  // only along its sides: with no knot, the plait's colour runs on into it with no line across. A
  // bead is round and a little wider than the plait, with a glint (a flat band there read as a clip,
  // a dark one as a fingertip), and the bristles start past it.
  const r = hw + BEAD
  const lead = knot === 'bead' ? r : 0
  const len = hw * TASSEL
  const [ax, ay] = pt(spine, last - 1)
  const [bx, by] = pt(spine, last)
  const back = -Math.hypot(bx - ax, by - ay) / 2 - 0.6
  const fan = [
    d`M${back} ${-hw} Q${lead + len * 0.5} ${-hw} ${lead + len} ${-hw * 1.45}`,
    d`L${lead + len * 0.74} ${-hw * 0.42} L${lead + len * 1.08} 0 L${lead + len * 0.74} ${hw * 0.42}`,
    d`L${lead + len} ${hw * 1.45} Q${lead + len * 0.5} ${hw} ${back} ${hw}`,
  ].join(' ')
  const tassel = flat(`${fan} Z`, brush) + path(fan, { fill: 'none' })
  const tied =
    knot === 'band'
      ? rect(-2.4, -hw - 0.7, 4.8, hw * 2 + 1.4, { fill: band, sw: W.feature, rx: 1.3 })
      : knot === 'bead'
        ? circle(0, 0, r, { fill: band, sw: W.detail }) + circle(-r * 0.3, -r * 0.3, r * 0.32, { fill: '#ffffff', stroke: 'none', fo: 0.7 })
        : ''
  return rope + marks + onSpine(spine, last, tassel + tied)
}

/** How far a beaded braid's tassel (its splayed tip) reaches past the rope's end, `hw` wide there. */
const beadedLength = (hw: number) => hw + BEAD + hw * TASSEL * 1.08

/** The colour of ties and bands: a rag for a peon, metal for a grunt. */
const tie = ({ look, p }: Ctx): string => (look.build === 'grunt' ? p.metal : p.burlap)

// Back hair -------------------------------------------------------------------------------------

/**
 * War braids: one each side, from behind the temples, out under the ears and down beside the jaw
 * to the shoulders, where the torso and any pauldron cover their ends. The bands are always metal
 * and the ticks W.feature, so black braids still show over a dark terminal.
 */
function warBraids(ctx: Ctx): string {
  const { a, p } = ctx
  const out = Math.max(a.CW, a.JW) + 4.5
  return both(side => {
    const spine = sample(
      [X(side, a.SW - 4), a.B - 3],
      [X(side, a.SW + 6), a.B + 2],
      [X(side, out + 1), a.N - 4],
      [X(side, out + 1), a.J - 7],
      7,
    )
    return braid(spine, 4.8, 4.2, tones(p.hair), p.metal, { tick: W.feature })
  })
}

/** Points offset from a spine by `share` of its half-width, to the left (+) or right (−). */
function beside(spine: readonly Pt[], half: readonly number[], share: number, from: number, to: number): Pt[] {
  return spine.slice(from, to).map(([x, y], i): Pt => {
    const [nx, ny] = normal(spine, i + from)
    const h = (half[i + from] ?? 0) * share
    return [x + nx * h, y + ny * h]
  })
}

/**
 * The ponytail, on side +1. Bare-headed it's gathered high at the back of the skull and tied, so
 * the gather shows above the crown, and the tail sweeps out over the temple. Under any hat it starts
 * low instead, from behind the skull's edge below the rim: a high gather would poke through a cloth
 * hat (the bandana) or prop up a perched one (the tiny top hat sits right on it). Either way it
 * hangs behind the ear, past the jaw and behind the shoulder (the torso covers its end), so it reads
 * as a hanging lock rather than an arc over the head.
 */
function ponytail(ctx: Ctx): string {
  const { a, look, p } = ctx
  const t = tones(p.hair)
  const out = a.SW + 9
  const low = look.hat !== 'none'
  const top = low
    ? sample([X(1, a.SW - 3), a.SEAT + 3], [X(1, a.SW + 3), a.SEAT + 3], [X(1, out), a.SEAT + 5], [X(1, out), a.B + 2], 5)
    : sample([X(1, a.SW * 0.35), a.C + 3], [X(1, a.SW * 0.75), a.C - 6], [X(1, out), a.C - 2], [X(1, out), a.B + 2], 8)
  const hang = sample([X(1, out), a.B + 2], [X(1, out), a.N + 2], [X(1, a.CW + 9), a.M + 4], [X(1, a.JW + 7), a.SHOULDER + 4], 7)
  const spine: Pt[] = [...top, ...hang.slice(1)]
  const last = spine.length - 1
  // The gather (bare-headed) stays full up to the tie, at the top of the arc where the whole band
  // shows above the skull; from there the tail tapers.
  const knot = low ? 0 : 4
  const half = spine.map((_, i) => (i <= knot ? 6.5 : 6.2 - (3.6 * (i - knot)) / (last - knot)))
  const body = shape(ribbon(spine, half), t.base, W.silhouette)
  // Strands down the tail's length (the left of the spine is the side towards the head), and a
  // light streak down its outer side.
  const strands =
    strand(smooth(beside(spine, half, 0.4, knot + 2, last)), t) + strand(smooth(beside(spine, half, -0.05, knot + 3, last)), t)
  const shine = streak(smooth(beside(spine, half, -0.5, knot + 1, last - 2)), t)
  // The tie: where the tail leaves the gather, or (under a hat) round the tail below the ear.
  const at = low ? top.length + 1 : knot
  const across = (half[at] ?? 6) + 1
  const band = onSpine(spine, at, rect(-2.4, -across, 4.8, across * 2, { fill: tie(ctx), sw: W.feature, rx: 1.4 }))
  return body + strands + shine + band
}

/** Layer 2: ponytail and war braids, behind the head and ears. */
export function backHair(ctx: Ctx): string {
  if (ctx.look.hair === 'braids') return warBraids(ctx)
  if (ctx.look.hair === 'ponytail') return ponytail(ctx)
  return ''
}

// Front hair ------------------------------------------------------------------------------------

/**
 * How far raised brows lift (0 down to −3.5, in units above B). Hair that reaches the forehead
 * rises by it, so worried and startled brows stay visible under a hairline.
 */
function browLift({ look }: Ctx): number {
  return Math.max(-3.5, Math.min(0, look.brow.p.inner, look.brow.p.outer, look.brow.m.inner, look.brow.m.outer))
}

/**
 * The hair colours dark enough to merge with the outline and a dark terminal, which some parts lift
 * further.
 */
const DARK_HAIR: readonly HairColour[] = ['black', 'brown']

/**
 * Dark hair that stands on the crown against the background (the tuft, the mohawk's fin) lifts this
 * much, so on a dark terminal its fill, not just its streaks, stands off the background.
 */
const CREST_LIFT = 6

/** The tones of hair standing up off the crown: black and brown lifted by CREST_LIFT. */
function crestTones({ look, p }: Ctx): Tones {
  if (!DARK_HAIR.includes(look.hairColour)) return tones(p.hair)
  const [h, s, l] = toHsl(p.hair)
  return tones(hex(h, s, l + CREST_LIFT), true)
}

/**
 * The peon's cowlick: one tuft of three pointed locks from a shared base on the crown, the middle
 * one tallest and curling over to side +1, the outer two flicking out, filled and outlined like
 * every other hair mass, with one light streak. Three separate stroked curls read, in white or ash,
 * as steam rising off the head (the pipe smoke's S), and in black or rust as worms or a sprout. It
 * spans about 33 to 67 and rises up to 18 above the crown (less on a tall skull, so it stays on the
 * canvas), outlined at W.feature: at a third the size, with the thick outline, it was a 3 by 4 px
 * nub at 48 px, a candle flame in white.
 */
function tuft(ctx: Ctx): string {
  const { a } = ctx
  const t = crestTones(ctx)
  // The locks, drawn about (50, C + 2): 1.5 times as wide, and as tall as the canvas allows.
  const sy = Math.min(1.5, (a.C - 1.5) / 12.4)
  const at = (dx: number, dy: number): Pt => [50 + dx * 1.5, a.C + 2 + dy * sy]
  const q = (c: Pt, e: Pt) => d` Q${c[0]} ${c[1]} ${e[0]} ${e[1]}`
  // From the base's side −1 end up round the three locks to its side +1 end, then along the skull.
  const start = at(-6.6, 0.6)
  const lock = [
    d`M${start[0]} ${start[1]}`,
    q(at(-8.4, -1.6), at(-11.6, -5.2)),
    q(at(-6.6, -4.8), at(-3.6, -3.4)),
    q(at(-3.6, -9.6), at(4.2, -12.4)),
    q(at(2.6, -8.6), at(3.6, -4.4)),
    q(at(7.6, -5.6), at(11.6, -4)),
    q(at(9.4, -1.2), at(6.8, 0.6)),
    q(at(0, 2), start),
    ' Z',
  ].join('')
  const [s0, s1, s2] = [at(-1, -2), at(-1.2, -6.4), at(2, -9.2)]
  return shape(lock, t.base) + streak(d`M${s0[0]} ${s0[1]} Q${s1[0]} ${s1[1]} ${s2[0]} ${s2[1]}`, t)
}

/** A bun on the crown with its tail flopping over to side +1, tied at the base. */
function topknot(ctx: Ctx): string {
  const { a, p } = ctx
  const t = tones(p.hair)
  const c = a.C
  // The tail leaves the bun's shoulder and flops over to side +1 onto the skull. Its peak stays
  // near C−12.5, so the top is on the canvas on the tallest skull.
  const spine: Pt[] = [
    [51, c - 5],
    [54, c - 9.4],
    [59.5, c - 9.6],
    [63.5, c - 6.5],
    [65.5, c - 1.5],
    [65.5, c + 3],
  ]
  const tail = shape(ribbon(spine, [3.2, 3.3, 3.1, 2.6, 1.8, 0.2]), t.base)
  const bun = ellipse(50, c - 3.4, 7.4, 5.8, { fill: t.base, sw: W.silhouette })
  const streak = path(d`M44.8 ${c - 4.6} Q46.5 ${c - 7.6} 50.5 ${c - 7.8}`, { stroke: t.light, sw: W.detail })
  const tailStreak = path(d`M55 ${c - 9.4} Q60 ${c - 10} 62.8 ${c - 6.2}`, { stroke: t.light, sw: W.detail })
  const band = rect(43.5, c - 0.4, 13, 3.8, { fill: tie(ctx), sw: W.feature, rx: 1.5 })
  return tail + tailStreak + bun + streak + band
}

/** Heights above the crown for a crest up to `tall`, scaled so its outline stays below y 2. */
function crestUp(a: Anchors, tall: number): (dy: number) => number {
  const k = Math.min(1, (a.C - 3.8) / tall)
  return dy => a.C + (dy < 0 ? dy * k : dy)
}

/** The mohawk fin's height above the crown, before `crestUp` squashes it on a tall skull. */
const FIN = 18

/**
 * The mohawk: a strip up the middle of the shaved scalp into one tall fin above the crown, 8 wide
 * there and fanning out to 16 across its top, which is cut into five jagged points (the middle one
 * tallest, the outer ones leaning out) with notches 3 deep between them, so at 48 px three spikes
 * still show. It's outlined at W.feature, a dark parting runs up its middle from the forehead, and
 * light streaks run up both edges: on black hair over a dark terminal they're the rim that holds the
 * silhouette. A short wide fan of quills read as a shuttlecock or a pineapple top, and at 48 px as
 * the peon's tuft; a fin 8 wide all the way up, outlined at W.silhouette, as a chimney or a cork.
 * Under a crown it's a narrow crest (see `crownedMohawk`).
 */
function mohawk(ctx: Ctx): string {
  if (ctx.look.hat === 'crown') return crownedMohawk(ctx)
  const { a } = ctx
  const t = crestTones(ctx)
  const c = a.C
  // The strip's foot on the forehead, kept clear of the brows' inner ends.
  const foot = Math.min(a.SEAT + 5, a.B + browLift(ctx) - 5)
  const x = (dx: number) => 50 + dx
  const up = crestUp(a, FIN)
  // From the foot up side −1 of the strip and the fin, over the five points, and down side +1.
  // The edges bow a little between points, so the top reads as hair rather than a saw blade.
  const fin = [
    d`M50 ${foot}`,
    d`Q${x(-3)} ${foot - 0.4} ${x(-3.3)} ${a.SEAT}`,
    d`L${x(-4)} ${c + 1}`,
    d`Q${x(-5)} ${up(-5)} ${x(-8)} ${up(-11)}`,
    d`Q${x(-6.2)} ${up(-9.4)} ${x(-5.4)} ${up(-8)}`,
    d`Q${x(-5.4)} ${up(-12)} ${x(-4.5)} ${up(-15)}`,
    d`Q${x(-2.8)} ${up(-12.6)} ${x(-1.8)} ${up(-12)}`,
    d`Q${x(-1)} ${up(-15.6)} 50 ${up(-FIN)}`,
    d`Q${x(1)} ${up(-15.6)} ${x(1.8)} ${up(-12)}`,
    d`Q${x(2.8)} ${up(-12.6)} ${x(4.5)} ${up(-15)}`,
    d`Q${x(5.4)} ${up(-12)} ${x(5.4)} ${up(-8)}`,
    d`Q${x(6.2)} ${up(-9.4)} ${x(8)} ${up(-11)}`,
    d`Q${x(5)} ${up(-5)} ${x(4)} ${c + 1}`,
    d`L${x(3.3)} ${a.SEAT}`,
    d`Q${x(3)} ${foot - 0.4} 50 ${foot} Z`,
  ].join(' ')
  const parting = path(d`M50 ${foot - 2} L50 ${c} Q${x(-0.3)} ${up(-8)} ${x(0.2)} ${up(-13.5)}`, { stroke: t.dark, sw: W.detail })
  const rims = [
    d`M${x(-2.2)} ${a.SEAT - 1} L${x(-2.5)} ${c + 1} Q${x(-3)} ${up(-4.6)} ${x(-5.6)} ${up(-9.6)}`,
    d`M${x(2.4)} ${c - 1} Q${x(2.8)} ${up(-6)} ${x(3.4)} ${up(-11.6)}`,
  ]
    .map(s => streak(s, t, W.detail))
    .join('')
  return shape(fin, t.base) + parting + rims
}

/**
 * The mohawk under a crown: a plume behind the crown's middle point, narrow at its foot (hidden
 * behind the band, hats.ts: C+1 to C+6.5) and widening to about 9 across at its three points above
 * the pearl, outlined at W.detail with a light streak so its colour shows between the outlines.
 * The gaps between the crown's points stay open to the sky: a full fin or a fan filled them and
 * the crown read as a dark clump with a gold band; a crest 6 wide was all outline, a black post.
 */
function crownedMohawk({ a, p }: Ctx): string {
  const t = tones(p.hair)
  const x = (dx: number) => 50 + dx
  const up = crestUp(a, 16.5)
  const crest = [
    d`M${x(-2.4)} ${up(4)}`,
    d`L${x(-3.6)} ${up(-7.5)}`,
    d`Q${x(-4.8)} ${up(-10.6)} ${x(-4.6)} ${up(-14)}`,
    d`Q${x(-2.8)} ${up(-12.6)} ${x(-1.6)} ${up(-12.4)}`,
    d`Q${x(-0.8)} ${up(-14.8)} 50 ${up(-16.5)}`,
    d`Q${x(0.8)} ${up(-14.8)} ${x(1.6)} ${up(-12.4)}`,
    d`Q${x(2.8)} ${up(-12.6)} ${x(4.6)} ${up(-14)}`,
    d`Q${x(4.8)} ${up(-10.6)} ${x(3.6)} ${up(-7.5)}`,
    d`L${x(2.4)} ${up(4)} Z`,
  ].join(' ')
  return path(crest, { fill: t.base, sw: W.detail }) + streak(d`M${x(-1.4)} ${up(-6)} L${x(-2.2)} ${up(-11.4)}`, t, W.detail)
}

/** Spiky hair over the whole crown: spikes radiate from the skull, the hairline zigzags on the forehead. */
function spikes(ctx: Ctx): string {
  const { a, p } = ctx
  const t = tones(p.hair)
  // The hairline's points reach up to 6 below the seat, less when raised brows need the room.
  const drop = Math.min(6, a.B + browLift(ctx) - 4 - a.SEAT) / 6
  const cy = a.C + 13
  const ry = 13
  const tips = [168, 142, 116, 90, 64, 38, 12]
  const at = (deg: number, grow: number, wide: number): Pt => {
    const r = (deg * Math.PI) / 180
    return [50 + Math.cos(r) * (a.SW + wide), cy - Math.sin(r) * (ry + grow)]
  }
  let outline = d`M${50 - a.SW - 1.5} ${a.SEAT + 3}`
  tips.forEach((deg, i) => {
    const valley = at(deg + 13, 1.5, 1.5)
    const tip = at(deg, i === 3 ? 10 : 8.5, 7)
    outline += d` L${valley[0]} ${valley[1]} L${tip[0]} ${tip[1]}`
  })
  const end = at(-1, 1.5, 1.5)
  outline += d` L${end[0]} ${end[1]} L${50 + a.SW + 1.5} ${a.SEAT + 3}`
  // The hairline: a zigzag across the top of the forehead.
  const y = (dy: number) => a.SEAT + dy * drop
  const hairline: Pt[] = [[a.SW - 3, 2], [a.SW * 0.55, 5.5], [a.SW * 0.3, 2.5], [0, 6], [-a.SW * 0.3, 2.5], [-a.SW * 0.55, 5.5], [3 - a.SW, 2]]
  outline += hairline.map(([dx, dy]) => d` L${50 + dx} ${y(dy)}`).join('') + ' Z'
  const streaks = [116, 90, 64]
    .map(deg => {
      const from = at(deg, -2, -6)
      const to = at(deg, 5, 3)
      return path(d`M${from[0]} ${from[1]} L${to[0]} ${to[1]}`, { stroke: t.light, sw: W.detail })
    })
    .join('')
  return shape(outline, t.base, W.silhouette) + streaks
}

/**
 * A ragged mop: a lumpy cap of hair over the crown, its fringe hanging in pointed locks over the
 * upper forehead. The lowest tip is at B−4, and raised brows (worried, startled) lift the whole
 * fringe with them, so the expression stays readable under it. A hat that lets hair poke through
 * but covers the forehead (the bandana) hides the locks, which are what say "fringe", and leaves
 * only a lump of the cap poking out like a stray knot: under one, the fringe isn't drawn.
 */
function fringe(ctx: Ctx): string {
  if (HAT_INFO[ctx.look.hat].coversForehead) return ''
  const { a, p } = ctx
  const t = tones(p.hair)
  const c = a.C
  const s = a.SW
  const b = a.B + browLift(ctx)
  const foot = Math.min(a.SEAT + 6, b - 5)
  const side = (k: Side) => X(k, s + 1.8)
  // Messy top: three lumps between the temples.
  const cap = [
    d`M${side(1)} ${foot}`,
    d`C${X(1, s + 2.4)} ${c + 6} ${X(1, s * 0.85)} ${c - 1} ${X(1, s * 0.5)} ${c - 1}`,
    d`Q${X(1, s * 0.28)} ${c - 3.2} ${X(1, s * 0.05)} ${c - 2}`,
    d`Q${X(-1, s * 0.25)} ${c - 3.6} ${X(-1, s * 0.5)} ${c - 1.2}`,
    d`C${X(-1, s * 0.85)} ${c - 1} ${X(-1, s + 2.4)} ${c + 6} ${side(-1)} ${foot}`,
  ]
  // The locks, from side −1 to +1, as [x share of SW, tip depth below B]; tips curl toward the
  // middle, the notches between them reach 10 above the (lifted) brow line.
  const locks = [
    [-0.86, -5],
    [-0.5, -4],
    [-0.12, -5],
    [0.26, -4],
    [0.62, -4.5],
    [0.92, -6],
  ] as const
  let edge = ''
  let prevX = side(-1)
  let prevY = foot
  locks.forEach(([u, dy], i) => {
    const tipX = 50 + u * s
    const tipY = b + dy
    const next = locks[i + 1]
    const nextX = next === undefined ? side(1) : 50 + ((u + next[0]) / 2) * s
    const nextY = next === undefined ? foot : b - 10
    const lean = u < 0 ? 1 : -1
    edge += d` Q${prevX + lean * 0.5} ${(prevY + tipY) / 2 + 2} ${tipX} ${tipY}`
    edge += d` Q${tipX + (nextX - tipX) * 0.35} ${tipY - 3} ${nextX} ${nextY}`
    prevX = nextX
    prevY = nextY
  })
  const outline = `${cap.join(' ')}${edge} Z`
  // Partings up from the notches, and a light streak over the top.
  const partings = locks
    .slice(0, -1)
    .map(([u], i) => {
      const x = 50 + ((u + (locks[i + 1]?.[0] ?? u)) / 2) * s
      return path(d`M${x} ${b - 10} Q${x - 0.5} ${b - 13} ${x + (x < 50 ? 1.5 : -1.5)} ${b - 15}`, { stroke: t.dark, sw: W.detail })
    })
    .join('')
  const streak = path(d`M${X(1, s * 0.15)} ${c + 2} Q${X(1, s * 0.6)} ${c + 1.5} ${X(1, s * 0.82)} ${c + 7}`, {
    stroke: t.light,
    sw: W.detail,
  })
  const stray = outlined(d`M${X(-1, s * 0.15)} ${c - 1} C${X(-1, s * 0.2)} ${c - 6} ${X(-1, s * 0.45)} ${c - 7} ${X(-1, s * 0.55)} ${c - 5}`, p.hair, 2.4)
  return stray + shape(outline, t.base, W.silhouette) + partings + streak
}

/** The bald scalp's shine, on side +1 (the viewer's top left, after the flip). */
function shine({ a, p }: Ctx): string {
  const s = a.SW
  const c = a.C
  return (
    flat(
      d`M${X(1, s * 0.12)} ${c + 3.6} Q${X(1, s * 0.6)} ${c + 2} ${X(1, s * 0.76)} ${c + 9} Q${X(1, s * 0.5)} ${c + 5.6} ${X(1, s * 0.12)} ${c + 3.6} Z`,
      p.skinLight,
    ) + circle(X(1, s * 0.78), c + 12.6, 1.3, { fill: p.skinLight, stroke: 'none' })
  )
}

const FRONT: Partial<Record<HairName, Draw>> = { tuft, topknot, mohawk, spikes, fringe }

/**
 * Layer 20: tuft, topknot, mohawk, spikes, fringe (when `look.frontHair`), and the scalp shine
 * (`look.shine`). A crest (`look.crest`) is the helmet's to draw, so nothing here.
 */
export function frontHair(ctx: Ctx): string {
  const { look } = ctx
  if (look.crest) return ''
  const shineArt = look.shine ? shine(ctx) : ''
  const draw = look.frontHair ? FRONT[look.hair] : undefined
  return shineArt + (draw ? draw(ctx) : '')
}

// Facial hair -----------------------------------------------------------------------------------

/**
 * How facial hair's colour moves off the hair's, per colour: lightness points up, and degrees of
 * hue. A mustache lies on the face by the dark mouth, and at the hair's own black or brown
 * (lightness 23, close to the outline and the mouth cavity) a walrus reads as an open mouth at
 * 48 px. Black also turns a warm charcoal: lifted, the hair's cool charcoal was the grey of iron,
 * and a horseshoe or chops beside an iron helm read as part of the armour. Chestnut moves a little
 * too, so it stays lighter than brown. Rust turns ginger: at the hair's brick red a mustache on
 * the upper lip reads as red lips, and a chin tuft as a tongue.
 */
const FACIAL_SHIFT: Record<HairColour, readonly [lift: number, turn: number]> = {
  black: [12, 157],
  brown: [10, 0],
  chestnut: [5, 0],
  rust: [5, 6],
  ash: [0, 0],
  white: [0, 0],
}

/**
 * Facial hair's tones: the facial colour, shifted, keeping the strong streak of dark hair. `extra`
 * lifts black and brown further, for parts thin enough or close enough to the outline to merge
 * with it (the pencil, the full beard's band along the jaw).
 */
function facialTones({ look, p }: Ctx, extra = 0): Tones {
  const [lift, turn] = FACIAL_SHIFT[look.facial]
  const more = DARK_HAIR.includes(look.facial) ? extra : 0
  if (lift + more === 0 && turn === 0) return tones(p.facial)
  const [h, s, l] = toHsl(p.facial)
  return tones(hex(h + turn, s, l + lift + more), l < 30)
}

/**
 * How far each nose reaches below N, as face.ts draws it: on the centre line (its NOSE_BOX bottom),
 * and from 4 out (the wings and nostrils); and its half-width (NOSE_BOX hw), past which nothing of
 * it hangs below N. A pug's or button's tip sits high; a hooked beak hangs low but narrow; a flat
 * nose is low all the way across.
 */
const NOSE_FOOT: Record<NoseName, readonly [mid: number, side: number, half: number]> = {
  snout: [4, 1.4, 6.4],
  flat: [3.4, 3.4, 9.2],
  pug: [2.4, 1.4, 5],
  button: [2.8, 0.6, 4.6],
  hooked: [5.6, 2.4, 6.4],
  broken: [3.6, 3.4, 7.2],
}

/** Between the nose and hair under it: both half-outlines and a sliver of bare skin. */
const NOSE_GAP = W.feature + 0.8

/** What the fitting below measures: the head and the face on it, with no colours (`curlyFits`). */
type Face = Pick<Ctx, 'look' | 'a'>

/**
 * The highest y facial hair may reach `dx` from the centre line and still leave skin under the
 * nose: when the two outlines touch, nose and mustache fuse into one muzzle at 48 px.
 */
function belowNose({ a, look }: Face, dx: number): number {
  const [mid, side] = NOSE_FOOT[look.nose]
  return a.N + mid + (side - mid) * Math.min(1, Math.abs(dx) / 4) + NOSE_GAP
}

/**
 * How far below M each mouth reaches within a few units of the centre line, tongue included, as
 * face.ts draws them (a frown's middle rides high; a gape's tongue lolls lowest).
 */
const MOUTH_FOOT: Record<MouthName, number> = {
  grim: 1,
  frown: 1,
  smirk: 1.6,
  wavy: 2.2,
  snarl: 3,
  roar: 9.4,
  grin: 6.8,
  gape: 10.6,
  tongue: 7.2,
  ooh: 5.8,
}

/**
 * The highest y a chin beard may reach: below the mouth's outline with a strip of bare skin, so
 * the beard grows from the chin instead of hanging out of the mouth like a tongue.
 */
function belowMouth({ a, look }: Ctx): number {
  return a.M + MOUTH_FOOT[look.mouth] + W.feature / 2 + 2
}

/** Points down the inside of the head outline (inset by `inset`) on `side`, at each y. */
function hugging({ look, a }: Ctx, side: Side, ys: readonly number[], inset: number): Pt[] {
  return ys.map((y): Pt => [X(side, headHalfWidth(look, a, y) - inset), y])
}

/** An eyewear rim round an eye: its centre out from ED and down from E, and its half-widths. */
type Rim = readonly [dx: number, dy: number, rx: number, ry: number]

/**
 * The rims round the eyes on each side (`plus` is side +1), outline included: what the handlebar's
 * and curly's curls and the imperial's horns rise towards. Measured from eyewear.ts (each lens's
 * centre and radius, plus half its ring and outline, and the patch's leather); change them together.
 */
const MONOCLE_RIM: Rim = [0, 0, 8.75, 8.75]
const PATCH_RIM: Rim = [0.4, 0.6, 7.8, 7.5]
const pair = (rim: Rim) => ({ plus: rim, minus: rim })
const RIMS: Partial<Record<EyewearName, { plus?: Rim; minus?: Rim }>> = {
  monocle: { plus: MONOCLE_RIM },
  'pince-nez': pair([-0.5, 1.2, 7.2, 6.6]),
  spectacles: pair([0, 0.6, 8.15, 8.15]),
  goggles: pair([0, 0.5, 9.25, 9.25]),
  eyepatch: { plus: PATCH_RIM },
  'patch-monocle': { plus: PATCH_RIM, minus: MONOCLE_RIM },
  shades: pair([0.4, 0.9, 8, 8]),
}

/**
 * A bare eye as a rim: the widest eye with its outline (the sleepy one's lid down to E + 5.7, the
 * wide one out to ED + 5.8) and its socket's shadow (out to ED + 7.4). Measured from face.ts `eye`;
 * change them together.
 */
const BARE_EYE: Rim = [0.4, -0.6, 7, 6.3]

/** The eyewear's rim round the eye on `side`, if it puts one there. */
function rimOn({ look }: Face, side: Side): Rim | undefined {
  const rims = RIMS[look.eyewear]
  return side === 1 ? rims?.plus : rims?.minus
}

/** Whether a point clears `rim`, round the eye on `side`, by `pad` (the art's half-width and a gap). */
function clearOf({ a }: Face, side: Side, [dx, dy, rx, ry]: Rim, [x, y]: Pt, pad: number): boolean {
  return ((x - X(side, a.ED + dx)) / (rx + pad)) ** 2 + ((y - a.E - dy) / (ry + pad)) ** 2 >= 1
}

/** Whether a point keeps `pad` (the art's half-width and the skin wanted) inside the head's outline. */
function insideOf({ a, look }: Face, [x, y]: Pt, pad: number): boolean {
  return Math.abs(x - 50) <= headHalfWidth(look, a, y) - W.silhouette / 2 - pad
}

/**
 * How far (down to 0.4) art on `side` shrinks towards `pivot` so every one of its points clears
 * that side's rim by `pad`: 1 with no rim there. At 48 px a curl touching a goggle's rim fused with
 * it into one figure-eight.
 */
function rimFit(face: Face, side: Side, points: readonly Pt[], pivot: Pt, pad: number): number {
  const rim = rimOn(face, side)
  if (rim === undefined) return 1
  const clear = (k: number) => shrink(points, pivot, k).every(p => clearOf(face, side, rim, p, pad))
  let k = 1
  while (k > 0.4 && !clear(k)) k -= 0.05
  return k
}

/** Points shrunk by `k` towards `pivot`. */
const shrink = (points: readonly Pt[], pivot: Pt, k: number): Pt[] =>
  points.map(([x, y]): Pt => [pivot[0] + (x - pivot[0]) * k, pivot[1] + (y - pivot[1]) * k])

/**
 * As `rimFit`, against the head outline: how far (down to 0.4) art shrinks towards `pivot` so every
 * one of its points keeps `pad` inside the outline's inner edge. At 48 px a curl with a unit of skin
 * to the jaw merged with it into one dark bump.
 */
function outlineFit(face: Face, points: readonly Pt[], pivot: Pt, pad: number): number {
  const clear = (k: number) => shrink(points, pivot, k).every(p => insideOf(face, p, pad))
  let k = 1
  while (k > 0.4 && !clear(k)) k -= 0.05
  return k
}

/** A white beard's cool grey: a step below white, so ivory tusks and a white mustache stand off it. */
const WHITE_BEARD = '#cbc5b6'

/**
 * The beard's tones. Under a mustache it drops to the mustache's dark shade, so the mustache sits
 * visibly in front instead of melting into one flat mass; a white beard always goes cool grey.
 */
function beardTones(ctx: Ctx, extra = 0): Tones {
  if (ctx.look.facial === 'white') return tones(WHITE_BEARD)
  const t = facialTones(ctx, extra)
  return ctx.look.mustache === 'none' ? t : tones(t.dark, true)
}

const DOWN: Pt = [0, 1]

/** The point `u` of the way from p0 to p1, pushed `off` along `dir`. */
function along(p0: Pt, p1: Pt, u: number, dir: Pt, off: number): Pt {
  return [p0[0] + (p1[0] - p0[0]) * u + dir[0] * off, p0[1] + (p1[1] - p0[1]) * u + dir[1] * off]
}

/** A tuft's two control points and tip, as [share of its span, share of its depth]. */
const TUFT: readonly [Pt, Pt, Pt] = [[0.35, 0.6], [0.8, 1], [0.96, 0.45]]
/** The same tuft mirrored, leaning back towards where the edge started. */
const TUFT_BACK: readonly [Pt, Pt, Pt] = [[0.04, 0.45], [0.2, 1], [0.65, 0.6]]

/** A path segment after the pen: [end] a line, [control, end] a quadratic, [c1, c2, end] a cubic. */
type Seg = readonly Pt[]

/** Segments continuing a path. */
const segsOn = (segs: readonly Seg[]): string =>
  segs
    .map(s => {
      const [[ax, ay], [bx, by], [cx, cy]] = [pt(s, 0), pt(s, 1), pt(s, 2)]
      return s.length === 1 ? d` L${ax} ${ay}` : s.length === 2 ? d` Q${ax} ${ay} ${bx} ${by}` : d` C${ax} ${ay} ${bx} ${by} ${cx} ${cy}`
    })
    .join('')

/** The same segments walked backwards, from their last end back to `start`. */
function backwards(start: Pt, segs: readonly Seg[]): Seg[] {
  const ends = [start, ...segs.map(s => pt(s, s.length - 1))]
  return segs.map((s, i) => [...s.slice(0, -1).reverse(), pt(ends, i)]).reverse()
}

/**
 * A ragged edge from p0 to p1, as segments: `count` pointed tufts jutting `depth` along `dir`, each
 * leaning towards p1 (towards p0 when `back`) like hair flicked one way. Pointed, not round, so a
 * pale beard reads as hair rather than fingers or teeth.
 */
function tuftSegs(p0: Pt, p1: Pt, count: number, depth: number, dir: Pt = DOWN, back = false): Seg[] {
  const [c1, tip, c2] = back ? TUFT_BACK : TUFT
  const out: Seg[] = []
  for (let i = 0; i < count; i++) {
    const at = ([u, k]: Pt) => along(p0, p1, (i + u) / count, dir, depth * k)
    out.push([at(c1), at(tip)], [at(c2), at([1, 0])])
  }
  return out
}

/** `tuftSegs`, continuing a path already at p0. */
function tufts(p0: Pt, p1: Pt, count: number, depth: number, dir: Pt = DOWN, back = false): string {
  return segsOn(tuftSegs(p0, p1, count, depth, dir, back))
}

/** Where tuft i of `count` from p0 to p1 points (its tip), for strands that run into it. */
function tuftTip(p0: Pt, p1: Pt, count: number, depth: number, i: number, dir: Pt = DOWN, back = false): Pt {
  return along(p0, p1, (i + (back ? TUFT_BACK : TUFT)[1][0]) / count, dir, depth)
}

/**
 * The points of a jagged edge from p0 to p1 (p0 left out, p1 last): `count` small barbs, each a
 * point on the line with a notch `depth` deep (along `inward`) just after it, so the barbs hang
 * towards p1 like strand ends.
 */
function barbs(p0: Pt, p1: Pt, count: number, depth: number, inward: Pt): Pt[] {
  const out: Pt[] = []
  for (let i = 1; i <= count; i++) {
    const u = i / (count + 1)
    out.push(along(p0, p1, u, inward, 0), along(p0, p1, u + 0.07, inward, depth))
  }
  return [...out, p1]
}

/** Cubic segments through points given as [c1, c2, end, c1, c2, end, ...], continuing a path. */
function cubicsOn(points: readonly Pt[]): string {
  let out = ''
  for (let i = 0; i + 2 < points.length; i += 3) {
    const [[ax, ay], [bx, by], [cx, cy]] = [pt(points, i), pt(points, i + 1), pt(points, i + 2)]
    out += d` C${ax} ${ay} ${bx} ${by} ${cx} ${cy}`
  }
  return out
}

/** Points along cubics given as [start, c1, c2, end, c1, c2, end, ...], 8 to each. */
function cubicPoints(points: readonly Pt[]): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i + 3 < points.length; i += 3) {
    out.push(...sample(pt(points, i), pt(points, i + 1), pt(points, i + 2), pt(points, i + 3), 8))
  }
  return out
}

/** Straight segments through points, continuing a path. */
const through = (points: readonly Pt[]): string => points.map(([x, y]) => d` L${x} ${y}`).join('')

/** Points mirrored across the centre line. */
const mirror = (points: readonly Pt[]): Pt[] => points.map(([x, y]): Pt => [100 - x, y])

/**
 * Soft scallops along a polyline, continuing a path already at its first point: `count` rounded
 * lobes of equal length, each bulging `depth` off the line on the (dy, −dx) side: outward, for a
 * lower edge walked from side +1 round to side −1.
 */
function scallops(line: readonly Pt[], count: number, depth: number): string {
  const lengths = [0]
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = pt(line, i - 1)
    const [bx, by] = pt(line, i)
    lengths.push((lengths[i - 1] ?? 0) + Math.hypot(bx - ax, by - ay))
  }
  const total = lengths[lengths.length - 1] ?? 0
  // The point at arc length s.
  const at = (s: number): Pt => {
    let i = 1
    while (i < line.length - 1 && (lengths[i] ?? 0) < s) i++
    const s0 = lengths[i - 1] ?? 0
    const u = Math.min(1, Math.max(0, (s - s0) / ((lengths[i] ?? s0) - s0 || 1)))
    return along(pt(line, i - 1), pt(line, i), u, DOWN, 0)
  }
  let out = ''
  for (let i = 0; i < count; i++) {
    const [ax, ay] = at((total * i) / count)
    const [bx, by] = at((total * (i + 1)) / count)
    const [mx, my] = at((total * (i + 0.5)) / count)
    const len = Math.hypot(bx - ax, by - ay) || 1
    // A quadratic's middle sits halfway to its control point: twice the depth out from the line.
    const cx = mx + ((by - ay) / len) * depth * 2
    const cy = my - ((bx - ax) / len) * depth * 2
    out += d` Q${cx} ${cy} ${bx} ${by}`
  }
  return out
}

// Beards ----------------------------------------------------------------------------------------

/**
 * A chin tuft: one goatee wedge, from the chin below the mouth (`belowMouth`, so skin shows under
 * the lip) to a single point past the chin, narrower than the mouth. Its lower edges are jagged
 * with small strand ends, and diagonal strands (darker on pale hair) run down towards the point.
 * Forked, with a parting down the middle, it had a molar's outline: in white or ash, the tusks'
 * colour, a giant tooth; in rust or chestnut under a grin, a tongue hanging out.
 */
function beardTuft(ctx: Ctx): string {
  const { a } = ctx
  const t = beardTones(ctx)
  const top = Math.max(a.J - 9.5, belowMouth(ctx))
  const tip = a.J + 9
  const hw = a.MW * 0.6
  const y = (u: number) => top + (tip - top) * u
  // Where the sides stop bulging and the jagged edges run in to the point.
  const shoulder = (side: Side): Pt => [X(side, hw * 0.66), y(0.42)]
  const point: Pt = [50, tip]
  // Down the side +1 edge to the point, the notches cutting in towards the middle and up so the
  // barbs hang down and out; then back up its mirror image.
  const edge = barbs(shoulder(1), point, 2, 1.9, [-0.8, -0.6])
  const out = [
    d`M${X(-1, hw)} ${top}`,
    d` Q50 ${top + 0.8} ${X(1, hw)} ${top}`,
    d` Q${X(1, hw * 0.92)} ${y(0.22)} ${shoulder(1)[0]} ${shoulder(1)[1]}`,
    through(edge),
    through(mirror([...edge.slice(0, -1).reverse(), shoulder(1)])),
    d` Q${X(-1, hw * 0.92)} ${y(0.22)} ${X(-1, hw)} ${top} Z`,
  ].join(' ')
  // Uneven, so they read as hair rather than the lines of a tooth's roots.
  const strands =
    strand(d`M${X(1, hw * 0.55)} ${top + 1.6} Q${X(1, hw * 0.42)} ${y(0.4)} ${X(1, 2)} ${y(0.66)}`, t, true) +
    strand(d`M${X(-1, hw * 0.2)} ${top + 2} Q${X(-1, hw * 0.24)} ${y(0.5)} ${X(-1, 1)} ${y(0.84)}`, t, true)
  return shape(out, t.base) + strands
}

/**
 * Black and brown beards that lie along the jaw (the full beard, the chops, the braided beard's
 * goatee) lift this much more, so the fur stands apart from the jaw's outline. A little: much more
 * and black reads as ash.
 */
const FULL_LIFT = 5

/** The braided beard's plait half-width at its top and at its end: fat, so each plait shows. */
const BEARD_PLAIT = 4.4
const BEARD_END = 3.6

/**
 * A braided chin beard: a goatee from under the lip (`belowMouth`, so it never seems to hang out of
 * the mouth), nearly as wide as the mouth there, funnelling down the chin in ragged tufts into one
 * fat plait that hangs past the chin and ends in a pale bead and a three-bristle brush. Dark strands
 * run down the goatee into the plait, and on pale hair the plait's Vs are only a shade darker. A
 * narrow plait from the lip down over the chest, nothing at its top wider than a knot, read at
 * 48 px as a necktie: its band a tie clip, its dark tassel the tie's point, pale hair with dark Vs
 * a striped tie. Wide at the top and gathered below, it's the tie's shape upside down.
 */
function beardBraided(ctx: Ctx): string {
  const { a, look, p } = ctx
  const t = beardTones(ctx, FULL_LIFT)
  // The goatee: MW·0.85 wide under the lip (inside the jaw's outline), narrowing straight down onto
  // the plait 6 above the chin; flared out at the top, it was a cup on a stem.
  const top = Math.min(belowMouth(ctx), a.J - 12)
  const gather = a.J - 6
  const wide = Math.min(a.MW * 0.85, headHalfWidth(look, a, top + 2) - 3)
  const foot = BEARD_PLAIT + 0.6
  // The plait: from inside the goatee to its end, the brush's tip on the canvas.
  const end = Math.min(a.J + 7, 97 - beadedLength(BEARD_END))
  const spine = sample([50, gather - 2], [50, gather + 2], [49.6, end - 2], [50.4, end], 4)
  const pale = toHsl(t.base)[2] > 50
  const plait = braid(spine, BEARD_PLAIT, BEARD_END, t, p.metalLight, { tick: W.feature, vee: shade(t.base, pale ? -12 : -18), knot: 'bead' })
  // The ragged sides, from side +1's top corner in to the plait and from side −1's back out: three
  // tufts a side, hanging down and out and leaning towards the plait.
  const corner = (s: Side): Pt => [X(s, wide), top + 1.2]
  const out = (s: Side): Pt => [s * 0.6, 0.8]
  const goatee = [
    d`M${X(-1, wide - 1.2)} ${top}`,
    d` Q50 ${top + 0.8} ${X(1, wide - 1.2)} ${top}`,
    d` Q${X(1, wide)} ${top} ${corner(1)[0]} ${corner(1)[1]}`,
    tufts(corner(1), [X(1, foot), gather], 3, 2, out(1)),
    d` Q50 ${gather + 1.4} ${X(-1, foot)} ${gather}`,
    tufts([X(-1, foot), gather], corner(-1), 3, 2, out(-1), true),
    d` Q${X(-1, wide)} ${top} ${X(-1, wide - 1.2)} ${top} Z`,
  ].join('')
  // Strands from under the lip down into the plait, one each side.
  const lines = both(s => strand(d`M${X(s, wide - 3)} ${top + 1.6} Q${X(s, wide * 0.55)} ${(top + gather) / 2} ${X(s, 2.4)} ${gather}`, t, true))
  return plait + shape(goatee, t.base) + lines
}

/**
 * Mutton chops: a wedge of fur on each jaw, growing from a narrow point just under the ear root
 * (about 2 wide) to 6.5 wide at the jaw corner. Its outer edge runs along the head outline, just
 * inside it, so the fur is attached to the jaw, then at the jaw corner bulges 2.4 past it and
 * breaks into two pointed tufts hanging over it; its inner edge juts into two big tufts aimed at the
 * mouth corner (up to 5 deep, as far as the mouth corner leaves room). Three short dark fur strokes
 * run down and out across it. An even strip floating on the cheek, with a square top, read as a
 * sidelock or a tassel past the goggles, and in white as a bone plate or a second pair of tusks; an
 * even strip inside the outline with one long pale streak down it, as a helmet's cheek guard, a
 * headset or a chin strap. Black and brown lift as the full beard does, or the fur and its outline
 * merged into one heavy jaw line. Beside a curled or waxed mustache's curl a wedge starts below it
 * (`curlFoot`).
 */
function beardChops(ctx: Ctx): string {
  const { a, look } = ctx
  const t = beardTones(ctx, FULL_LIFT)
  const low = a.M + 7
  const hw = (y: number) => headHalfWidth(look, a, y)
  // The inner tufts' depth: up to 5, their tips kept 2 outside the mouth corner, 2.5 at least.
  const depth = Math.max(2.5, Math.min(5, (hw(low) - 1.6 - 6.5 - (a.MW + 2)) / 0.94))
  const fur = shade(t.base, -18)
  return both(side => {
    const x = (dist: number) => X(side, dist)
    // The top: under the ear root, or under the curl, whichever is lower, but 6 above the corner.
    const top = Math.min(low - 6, Math.max(a.E + 2.5, curlFoot(ctx, side, hw(a.N) - 1.6 - 4 - depth)))
    const cheek = Math.max(top + 1, a.N + 1)
    // The outer edge, hugging the outline from the point under the ear down to the jaw corner, then
    // out past it.
    const outer = hugging(ctx, side, [top, (top + cheek) / 2, cheek + 1, Math.max(cheek + 2, a.M), a.M + 3], 1.6)
    const outLow: Pt = [x(hw(low) + 2.4), low]
    // The inner edge, from the bottom back up: 6.5 in from the outer edge at the jaw corner, 4 at
    // the cheekbone with the tufts between, then narrowing to 2 at the top.
    const inLow: Pt = [x(hw(low) - 1.6 - 6.5), low + 0.6]
    const inMid: Pt = [x(hw(cheek) - 1.6 - 4), cheek]
    const inTop: Pt = [x(hw(top) - 1.6 - 2), top + 1]
    // Towards the mouth corner: in, and a little up.
    const aim: Pt = [-side * 0.94, -0.34]
    const out = [
      smooth(outer),
      d` Q${x(hw(a.M + 5) + 1)} ${a.M + 5} ${outLow[0]} ${outLow[1]}`,
      // Two tufts hanging down over the jaw's outline, flicked out.
      tufts(outLow, inLow, 2, 2.6, [side * 0.3, 0.95], true),
      tufts(inLow, inMid, 2, depth, aim, true),
      d` Q${x(hw((cheek + top) / 2) - 1.6 - 3)} ${(cheek + top) / 2} ${inTop[0]} ${inTop[1]}`,
      d` L${pt(outer, 0)[0]} ${pt(outer, 0)[1]} Z`,
    ].join(' ')
    // Short fur strokes down and out across the lower wedge, in a darker shade: a long pale streak
    // down it was a polished metal edge.
    const strokes = [0, 1, 2]
      .map(i => {
        const y = cheek + 1 + (low - cheek - 3) * (i / 2)
        return path(d`M${x(hw(y) - 5.2)} ${y} L${x(hw(y + 2.4) - 2.8)} ${y + 2.4}`, { stroke: fur, sw: W.detail })
      })
      .join('')
    return shape(out, t.base) + strokes
  })
}

/**
 * The full beard: a bushy mass from the cheeks (N + 2) over the whole jaw and chin, bare only round
 * the mouth. Down the cheeks its outer edge hugs the head outline from inside (a beard bushing past
 * the cheeks too made a tusked dwarf), the band 4 wide at the top and widening; from the jaw corner
 * it bulges past the outline into three big rounded lobes under the jaw and chin. Its inner edge
 * keeps MW + 4 out beside the mouth and runs under it in a fringe of tufts pointing up, clear of
 * the lip, so the underbite and tusks still show. Short light flicks low on both sides and a few
 * dark strands make it hair. A band 2 wide up the cheeks with five shallow scallops read at 48 px
 * as a chin strap, rust hugging the mouth as big red lips, its one long streak as a headset boom.
 */
function beardFull(ctx: Ctx): string {
  const { a, look } = ctx
  const t = beardTones(ctx, FULL_LIFT)
  const top = a.N + 2
  const hw = (y: number) => headHalfWidth(look, a, y)
  // Side +1's outer edge: inside the outline down the cheek, then out across it at the jaw corner.
  const cheek = hugging(ctx, 1, [top, a.N + 6, a.M + 1], 1.8)
  // The hem, from that corner round under the chin to the middle: the lobes bulge 3 beyond it.
  const chin = hw(a.J)
  const hem: Pt[] = [
    [X(1, hw(a.M + 5) + 0.8), a.M + 5],
    [X(1, hw(a.J - 4) + 2), a.J - 3],
    [X(1, chin * 0.55), a.J + 2.2],
    [50, a.J + 2.6],
  ]
  const corner = pt(hem, 0)
  const bottom = [...hem, ...mirror(hem.slice(0, -1).reverse())]
  // The inner edge: 4 in from the outer at the top, MW + 4 out beside the mouth, then round under
  // it along a fringe of tufts pointing up at it, their tips clear of the lip.
  const strap = (s: Side) => X(s, hw(top) - 1.8 - 4)
  const side = (s: Side) => X(s, a.MW + 4)
  const under = Math.min(belowMouth(ctx) + 2.2, a.J - 6)
  const span = a.MW - 2.5
  const out = [
    smooth([...cheek, corner]),
    scallops(bottom, 3, 3),
    smoothOn(mirror([...cheek, corner].reverse())),
    d` L${strap(-1)} ${top}`,
    d` C${side(-1)} ${a.N + 4} ${side(-1)} ${a.M - 2} ${side(-1)} ${a.M + 1}`,
    d` C${side(-1)} ${under - 1} ${X(-1, span + 3)} ${under} ${X(-1, span)} ${under}`,
    tufts([X(-1, span), under], [X(1, span), under], 4, 1.4, [0, -1]),
    d` C${X(1, span + 3)} ${under} ${side(1)} ${under - 1} ${side(1)} ${a.M + 1}`,
    d` C${side(1)} ${a.M - 2} ${side(1)} ${a.N + 4} ${strap(1)} ${top} Z`,
  ].join(' ')
  // Short light flicks low on both sides, down the jaw's bulge and either side of the chin: no
  // pale arc runs up the cheek.
  const flicks = both(s =>
    [
      d`M${X(s, hw(a.M + 5) - 1)} ${a.M + 5} Q${X(s, hw(a.M + 8))} ${a.M + 8} ${X(s, hw(a.J - 4) - 0.5)} ${a.J - 2}`,
      d`M${X(s, chin * 0.75)} ${a.J - 1} Q${X(s, chin * 0.6)} ${a.J + 1.4} ${X(s, chin * 0.35)} ${a.J + 2.4}`,
    ]
      .map(data => streak(data, t, W.detail))
      .join(''),
  )
  // Strands fanning out and down from under the mouth into the side lobes, curved and uneven:
  // upright ones, white between them, read as the gaps between big teeth.
  // Each as [start out from the centre line, start below the fringe, end as a share of the chin].
  const fans: readonly (readonly [number, number, number])[] = [
    [3, 1.6, 0.6],
    [8, 0.6, 0.85],
  ]
  const strands = both(s =>
    fans
      .map(([dx, dy, k]) => {
        const y0 = under + 1.8 + dy
        const x0 = X(s, dx)
        return strand(d`M${x0} ${y0} Q${x0 + s * 0.6} ${(y0 + a.J) / 2 + 1.6} ${X(s, chin * k + 2)} ${a.J + 1}`, t, true)
      })
      .join(''),
  )
  return shape(out, t.base) + flicks + strands
}

const BEARD_DRAW: Record<BeardName, Draw> = {
  none: () => '',
  tuft: beardTuft,
  braided: beardBraided,
  chops: beardChops,
  full: beardFull,
}

/** Layer 14: the beard, under the mouth. */
export function beard(ctx: Ctx): string {
  return BEARD_DRAW[ctx.look.beard](ctx)
}

// Mustaches -------------------------------------------------------------------------------------
// They lie on the upper lip, between the nose and the mouth line (M), and are drawn over the mouth.
// All but the horseshoe and drooper start below the nose with skin between (`belowNose`), and the
// slim ones (handlebar, pencil, curly, braids) stop at or just above the mouth line, so the mouth
// shows beneath: a smooth piece down over it, curved, read as a pair of lips. Tusks are drawn
// after, at 50 ± TD, in front of the thin ones and behind the wide ones (orc.ts, WIDE_MUSTACHES).
// Nothing that hangs past the mouth runs down beside a tusk: the horseshoe's arms hang outside
// them (`tuskReach`), and the drooper's strands and the braids' plaits turn down behind them and
// splay out across them (`SPLAY`). Most halves are their own closed shape, so the outline or skin
// parts them; the walrus, imperial, horseshoe, curly and braids' lip piece are one shape (a
// full-height parting in a pale one read as two teeth). The thinner ones are outlined at W.detail,
// so their colour still shows inside the ink at 48 px, and most carry a light streak or dark fur
// strokes, which is what makes a mustache read as hair.

/** The handlebar curl's half-width, outline included: `outlined` at 2. */
const CURL_HALF = (2 + 2.5) / 2
/** The curly's coil ribbon's half-width at its root and at its tapered tip, outlined at W.detail. */
const COIL_ROOT = 2.2
const COIL_TIP = 0.6
/** The curly's coil at its widest, outline included. */
const COIL_HALF = COIL_ROOT + W.detail / 2
/** The coil's radius where it leaves the wing: it may shrink to COIL_LEAST, and no further. */
const COIL_R = 3.4
const COIL_LEAST = 3
/** How far round the coil turns, in degrees, and its radius at the tip as a share of its start. */
const COIL_TURN = 270
const COIL_IN = 0.8

/** The drooper's top line at the middle, just under the nostrils. */
const lipTop = (a: Anchors) => a.N + 3.4

/** The handlebar's and curly's bow top: out where the nose is narrow, so a little nearer it. */
const bowTop = (face: Face) => belowNose(face, 6) - 1

/**
 * The handlebar's hooked curl on `side`, from its root under the wing's end, as [root, c1, c2,
 * mid, c3, c4, end]. Under a rim on its side, or out near the head's outline (the lantern's jaw),
 * it shrinks towards its root until it clears the rim and keeps 2 of skin inside the outline.
 */
function handlebarHook(ctx: Ctx, side: Side): Pt[] {
  const w = ctx.a.MW
  const y = bowTop(ctx)
  const x = (dist: number) => X(side, dist)
  const root: Pt = [x(w + 5), y + 3.9]
  const hook: Pt[] = [
    [x(w + 9.5), y + 2.1], [x(w + 10), y - 4.1], [x(w + 7.4), y - 5.1], [x(w + 5.4), y - 5.7], [x(w + 4.6), y - 3.1], [x(w + 6.6), y - 2.5],
  ]
  const curl = cubicPoints([root, ...hook])
  const fit = Math.min(rimFit(ctx, side, curl, root, CURL_HALF + 1.5), outlineFit(ctx, curl, root, CURL_HALF + 2))
  return [root, ...shrink(hook, root, fit)]
}

/** A curly's coil: its spine, from its root under the wing's end, and its half-width at each point. */
interface Coil {
  spine: Pt[]
  half: number[]
}

/**
 * The curly's coil on `side`, or none where it can't fit. From its root under the wing's end it
 * runs out along the bottom, up the outside and back over the top towards the nose, COIL_TURN
 * round with its radius closing in: an open hook, a 6 or a 9, tapering from COIL_ROOT to a point.
 * It sits as high as it may with its outline 1.5 clear of the eye's (or the eyewear's rim on that
 * side) and 2 of skin inside the head's outline: it moves out (up to 4), then down (to 2.5 above
 * the bow), and only then shrinks, to COIL_LEAST at the least. A closed ring with a round end read
 * as a knob: level with the bar's end, the mustache was a dog bone or a barbell; lifted beside the
 * eye, ring and eye merged into a figure-eight (raccoon rings in black, spectacles in white); shrunk
 * under a rim, it was a knob on the bar again. Where none fits, resolve gives the orc a handlebar
 * instead (`curlyFits`).
 */
function curlyCoil(face: Face, side: Side): Coil | undefined {
  const { a } = face
  const y = bowTop(face)
  const root: Pt = [X(side, a.MW + 0.6), y]
  const rim = rimOn(face, side) ?? BARE_EYE
  const coilAt = (r: number, lift: number, out: number): Coil => {
    const [cx, cy] = [X(side, a.MW + 4.6 + out), y - lift]
    // The turn starts where the root lies from the centre, so the ribbon leaves the wing smoothly.
    const start = (Math.atan2(root[1] - cy, side * (root[0] - cx)) * 180) / Math.PI
    const ring = spiral(cx, cy, r, r * COIL_IN, start, -COIL_TURN, side)
    const taper = ring.map((_, i) => COIL_ROOT + ((COIL_TIP - COIL_ROOT) * i) / (ring.length - 1))
    return { spine: [root, ...ring], half: [COIL_ROOT, ...taper] }
  }
  const fits = ({ spine, half }: Coil) =>
    spine.every((p, i) => {
      const edge = (half[i] ?? 0) + W.detail / 2
      return clearOf(face, side, rim, p, edge + 1.5) && insideOf(face, p, edge + 2)
    })
  for (const r of [COIL_R, (COIL_R + COIL_LEAST) / 2, COIL_LEAST]) {
    for (let lift = 4.6; lift > 2.4; lift -= 0.3) {
      for (let out = 0; out <= 4; out++) {
        const coil = coilAt(r, lift, out)
        if (fits(coil)) return coil
      }
    }
  }
  return undefined
}

/**
 * Whether the curly's coils fit both sides of this face (`curlyCoil`). Under rims round the eyes, or
 * on the bean with a high bow under the nose, they don't, and resolve curls the mustache as a
 * handlebar instead, whose slim hook clears rims and the jaw.
 */
export function curlyFits(look: Look): boolean {
  const face: Face = { look, a: anchorsFor(look) }
  return curlyCoil(face, 1) !== undefined && curlyCoil(face, -1) !== undefined
}

/**
 * How far down a curled or waxed mustache's curl (the handlebar's hook, the curly's coil, the
 * imperial's horn) reaches, its half-width and a unit of skin included, where it comes within a
 * unit of `out` from the centre line on `side`: where mutton chops beside it may start. At 48 px a
 * curl lying on a chop made one dark blob each side, like earmuffs. 0 for a mustache without one.
 */
function curlFoot(ctx: Ctx, side: Side, out: number): number {
  const { mustache } = ctx.look
  const curl =
    mustache === 'handlebar'
      ? cubicPoints(handlebarHook(ctx, side))
      : mustache === 'curly'
        ? (curlyCoil(ctx, side)?.spine ?? [])
        : mustache === 'imperial'
          ? cubicPoints(imperialHorn(ctx, side))
          : []
  const half = mustache === 'handlebar' ? CURL_HALF : mustache === 'curly' ? COIL_HALF : W.detail / 2
  return Math.max(0, ...curl.filter(([x]) => Math.abs(x - 50) + half + 1 >= out).map(([, y]) => y + half + 1))
}

/**
 * Waxed handlebar: a slim bow under the nose, skin between, thickest halfway out and thin at the
 * parting and along the arms, which run well past the mouth and hook up at the tips. Its bottom
 * stays above the mouth line, so the mouth shows beneath: a full lip piece hid it, and in rust or
 * chestnut that even lozenge read as red lips, its hooks as rosy cheeks. The hooks are slim and
 * lifted, so they point upward like waxed ends. No streak: on a bow this slim it would cover the
 * colour.
 */
function handlebar(ctx: Ctx): string {
  const { a } = ctx
  const t = facialTones(ctx)
  const w = a.MW
  // The bow's top (`bowTop`), its top at the parting, and its bottom: up to 4.4 deep, 2.4 above
  // the mouth line where the face has room.
  const y = bowTop(ctx)
  const mid = Math.min(y + 1.6, belowNose(ctx, 0))
  const low = Math.max(y + 3, Math.min(y + 4.4, a.M - 2.4))
  const lowMid = Math.min(mid + 2.4, low)
  return both(side => {
    const x = (dist: number) => X(side, dist)
    const wing = [
      d`M50 ${mid}`,
      d`C${x(2)} ${y + 0.2} ${x(w * 0.3)} ${y - 0.4} ${x(w * 0.55)} ${y - 0.2}`,
      d`C${x(w * 0.8)} ${y} ${x(w - 1)} ${y + 0.2} ${x(w + 1)} ${y + 1}`,
      d`C${x(w + 3.5)} ${y + 2.2} ${x(w + 5)} ${y + 2.6} ${x(w + 6.2)} ${y + 2.6}`,
      d`L${x(w + 5.8)} ${y + 5.2}`,
      d`C${x(w + 2)} ${y + 6} ${x(w - 1)} ${low + 0.4} ${x(w * 0.5)} ${low}`,
      d`C${x(w * 0.25)} ${low} ${x(2)} ${lowMid + 0.4} 50 ${lowMid} Z`,
    ].join(' ')
    const hook = handlebarHook(ctx, side)
    const curl = d`M${pt(hook, 0)[0]} ${pt(hook, 0)[1]}` + cubicsOn(hook.slice(1))
    return outlined(curl, t.base, 2) + shape(wing, t.base)
  })
}

/**
 * The walrus: two big bushy lobes parted under the nose, sweeping out over the upper lip and
 * drooping past the mouth corners, so its outline is a mustache's, not an open mouth's slab. It
 * starts below the nose (`belowNose`), skin between, or nose and walrus fuse into one muzzle. The
 * lower edges rise towards the middle, where short tufts hang just over the mouth line, and a
 * second row of tufts in the dark shade fills the notches between them, so the mouth never shows
 * through as a pair of nostrils. Both halves are one shape, parted by a short dark strand rather
 * than the outline: a full-height outline split a pale walrus into two big teeth. The strands fan
 * out from the parting and stop short of the tips (run into them, they cut the edge into teeth).
 */
function walrus(ctx: Ctx): string {
  const { a } = ctx
  const t = facialTones(ctx)
  const w = a.MW + 3.5
  const lobe = belowNose(ctx, w * 0.45)
  const mid = Math.min(lobe + 3, Math.max(lobe + 1, belowNose(ctx, 0)))
  const inner: Pt = [50, a.M + 0.2]
  const outer = (side: Side): Pt => [X(side, w + 0.6), a.M + 2.8]
  // The top edge of side +1, from the parting out to its drooping end, as cubic points.
  const brow = (side: Side): Pt[] => {
    const x = (dist: number) => X(side, dist)
    const [ox, oy] = outer(side)
    return [
      [50, mid],
      [x(w * 0.22), lobe - 0.6],
      [x(w * 0.6), lobe - 0.6],
      [x(w - 2), lobe + 2.6],
      [x(w + 1.4), lobe + 4.4],
      [x(w + 2.2), oy - 4],
      [ox, oy],
    ]
  }
  const cubics = (pts: readonly Pt[]) =>
    [1, 4]
      .map(i => {
        const [[ax, ay], [bx, by], [cx, cy]] = [pt(pts, i), pt(pts, i + 1), pt(pts, i + 2)]
        return d` C${ax} ${ay} ${bx} ${by} ${cx} ${cy}`
      })
      .join('')
  // The whole outline with `count` tufts a side, `depth` deep, leaning out as combed.
  const outline = (count: number, depth: number) =>
    d`M50 ${mid}` +
    cubics(brow(1)) +
    tufts(outer(1), inner, count, depth, DOWN, true) +
    tufts(inner, outer(-1), count, depth) +
    cubics(brow(-1).reverse()) +
    ' Z'
  const strands = both(side => {
    const x = (dist: number) => X(side, dist)
    return [0, 1, 2]
      .map(i => {
        const [tx, ty] = tuftTip(outer(side), inner, 3, 4, i, DOWN, true)
        const fromY = mid + 1.4 + i * 0.6
        return strand(d`M${x(1.4 + i * 1.4)} ${fromY} Q${tx - side * 1.2} ${fromY} ${tx} ${ty - 2.6}`, t)
      })
      .join('')
  })
  const parting = strand(d`M50 ${mid + 0.6} L50 ${mid + 2.6}`, t)
  const shine = both(side =>
    streak(
      d`M${X(side, 2.6)} ${lobe + 1.4} C${X(side, w * 0.3)} ${lobe} ${X(side, w * 0.62)} ${lobe + 0.4} ${X(side, w * 0.8)} ${lobe + 4}`,
      t,
    ),
  )
  return shape(outline(4, 3.2), t.dark) + shape(outline(3, 4), t.base) + strands + parting + shine
}

/** The imperial's band: its bottom, just over the mouth line, and its top past the nose, 4 above. */
const imperialLow = (a: Anchors) => a.M - 1
const imperialPast = (a: Anchors) => Math.max(a.N + 1, imperialLow(a) - 4)

/**
 * The imperial's horn on `side`, leaving the band just past the mouth corner, as cubic points from
 * the band's top there out, then up to a point at nose height and back down to the band's bottom:
 * [top, c1, c2, tip, c3, c4, foot]. Under a rim on its side, or out near the head's outline, it
 * shrinks towards its foot until it clears the rim and keeps 2 of skin inside the outline.
 */
function imperialHorn(ctx: Ctx, side: Side): Pt[] {
  const { a } = ctx
  const x = (dist: number) => X(side, dist)
  const [low, past] = [imperialLow(a), imperialPast(a)]
  const root = a.MW + 1
  const tip: Pt = [x(root + 8.5), Math.max(a.N - 2, a.E + 6.5)]
  const top: Pt = [x(root), past]
  const foot: Pt = [x(root), low]
  const bend: Pt[] = [[x(root + 6), past + 0.8], [tip[0] - side * 0.4, tip[1] + 3], tip, [tip[0] + side * 1.4, tip[1] + 5], [x(root + 7), low + 0.4]]
  const points = cubicPoints([top, ...bend, foot])
  const fit = Math.min(rimFit(ctx, side, points, foot, W.detail / 2 + 1.5), outlineFit(ctx, points, foot, W.detail / 2 + 2))
  return [top, ...shrink(bend, foot, fit), foot]
}

/**
 * The imperial: a waxed mustache in one piece. Its top hugs the nostrils in a shallow V, with no
 * seam down the middle, its bottom is a row of short tufts just over the mouth line, and past each
 * mouth corner it sweeps out over the cheek, level at first, then up to a stiff waxed point at
 * nose height (`imperialHorn`), a dark strand along it. It's drawn over the mouth and the tusks
 * (orc.ts, WIDE_MUSTACHES), 4 deep past the nose, so long tusks' tips show above it. Two wings
 * parted by an outlined seam, with horns climbing beside the nose, read as a respirator or a
 * muzzle; slots cut for the tusks, so they showed whole, left a dark band between two fangs: an
 * open mouth.
 */
function imperial(ctx: Ctx): string {
  const { a } = ctx
  const t = facialTones(ctx)
  // The top hugs the nose out to its half-width and outline (`belowNose`, less the 0.3 the thinner
  // outline frees), but keeps 2.8 of depth at the parting.
  const [low, past] = [imperialLow(a), imperialPast(a)]
  const nose = NOSE_FOOT[ctx.look.nose][2] + 1.5
  const topAt = (dx: number) => (dx < nose ? Math.min(low - 2.8, Math.max(past, belowNose(ctx, dx) - 0.3)) : past)
  const horn = { 1: imperialHorn(ctx, 1), [-1]: imperialHorn(ctx, -1) } as const
  // The top from side −1's horn root through the V to side +1's.
  const root = a.MW + 1
  const steps = Math.ceil(root)
  const top = Array.from({ length: steps * 2 + 1 }, (_, i): Pt => {
    const dx = root * (i / steps - 1)
    return [50 + dx, topAt(Math.abs(dx))]
  })
  const centre: Pt = [50, low]
  const outline = [
    d`M${X(-1, root)} ${low}`,
    cubicsOn([...horn[-1]].reverse().slice(1)),
    smoothOn(top),
    cubicsOn(horn[1].slice(1)),
    tufts([X(1, root), low], centre, 3, 1.3, DOWN, true),
    tufts(centre, [X(-1, root), low], 3, 1.3),
    ' Z',
  ].join('')
  // A strand from the band out along each horn (darker on pale hair: a white horn is a third tusk).
  const strands = both(side => {
    const [tx, ty] = pt(horn[side], 3)
    return strand(d`M${X(side, root - 4)} ${low - 2} Q${X(side, root + 4)} ${low - 1.4} ${tx - side * 0.8} ${ty + 2.8}`, t, true)
  })
  return path(outline, { fill: t.base, sw: W.detail }) + strands
}

/**
 * The pencil: a thin waxed line along the upper lip, parted under the nose: a flat lens of colour
 * each side with no outline, so its whole height is colour, out to the mouth corner, where a slim
 * outlined flick turns up to a waxed point at MW + 6, outside the tusks. Its top clears the nose by
 * the nose's outline and a sliver of skin, and its bottom stays 2.6 above the mouth line. Outlined
 * at W.detail, a lens this thin was all ink: a second dark lip line, its flicks smile creases.
 */
function pencil(ctx: Ctx): string {
  const { a } = ctx
  const t = facialTones(ctx)
  const low = a.M - 2.6
  const w = a.MW
  // The top edge at each distance out: 3.4 above the bottom, or lower under the nose (out to its
  // half-width and outline: `belowNose` less the outline the lens doesn't have), at least 1.2 tall.
  const nose = NOSE_FOOT[ctx.look.nose][2] + 1.5
  const topAt = (dx: number) => Math.min(low - 1.2, Math.max(low - 3.4, dx < nose ? belowNose(ctx, dx) - W.feature / 2 : 0))
  const tip: Pt = [w + 6, a.N - 1]
  return both(side => {
    const x = (dist: number) => X(side, dist)
    const top: Pt[] = [1.6, 4, 6, 8.5, w - 1, w + 1].map((dx): Pt => [x(dx), topAt(dx)])
    const lens = [
      d`M${x(1.6)} ${(topAt(1.6) + low) / 2}`,
      d` Q${x(1.6)} ${topAt(1.6)} ${pt(top, 1)[0]} ${pt(top, 1)[1]}`,
      smoothOn(top.slice(1)),
      d` Q${x(w + 2.4)} ${low - 1.6} ${x(w + 1)} ${low}`,
      d` L${x(3.4)} ${low}`,
      d` Q${x(1.6)} ${low} ${x(1.6)} ${(topAt(1.6) + low) / 2} Z`,
    ].join(' ')
    // The flick, drawn first: the lens covers its outline where they join.
    const flick = outlined(d`M${x(w - 0.4)} ${low - 1.6} C${x(w + 2.4)} ${low - 1.8} ${x(w + 4.6)} ${tip[1] + 3} ${x(tip[0])} ${tip[1]}`, t.base)
    return flick + flat(lens, t.base)
  })
}

/**
 * The chevron: a thick brush over the whole upper lip, peaked under the nose and wider than the
 * mouth, its lower edge a comb of pointed bristles that hang just over the mouth line, flicked
 * outward. Dark strands fan out from the parting into the bristles, so a pale one reads as a
 * brush rather than a row of teeth.
 */
function chevron(ctx: Ctx): string {
  const { a } = ctx
  const t = facialTones(ctx)
  const peak = a.N + 2.8
  const low = a.M - 0.6
  const w = a.MW + 2.5
  const depth = 3
  return both(side => {
    const x = (dist: number) => X(side, dist)
    const outer: Pt = [x(w), low + 1.2]
    const inner: Pt = [50, low - 0.8]
    const wing = [
      d`M50 ${peak}`,
      d`C${x(6)} ${peak - 0.6} ${x(w - 2)} ${low - 4.5} ${x(w + 1.2)} ${low - 0.6}`,
      d`Q${x(w + 2)} ${low + 1.2} ${outer[0]} ${outer[1]}`,
      tufts(outer, inner, 3, depth, DOWN, true),
      ' Z',
    ].join(' ')
    const comb = [0, 1, 2]
      .map(i => {
        const [tx, ty] = tuftTip(outer, inner, 3, depth, i, DOWN, true)
        const fromX = x(1.8 + i * 1.4)
        const fromY = peak + 2.8 + (2 - i) * 0.8
        return strand(d`M${fromX} ${fromY} Q${tx - side * 1.6} ${fromY + 0.4} ${tx} ${ty - 1.6}`, t)
      })
      .join('')
    const shine = streak(d`M${x(2.4)} ${peak + 2.2} Q${x(w * 0.35)} ${peak + 1.6} ${x(w * 0.62)} ${peak + 3.6}`, t)
    return shape(wing, t.base) + comb + shine
  })
}

/**
 * How far out from the centre line the tusks' bases reach, outline included (face.ts `tuskSpans`):
 * hair hanging beside them starts outside it. A tusk's flank only narrows above its base.
 */
function tuskReach(ctx: Ctx): number {
  return Math.max(0, ...tuskSpans(ctx).map(s => Math.abs(s.x - 50) + s.halfWidth)) + W.feature / 2
}

/**
 * The horseshoe: two lobes on the upper lip, their tops hugging the nose and rising beside it to
 * N + 1.6, parted at the centre by a V in their tufted lower edge, which stays 3 above the mouth
 * line so the mouth (the expression) shows beneath. Past the mouth corners they round over in a
 * broad arch into two arms, 6.5 wide there and tapering to 5, ragged down their outer edges, that
 * hang outside the tusks to tufted ends flicked outward: as low as J − 3, but keeping 2 of skin
 * inside the jaw's outline (on the bean's narrow jaw they end higher). Outlined at W.detail, one
 * shape, with short dark fur strokes down the arms. A bar on the mouth line with square shoulders
 * and even arms read as a horse bit or a muzzle, a long light streak down each arm as polished
 * metal; a thin bar there as a row of teeth, arms tapering to points beside the tusks as a second
 * pair of fangs, or in black as insect mandibles. Pale arms keep 2 of skin from the tusks where the
 * jaw leaves room, or each arm and the cream tusk beside it merged into one fang.
 */
function horseshoe(ctx: Ctx): string {
  const { a, look } = ctx
  const t = facialTones(ctx)
  const w = a.MW
  const pale = toHsl(t.base)[2] > 50
  // The lobes' top: on the nose's lower outline, then N + 1.6 beside it.
  const y = a.N + 1.6
  const nose = NOSE_FOOT[look.nose][2]
  const hug = (dx: number) => Math.max(y, belowNose(ctx, dx) - 2.2)
  const mid = hug(0)
  // The lower edge: the tufts' tips 3 above the mouth line, the V's apex 1.4 above their roots.
  const dep = 1.8
  const base = a.M - 3 - dep
  const notch = Math.max(mid + 1, base - 1.4)
  // How far out the arm may reach at a height, 2 of skin inside the jaw's outline; its inner edge
  // is clear of the tusks, but where that leaves no arm it moves in behind them.
  const room = (yy: number) => headHalfWidth(look, a, yy) - W.silhouette / 2 - 2 - W.detail / 2
  const ai = Math.min(Math.max(w + 3.4, tuskReach(ctx) + (pale ? 2 : 0.6) + W.detail / 2), room(a.M + 4) - 4)
  const x = (dist: number) => X(1, dist)
  // Side +1's arm, from the lobe's top round the shoulder, down the outer edge, across the tufted
  // end and back up the inner edge, for an end height and the widths at its top and its end.
  const arm = (end: number, topW: number, endW: number): Seg[] => {
    const shoulder: Pt = [x(ai + topW), y + 4.5]
    const outEnd: Pt = [x(ai + endW), end - 1.6]
    return [
      [[x(ai + topW * 0.4), y - 0.6], [x(ai + topW + 0.2), y + 1], shoulder],
      ...tuftSegs(shoulder, outEnd, 2, 2, [0.85, 0.5]),
      ...tuftSegs(outEnd, [x(ai - 0.2), end - 0.6], 2, 2.6, [0.35, 1], true),
      [[x(ai - 0.4), end - 3]],
      [[x(ai), base + 2.2]],
    ]
  }
  const inside = (segs: readonly Seg[]) => segs.every(seg => seg.every(([px, py]) => px - 50 <= room(py)))
  const topRoom = Math.min(room(y + 1), room(y + 4.5), room(y + 7)) - ai - 1.8
  const sized = (end: number, k = 1) => arm(end, k * Math.min(6.5, topRoom), k * Math.min(5, room(end + 1.5) - ai - 1.2))
  // The lowest end, from J − 3 up, where an arm at least 3.6 wide at its end fits; failing that,
  // the shortest arm, narrowed until it fits.
  let end = a.J - 3
  while (end > a.M + 3 && !(room(end + 1.5) - ai - 1.2 >= 3.6 && inside(sized(end)))) end -= 0.5
  let k = 1
  while (k > 0.5 && !inside(sized(end, k))) k -= 0.05
  const half: Seg[] = [
    [[x(nose * 0.5), mid], [x(nose * 0.8), hug(nose * 0.8)], [x(nose + 0.6), hug(nose + 0.6)]],
    [[x(nose + 2), y]],
    ...sized(end, k),
    [[x(ai), base], [x(ai - 2.4), base]],
    ...tuftSegs([x(ai - 2.4), base], [x(2.6), base - 0.3], 3, dep, DOWN, true),
    [[50, notch]],
  ]
  const top: Pt = [50, mid]
  const outline = `${d`M${top[0]} ${top[1]}`}${segsOn(half)}${segsOn(backwards(top, half).map(mirror))} Z`
  // Short fur strokes down each arm, staggered, darker on pale hair.
  const fur = shade(t.base, pale ? -28 : -18)
  const strokes = both(side =>
    [0, 1, 2]
      .map(i => {
        const yy = y + 5.5 + (end - y - 10) * (i / 2)
        const at = ai + 1.2 + (i % 2) * 1.6
        return path(d`M${X(side, at)} ${yy} L${X(side, at + 0.8)} ${yy + 3.4}`, { stroke: fur, sw: W.detail })
      })
      .join(''),
  )
  return path(outline, { fill: t.base, sw: W.detail }) + strokes
}

/** How far the drooper's fork reaches below and out from its strand's end. */
const FORK = 3

/** How far a hanging strand's end may lie further out than its root, per unit down: about 23°. */
const SPLAY = 0.42

/**
 * The drooper (fu manchu): a lip bar about 3.5 thick whose ends turn down behind the tusks and hang
 * as strands splayed about 23° outward, so they cross the upright tusks instead of running beside
 * them: about 5.5 wide past the tusks, with two tufts flicking out down each, and ending in a fork
 * whose outer prong flicks outward, all outlined at W.detail. They end as low as J − 4, the fork
 * keeping 2 of skin inside the jaw's outline, so on a jaw that narrows they end higher. On pale
 * hair each strand below the lip is a deeper shade, so it's never the tusks' cream, and on dark
 * hair a darker strand runs down it. Strands hanging straight down beside the tusks read, in white
 * or ash, as a second pair of tusks (four fangs round the mouth), and with a chin tuft as three bars
 * hanging from the mouth; tapered to single points they were fangs; placed by the mouth's width
 * alone, their tips ran over the jaw's outline and notched it.
 */
function drooper(ctx: Ctx): string {
  const { a, look } = ctx
  const t = facialTones(ctx)
  const y = lipTop(a)
  const w = a.MW
  const pale = toHsl(t.base)[2] > 50
  // The strand's root, behind the tusk.
  const root: Pt = [w - 0.2, y + 3.4]
  const half = [1.8, 1.8, 2.4, 2.8, 2.6, 2]
  // How deep the tufts down the strand's outside jut.
  const tuft = 2.6
  // Side `side`'s strand for an end height and how far out the end is: its spine, its edges (the
  // lower one along the bar runs on down the strand's inside, the upper one down its outside: the
  // spine's normal points down on side +1's bar, up on side −1's), the fork's three points, set
  // along the strand's end (u, down it) and across it (v, outward), and the outer tufts' tips.
  const strandAt = (side: Side, end: number, out: number) => {
    const x = (dist: number) => X(side, dist)
    const along = (u: number, bow: number): Pt => [x(root[0] + (out - root[0]) * u + bow), root[1] + (end - root[1]) * u]
    const spine: Pt[] = [[x(0), y + 1.8], [x(w * 0.5), y + 1.2], [x(w - 1.4), y + 2], along(0.35, 0.4), along(0.7, 0.3), along(1, 0)]
    const edge = (k: number): Pt[] =>
      spine.map(([px, py], i): Pt => {
        const [nx, ny] = normal(spine, i)
        const h = (half[i] ?? 0) * k
        return [px + nx * h, py + ny * h]
      })
    const inner = edge(side)
    const outer = edge(-side)
    const [ex, ey] = pt(spine, 5)
    const [px, py] = pt(spine, 4)
    const len = Math.hypot(ex - px, ey - py) || 1
    const u: Pt = [(ex - px) / len, (ey - py) / len]
    const v: Pt = [u[1] * side, -u[0] * side]
    const fork = (du: number, dv: number): Pt => [ex + u[0] * du + v[0] * dv, ey + u[1] * du + v[1] * dv]
    const prongs = [fork(FORK * 1.1, -0.8), fork(0.8, 0.5), fork(FORK * 0.9, FORK)]
    // The tufts flick out and down.
    const flick: Pt = [side * 0.8, 0.6]
    const tips = [5, 4].map(i => tuftTip(pt(outer, i), pt(outer, i - 1), 1, tuft, 0, flick, true))
    return { along, spine, inner, outer, prongs, flick, tips }
  }
  // The lowest end, from J − 4 up, whose strand splays out by SPLAY, or by 3 at the least, with
  // every point 2 inside the jaw's outline (its own outline too).
  const room = (yy: number) => headHalfWidth(look, a, yy) - W.silhouette / 2 - 2 - W.detail / 2
  const fits = (end: number, out: number) => {
    const s = strandAt(1, end, out)
    return [...s.inner, ...s.outer, ...s.prongs, ...s.tips].every(([px, py]) => px - 50 <= room(py))
  }
  const pick = (): readonly [number, number] => {
    for (let end = a.J - 4; end > a.M + 3; end -= 0.5) {
      for (let out = root[0] + SPLAY * (end - root[1]); out >= root[0] + 3; out -= 0.5) if (fits(end, out)) return [end, out]
    }
    return [a.M + 3, root[0] + 3]
  }
  const [end, out] = pick()
  return both(side => {
    const { along, spine, inner, outer, prongs, flick } = strandAt(side, end, out)
    const outline = [
      smooth(inner),
      through([...prongs, pt(outer, 5)]),
      tufts(pt(outer, 5), pt(outer, 4), 1, tuft, flick, true),
      tufts(pt(outer, 4), pt(outer, 3), 1, tuft, flick, true),
      smoothOn([pt(outer, 3), pt(outer, 2), pt(outer, 1), pt(outer, 0)]),
      ' Z',
    ].join('')
    // Below the lip, a pale strand is a deeper shade, clear of the tusks' cream; a dark one has a
    // darker strand down it.
    const deep = pale ? flat(ribbon(spine.slice(2), half.slice(2).map(h => h - 0.4)), shade(t.base, -22)) : ''
    const [[ax, ay], [bx, by], [cx, cy]] = [along(0.3, 0.4), along(0.6, 0.6), along(0.92, 0)]
    const hang = pale ? '' : strand(d`M${ax} ${ay} Q${bx} ${by} ${cx} ${cy}`, t)
    return flat(outline, t.base) + deep + hang + path(outline, { fill: 'none', sw: W.detail })
  })
}

/** A spiral, as points: from `start` degrees, turning `turn` degrees (negative turns up on side +1). */
function spiral(cx: number, cy: number, r0: number, r1: number, start: number, turn: number, side: Side): Pt[] {
  const out: Pt[] = []
  const count = 16
  for (let i = 0; i <= count; i++) {
    const u = i / count
    const deg = ((start + turn * u) * Math.PI) / 180
    const r = r0 + (r1 - r0) * u
    out.push([cx + side * Math.cos(deg) * r, cy + Math.sin(deg) * r])
  }
  return out
}

/**
 * A symmetric closed path from the side +1 half, given as cubic points [start, c1, c2, end, ...]
 * in (distance from the centre line, y), from the centre line round to it again: the half, then
 * its mirror image walked back. With no outline down the middle, a pale mustache doesn't split
 * into two big teeth.
 */
function mirrored(half: readonly Pt[]): string {
  const right = half.map(([dx, y]): Pt => [50 + dx, y])
  const left = [...half].reverse().map(([dx, y]): Pt => [50 - dx, y])
  const all = [...right, ...left.slice(1)]
  const [x0, y0] = pt(all, 0)
  return `${d`M${x0} ${y0}`}${cubicsOn(all.slice(1))} Z`
}

/**
 * Curly: a mustache in two lobes, thickest a little out from the parting under the nose and
 * tapering to thin ends that sweep up and out into open curls on the cheeks. The bottom edge
 * stays off the mouth line, so the mouth shows beneath: a flat slab down to it read as a bar of
 * teeth, or with its round curls as a dog bone held in the mouth. The lobes are 5 deep where the
 * mouth line leaves room, and each curl is an open hook off the wing's end (`curlyCoil`), a ribbon
 * 2.2 either side of its spine tapering to a point, all outlined at W.detail, so colour runs most
 * of the way round: a ribbon 1.5 to 0.5 wide was all outline past its root, and the curls dark dots
 * at 48 px. On pale hair a dark strand runs along each lobe, so it reads as hair; on dark hair the
 * strand took the last of the colour.
 */
function curly(ctx: Ctx): string {
  const { a } = ctx
  const t = facialTones(ctx)
  const w = a.MW
  // As the handlebar: the lobes' top, the parting's, and the bottom, 5 deep unless that would
  // reach the mouth line, and 4.4 at least.
  const y = bowTop(ctx)
  const mid = Math.min(y + 1.4, belowNose(ctx, 0))
  const low = Math.max(y + 4.4, Math.min(y + 5, a.M - 1))
  const wing = mirrored([
    [0, mid],
    [1.5, y + 0.2],
    [4, y - 0.4],
    [7, y - 0.2],
    [w - 3, y],
    [w, y],
    [w + 2.2, y - 1.4],
    [w, y + 2.2],
    [w - 4, low],
    [6, low],
    [3, low],
    [1.5, low - 1],
    [0, low - 1.4],
  ])
  // Each curl starts under the wing's end, which covers its root (`curlyCoil`). Where it can't fit,
  // resolve has made the mustache a handlebar (`curlyFits`).
  const curls = both(side => {
    const coil = curlyCoil(ctx, side)
    return coil ? path(ribbon(coil.spine, coil.half), { fill: t.base, sw: W.detail }) : ''
  })
  const pale = toHsl(t.base)[2] > 50
  const strands = pale
    ? both(side => {
        const x = (dist: number) => X(side, dist)
        return strand(d`M${x(2.6)} ${(mid + low) / 2} Q${x(w * 0.5)} ${(y + low) / 2 + 0.2} ${x(w + 0.4)} ${y + 0.8}`, t)
      })
    : ''
  return curls + path(wing, { fill: t.base, sw: W.detail }) + strands
}

/** The braids mustache's plait half-width at its end. */
const BRAIDS_END = 2.5

/**
 * Braids: a bushy upper-lip mustache whose ends hang as two plaits from behind the tusks, splayed
 * out across them (`SPLAY`), each with a V at every plait and ending in a tassel of its own colour.
 * On pale hair the plaits are a deeper shade and only the tassel keeps the colour: white plaits
 * beside the cream tusks read as four fangs, and grey ones as metal clamps at the mouth's corners.
 * The lip piece runs out past the tusks to MW + 2, hugging the nose and 6 deep past it, outlined at
 * W.detail so its colour shows round the tusks drawn over it; its tufted bottom edge stops just
 * above the mouth line, and a dark strand runs along each half, so a pale one can't read as a row
 * of teeth. The plaits are fat enough (3.5 to 2.5 half-wide) for each lobe to show at 48 px, their
 * Vs only a shade darker, and each ends (J − 4 at the lowest) where its tassel still keeps 2 of
 * skin inside the jaw's outline, splayed out by 3 at least: on a jaw that narrows they're shorter.
 * Thin ones read as jowl creases or chains; short fat ones ending in dark bands, under a thin dark
 * lip bar, as fingers prising the mouth open; outline-dark Vs ending in metal beads on the jaw's
 * outline as neck bolts.
 */
function mustacheBraids(ctx: Ctx): string {
  const { a, look } = ctx
  const t = facialTones(ctx)
  const w = a.MW
  // The tufts' base line, their points just over the mouth line. The top hugs the nose out to its
  // half-width and outline (`belowNose`, less the 0.3 the thinner outline frees), then rises.
  const low = a.M - 2
  const nose = NOSE_FOOT[ctx.look.nose][2] + 1.5
  const past = Math.max(low - 6, a.N + 1.5)
  const topAt = (dx: number) => (dx < nose ? Math.min(low - 2, Math.max(past, belowNose(ctx, dx) - 0.3)) : past)
  const reach = w + 0.6
  const steps = Math.ceil(reach)
  const top = Array.from({ length: steps + 1 }, (_, i): Pt => [(reach * i) / steps, topAt((reach * i) / steps)])
  const outer = (side: Side): Pt => [X(side, w + 2), low]
  const inner: Pt = [50, low + 0.4]
  const lip = [
    d`M50 ${topAt(0)}`,
    smoothOn(top.map(([dx, y]): Pt => [X(1, dx), y])),
    d` Q${X(1, w + 2.6)} ${past + 0.4} ${outer(1)[0]} ${outer(1)[1]}`,
    tufts(outer(1), inner, 3, 1.4, DOWN, true),
    tufts(inner, outer(-1), 3, 1.4),
    d` Q${X(-1, w + 2.6)} ${past + 0.4} ${X(-1, reach)} ${past}`,
    smoothOn(top.map(([dx, y]): Pt => [X(-1, dx), y]).reverse()),
    ' Z',
  ].join(' ')
  // Where each plait ends, and how far out: the lowest end (from J − 4 up) whose tassel, splayed
  // 1.45 times the plait's end half-width and reaching its length below, keeps 2 of skin inside the
  // jaw's outline; out at MW + 4.6, or as far as the jaw leaves room, but (below the tusks' bases
  // by then) not in under MW + 0.5.
  const room = (y: number) => headHalfWidth(look, a, y) - W.silhouette / 2 - 2
  const hw = BRAIDS_END
  const len = hw * TASSEL * 1.08
  // From under the lip piece's end (which covers its root), down and out at the drooper's splay;
  // the tassel's outer and inner corners (along the plait by `len`, across it by its flare) stay
  // inside the room.
  const root: Pt = [w + 0.6, low - 1.5]
  const k = Math.hypot(SPLAY, 1)
  const [ux, uy] = [SPLAY / k, 1 / k]
  const flare = hw * 1.45
  const maxOut = (end: number) =>
    Math.min(
      room(end + uy * len - ux * flare) - ux * len - uy * flare,
      room(end + uy * len + ux * flare) - ux * len + uy * flare,
    ) - W.feature / 2
  const outAt = (end: number) => Math.min(root[0] + SPLAY * (end - root[1]), maxOut(end))
  let end = a.J - 4
  while (end > a.M + 3 && outAt(end) < root[0] + 3) end -= 0.5
  const out = outAt(end)
  // On pale hair the plaits are a deeper shade, clear of the tusks' cream, all but the tassel.
  const pale = toHsl(t.base)[2] > 50
  const rope = pale ? tones(shade(t.base, -22)) : t
  const plaits = both(side => {
    const x = (dist: number) => X(side, dist)
    const at = (u: number, bow: number): Pt => [x(root[0] + (out - root[0]) * u + bow), root[1] + (end - root[1]) * u]
    const spine = sample(at(0, 0), at(0.33, 0.6), at(0.66, 0.4), at(1, 0), 6)
    return braid(spine, 3.5, hw, rope, t.dark, { vee: shade(rope.base, -18), knot: 'none', tassel: t.base })
  })
  // A dark strand along each half, as the curly's (a streak too would leave no colour between).
  const lines = both(side => {
    const x = (dist: number) => X(side, dist)
    return strand(d`M${x(2.4)} ${low - 1.2} Q${x(w * 0.55)} ${low - 1} ${x(w + 0.6)} ${(past + low) / 2}`, t, true)
  })
  return plaits + path(lip, { fill: t.base, sw: W.detail }) + lines + strand(d`M50 ${topAt(0) + 0.6} L50 ${topAt(0) + 2.2}`, t, true)
}

const MUSTACHE_DRAW: Record<MustacheName, Draw> = {
  none: () => '',
  handlebar,
  walrus,
  imperial,
  pencil,
  chevron,
  horseshoe,
  drooper,
  curly,
  braids: mustacheBraids,
}

/** Layer 16: the mustache, over the mouth, under the tusks. */
export function mustache(ctx: Ctx): string {
  return MUSTACHE_DRAW[ctx.look.mustache](ctx)
}
