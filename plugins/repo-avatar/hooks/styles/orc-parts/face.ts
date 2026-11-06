// The face: expressions (as eye, brow and mouth presets), eyes, brow ridges, noses, mouths, and
// tusks with their bands and caps.
//
// Everything is placed by the head's anchors (heads.ts): eyes at 50 ± ED on E, brows on B, the
// nose on N, the mouth on M with half-width MW, tusks at 50 ± TD rising from lowerLip(). Shapes are
// written for side +1 in "local" x (distance from the centre line) and mapped onto each side, so
// one drawing serves both.

import { HAT_INFO } from './hats'
import { O, W, X, circle, d, ellipse, flat, mix, n, path } from './svg'
import type { Row } from './svg'
import type { Anchors, BrowPose, Ctx, EyeShape, ExpressionName, Look, MouthName, NoseName, Side, TuskName } from './types'

/**
 * Grunts lean fierce, peons dopey or worried. At 48 px scowl, snarl and grumpy share one V-browed
 * frown, so together they stay under a third of grunts, and the fierce moods that read apart (roar's
 * open mouth, manic's wide eyes) and the cocked brows (smug, wink, skeptic) take up the rest.
 */
export const EXPRESSION_ROWS: readonly Row<ExpressionName>[] = [
  ['scowl', 4, 16],
  ['snarl', 3, 14],
  ['roar', 2, 20],
  ['grumpy', 12, 12],
  ['smug', 10, 16],
  ['skeptic', 8, 10],
  ['manic', 2, 14],
  ['cheerful', 16, 10],
  ['dopey', 26, 2],
  ['worried', 18, 4],
  ['startled', 8, 3],
  ['sleepy', 8, 4],
  ['wink', 6, 10],
  ['blep', 6, 3],
]

export interface Expression {
  /** Both eyes, or the side +1 eye when `eyeAlt` is set. */
  eye: EyeShape
  /** The side −1 eye, when it differs (the wink, the dopey's odd pair). */
  eyeAlt?: EyeShape
  brow: BrowPose
  /** The side −1 brow, when it differs (smug, skeptic, dopey). */
  browAlt?: BrowPose
  mouth: MouthName
  /** Pupils pushed outward by this much: the dopey's wall-eyed stare. */
  gaze?: number
}

/**
 * At 48 px a face is mostly its eye shapes and brow angles, so neighbouring moods differ in at least
 * one of them, not just in the mouth: grumpy furrows its half lids, sleepy shuts its eyes over a
 * yawn, smug and skeptic cock one brow, cheerful lifts both brows clear of its closed smiling eyes.
 * The 'sleepy' eye is the heavy half lid (grumpy, smug); the sleepy mood shuts its eyes outright.
 */
export const EXPRESSION_PRESETS: Record<ExpressionName, Expression> = {
  scowl: { eye: 'glare', brow: { inner: 3, outer: -1 }, mouth: 'grim' },
  snarl: { eye: 'slit', brow: { inner: 3, outer: -1 }, mouth: 'snarl' },
  roar: { eye: 'glare', brow: { inner: 4, outer: -2 }, mouth: 'roar' },
  grumpy: { eye: 'sleepy', brow: { inner: 4, outer: 0 }, mouth: 'frown' },
  smug: { eye: 'sleepy', brow: { inner: 1, outer: 1 }, browAlt: { inner: -3, outer: -2 }, mouth: 'smirk' },
  skeptic: { eye: 'round', brow: { inner: 2, outer: 1 }, browAlt: { inner: -3, outer: -2 }, mouth: 'wavy' },
  manic: { eye: 'wide', brow: { inner: 1, outer: -3 }, mouth: 'grin' },
  cheerful: { eye: 'happy', brow: { inner: -4, outer: -3 }, mouth: 'grin' },
  dopey: { eye: 'round', eyeAlt: 'wide', brow: { inner: -3, outer: 0 }, browAlt: { inner: 0, outer: 1 }, mouth: 'gape', gaze: 0.8 },
  worried: { eye: 'wide', brow: { inner: -3, outer: 1 }, mouth: 'wavy' },
  startled: { eye: 'wide', brow: { inner: -4, outer: -3 }, mouth: 'ooh' },
  sleepy: { eye: 'closed', brow: { inner: -1, outer: 1 }, mouth: 'ooh' },
  wink: { eye: 'round', eyeAlt: 'closed', brow: { inner: -2, outer: -1 }, browAlt: { inner: 1, outer: 1 }, mouth: 'smirk' },
  blep: { eye: 'happy', brow: { inner: -3, outer: -2 }, mouth: 'tongue' },
}

export const NOSE_ROWS: readonly Row<NoseName>[] = [
  ['snout', 30, 20],
  ['flat', 15, 30],
  ['pug', 25, 15],
  ['button', 20, 5],
  ['hooked', 6, 12],
  ['broken', 4, 18],
]

export const TUSK_ROWS: readonly Row<TuskName>[] = [
  ['pair', 34, 30],
  ['stubs', 26, 4],
  ['big', 4, 26],
  ['broken', 6, 14],
  ['single', 16, 2],
  ['boar', 6, 12],
  ['double', 4, 6],
]

/** Mouths that are open wide: no mouth prop fits, and a walrus mustache can't sit over a roar. */
export const OPEN_MOUTHS: readonly MouthName[] = ['roar', 'gape', 'tongue', 'ooh']

/** How far below the mouth line M the lower lip sits at the tusks (x = 50 ± TD), per mouth. */
const LIP_DROP: Record<MouthName, number> = {
  grim: 1,
  frown: 1.5,
  smirk: 1,
  wavy: 1,
  snarl: 2.5,
  roar: 7,
  grin: 3.5,
  gape: 4.5,
  tongue: 1,
  ooh: 1,
}

/** The y of the lower lip, where tusk bases sit, for each mouth. */
export function lowerLip({ a, look }: Ctx): number {
  return a.M + LIP_DROP[look.mouth]
}

// Path helpers ----------------------------------------------------------------------------------

type Pt = readonly [number, number]

/** Maps local points (x = distance from the centre line) onto a side. */
function onSide(side: Side, pts: readonly Pt[]): Pt[] {
  return pts.map(([x, y]) => [50 + side * x, y] as const)
}

/** Catmull-Rom handles for the segment p1 → p2; a corner gets no handle. */
function segment(p0: Pt, p1: Pt, p2: Pt, p3: Pt, sharp1: boolean, sharp2: boolean): string {
  const c1 = sharp1 ? p1 : [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
  const c2 = sharp2 ? p2 : [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
  return ` C${n(c1[0] ?? 0)} ${n(c1[1] ?? 0)} ${n(c2[0] ?? 0)} ${n(c2[1] ?? 0)} ${n(p2[0])} ${n(p2[1])}`
}

/** A closed path through the points: smooth, except at the `corners` indices. */
function loop(pts: readonly Pt[], corners: readonly number[] = []): string {
  const count = pts.length
  const pick = (i: number): Pt => pts[((i % count) + count) % count] ?? [50, 50]
  const sharp = (i: number) => corners.includes(((i % count) + count) % count)
  const [x0, y0] = pick(0)
  let out = `M${n(x0)} ${n(y0)}`
  for (let i = 0; i < count; i++) {
    out += segment(pick(i - 1), pick(i), pick(i + 1), pick(i + 2), sharp(i), sharp(i + 1))
  }
  return `${out} Z`
}

/** An open path through the points: smooth, except at the `corners` indices. */
function curve(pts: readonly Pt[], corners: readonly number[] = []): string {
  const last = pts.length - 1
  const pick = (i: number): Pt => pts[Math.max(0, Math.min(last, i))] ?? [50, 50]
  const [x0, y0] = pick(0)
  let out = `M${n(x0)} ${n(y0)}`
  for (let i = 0; i < last; i++) {
    out += segment(pick(i - 1), pick(i), pick(i + 1), pick(i + 2), corners.includes(i), corners.includes(i + 1))
  }
  return out
}

/** A thick open stroke in the outline colour. */
function stroke(data: string, sw: number = W.feature): string {
  return path(data, { fill: 'none', sw })
}

/** A soft shadow: the outline colour, faint, so paint and scars beneath still show through. */
function shadow(data: string, fo = 0.22): string {
  return flat(data, O, fo)
}

// Eyes ------------------------------------------------------------------------------------------
// Layer 11. Small orc eyes, sunk in a shadowed socket under the brow, filled with the eye colour
// (bone, amber, red, ...) and a dark pupil. Outlined a little thinner than features so the colour
// still shows at 48 px.

const EYE_SW = 2.2
/**
 * The narrow eyes (glare, slit, half lid) show only a few units of colour between the brow and
 * their outline: with a full-size pupil every eye colour became the same dark smudge at 48 px.
 * They take the thinnest stroke and a small pupil nudged towards the nose (a negative `du`), so
 * the colour shows beside it. The slit, the narrowest, takes a smaller one still.
 */
const NARROW_SW = W.detail
const NARROW_PUPIL = 1
const NARROW_DU = -0.8
const SLIT_PUPIL = 0.8
const SLIT_DU = -1.2
const WHITE = '#ffffff'

function eye(ctx: Ctx, side: Side, kind: EyeShape | null): string {
  if (kind === null) return ''
  const { a, p, look } = ctx
  const x = X(side, a.ED)
  const y = a.E
  // Local points around the eye: u outward (away from the nose), v down.
  const at = (u: number, v: number): Pt => [x + side * u, y + v]
  // Where the pupil sits across: centred, unless the expression stares off (the dopey wall-eye).
  const px = x + side * (EXPRESSION_PRESETS[look.expression].gaze ?? 0)
  const pupil = (r: number, du = 0, dv = 0.4) => circle(px + side * du, y + dv, r, { fill: O, stroke: 'none' })
  // The glint sits on the drawing's right of every pupil (the viewer's left after the flip).
  const glint = (dx: number, dy: number) => circle(px + dx, y + dy, 0.8, { fill: WHITE, stroke: 'none' })
  // An eye-band frames the eyes itself. A socket's shadow on it shows as a grey oval round each eye
  // on bone paint (the band shut eyes always get): a panda's patches, not war paint.
  const socket = (rx: number, ry: number) =>
    look.paint === 'eye-band' ? '' : ellipse(x + side * 0.4, y - 1.2, rx, ry, { fill: O, stroke: 'none', fo: 0.26 })

  switch (kind) {
    case 'round':
      return socket(6.4, 5.2) + ellipse(x, y, 4, 3.8, { fill: p.eye, sw: EYE_SW }) + pupil(1.8) + glint(0.9, -0.6)
    case 'wide':
      // Big whites, a pinprick pupil: alarm.
      return socket(7, 5.8) + ellipse(x, y - 0.2, 4.7, 4.7, { fill: p.eye, sw: EYE_SW }) + pupil(1.35, 0, 0) + glint(1.2, -1.4)
    case 'slit': {
      // Narrowed to a lens, sitting a little low: the brow ridge overhangs its top.
      const lens = loop([at(-4.6, 0.9), at(0, -2.3), at(4.6, -0.1), at(0, 3.3)], [0, 2])
      return socket(6.2, 4.6) + path(lens, { fill: p.eye, sw: NARROW_SW }) + pupil(SLIT_PUPIL, SLIT_DU, 0.6)
    }
    case 'glare': {
      // The top cut off at a slant, low by the nose: an angry squint (the brow covers the rest).
      // Its outer corner stands tall, and the pupil keeps to the low inner end, so the colour
      // shows beside it at 48 px.
      const lid = loop([at(-4.4, 0.6), at(3.2, -3.8), at(4.4, 0.4), at(2, 3.6), at(-2, 3.4)], [0, 1])
      return socket(6.4, 5) + path(lid, { fill: p.eye, sw: NARROW_SW }) + pupil(NARROW_PUPIL, NARROW_DU, 1.2)
    }
    case 'sleepy': {
      // A heavy half lid in the dark skin, the pupil peeping out below: unimpressed (grumpy, smug).
      const lid = loop([at(-4.9, -0.8), at(-3, -3.6), at(3, -3.6), at(4.9, -0.8), at(0, -0.5)], [0, 3])
      return (
        socket(6.4, 5) +
        ellipse(x, y + 0.6, 4.7, 4.1, { fill: p.eye, sw: NARROW_SW }) +
        pupil(NARROW_PUPIL, NARROW_DU, 2.2) +
        path(lid, { fill: p.skinDark, sw: NARROW_SW })
      )
    }
    case 'happy': {
      // Shut in a smile: a low, flat arc with no socket, so skin parts it from the brow ridge
      // (an arc tucked under the ridge crosses its underside into knocked-out X eyes). Beneath,
      // the cheek pushed up, as a soft crease rather than a line: a second dark arc stacks into
      // a blot at 48 px.
      const [c0, c1, c2, c3] = [at(-2.8, 6.6), at(0.3, 4.4), at(3.4, 6.6), at(0.3, 5.8)]
      const cheek = d`M${c0[0]} ${c0[1]} Q${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} Q${c3[0]} ${c3[1]} ${c0[0]} ${c0[1]} Z`
      return flat(cheek, p.skinDark) + stroke(curve([at(-4.4, 3), at(0, -0.6), at(4.4, 3)]), W.feature)
    }
    case 'closed':
      // Shut: the lid in a downward curve, with a crease at the outer corner (the wink, or both
      // eyes for the sleepy mood).
      return (
        socket(6, 4.6) +
        stroke(curve([at(-4.2, 0.6), at(0, 2.8), at(4.2, 0.6)]), 3) +
        stroke(curve([at(4.2, 0.6), at(5.6, -0.8)]), 2.4)
      )
    case 'glowing':
      // No pupil: a halo, the eye, and a hot core.
      return (
        ellipse(x, y, 6.2, 5.6, { fill: p.eye, stroke: 'none', fo: 0.35 }) +
        ellipse(x, y, 4, 3.8, { fill: p.eye, sw: EYE_SW }) +
        ellipse(x, y, 2.1, 1.9, { fill: mix(p.eye, WHITE, 0.75), stroke: 'none' })
      )
  }
}

export function eyes(ctx: Ctx): string {
  return eye(ctx, 1, ctx.look.eye.p) + eye(ctx, -1, ctx.look.eye.m)
}

// Brows -----------------------------------------------------------------------------------------
// Layer 12: the heavy brow ridge, one ledge per side from the nose (`inner`) to past the eye
// (`outer`). It overlaps the top of the eye; dropping its inner end makes the glare.

/** The ridge's centreline at u (0 inner .. 1 outer), in local x. */
function ridge(a: Anchors, pose: BrowPose): (u: number) => Pt {
  const xi = 2.6
  const xo = a.ED + 7.6
  const yi = a.B + pose.inner
  const yo = a.B + pose.outer
  // A gentle arch: the middle rides 1 unit above the straight line.
  return u => [xi + (xo - xi) * u, yi + (yo - yi) * u - 4 * u * (1 - u)]
}

function brow(ctx: Ctx, side: Side, pose: BrowPose): string {
  const { a, p, look } = ctx
  const at = ridge(a, pose)
  // Thickness above and below the centreline: fat over the eye, tapering to the ends.
  const above = (u: number) => 2.2 + 1.2 * Math.sin(Math.PI * u)
  const below = (u: number) => 2.2 + 0.6 * Math.sin(Math.PI * u)
  const us = [0, 0.33, 0.66, 1]
  const top = us.map(u => [at(u)[0], at(u)[1] - above(u)] as const)
  const bottom = us.map(u => [at(u)[0], at(u)[1] + below(u)] as const).reverse()
  const [xi, yi] = at(0)
  const [xo, yo] = at(1)
  const outline = loop(onSide(side, [[xi - 1, yi], ...top, [xo + 1.2, yo + 0.2], ...bottom]))
  // The ledge's underside in shadow, and a shine along its top: it reads as a ridge, not a line.
  const inner = [0.08, 0.35, 0.65, 0.92]
  const under = [
    ...inner.map(u => [at(u)[0], at(u)[1] + below(u) * 0.15] as const),
    ...[...inner].reverse().map(u => [at(u)[0], at(u)[1] + below(u)] as const),
  ]
  const shine = [
    ...[0.15, 0.45, 0.75].map(u => [at(u)[0], at(u)[1] - above(u) * 0.62] as const),
    ...[0.75, 0.45, 0.15].map(u => [at(u)[0], at(u)[1] - above(u) * 0.25] as const),
  ]
  let out =
    path(outline, { fill: p.skin, stroke: 'none' }) +
    flat(loop(onSide(side, under)), p.skinDark) +
    flat(loop(onSide(side, shine)), p.skinLight) +
    path(outline, { fill: 'none', sw: W.brow })
  if (look.bushy) out += bushyBrow(ctx, side, at, above)
  return out
}

/** A tufty hair brow on the ridge: a band with spiky tufts flicking outward. */
function bushyBrow(ctx: Ctx, side: Side, at: (u: number) => Pt, above: (u: number) => number): string {
  const pts: Pt[] = []
  const tufts = 4
  // The lower edge runs along the ridge's centreline, outer to inner.
  for (let i = tufts; i >= 0; i--) {
    const [x, y] = at(i / tufts)
    pts.push([x, y + 0.6])
  }
  // The upper edge: a valley on the ridge top, then a spike up and outward, per tuft.
  for (let i = 0; i < tufts; i++) {
    const u0 = i / tufts
    const u1 = (i + 1) / tufts
    const [vx, vy] = at(u0)
    const [sx, sy] = at(u1)
    pts.push([vx + 0.4, vy - above(u0) + 0.6])
    pts.push([sx + 0.6, sy - above(u1) - 2.2])
  }
  const corners = pts.map((_, i) => i)
  return path(loop(onSide(side, pts), corners), { fill: ctx.p.facial, sw: W.detail + 0.2 })
}

/**
 * Under a brim that covers the forehead (it comes down to B − 3), a raised brow would vanish:
 * raises are halved, and stop 2 above B. Hats perched on the crown leave the brows free.
 */
function underBrim(look: Look, pose: BrowPose): BrowPose {
  if (!HAT_INFO[look.hat].coversForehead) return pose
  const squash = (v: number) => (v < 0 ? Math.max(v * 0.5, -2) : v)
  return { inner: squash(pose.inner), outer: squash(pose.outer) }
}

export function brows(ctx: Ctx): string {
  const { look } = ctx
  return brow(ctx, 1, underBrim(look, look.brow.p)) + brow(ctx, -1, underBrim(look, look.brow.m))
}

// Noses -----------------------------------------------------------------------------------------
// Layer 13. Each nose is drawn about x = 50 with its bridge starting under the brow (E + 2); its
// widest point and bottom are listed so the tusks can keep clear of it.

interface NoseBox {
  /** Half-width at its widest. */
  hw: number
  /** How far below N it reaches. */
  bottom: number
}

const NOSE_BOX: Record<NoseName, NoseBox> = {
  snout: { hw: 6.4, bottom: 4 },
  flat: { hw: 9.2, bottom: 3.4 },
  pug: { hw: 5, bottom: 2.4 },
  button: { hw: 4.6, bottom: 2.8 },
  hooked: { hw: 6.4, bottom: 5.6 },
  broken: { hw: 7.2, bottom: 3.6 },
}

/** Narrow jaws (where the tusks crowd in) squeeze a wide nose. */
function noseSqueeze(ctx: Ctx): number {
  const box = NOSE_BOX[ctx.look.nose]
  return Math.min(1, Math.max(0.78, (ctx.a.TD - 1) / box.hw))
}

function noseBox(ctx: Ctx): NoseBox {
  const box = NOSE_BOX[ctx.look.nose]
  return { hw: box.hw * noseSqueeze(ctx), bottom: box.bottom }
}

/** A sticking plaster's tan. */
const PLASTER = '#e4c08e'

const NOSES: Record<NoseName, (ctx: Ctx, x: (u: number) => number) => string> = {
  snout: ({ a, p }, x) => {
    // A pig's snout: a short bridge onto a flat front plate with two big nostrils.
    const top = a.E + 2
    const plate = loop([[x(0), a.N - 3.9], [x(6.4), a.N - 0.2], [x(0), a.N + 4], [x(-6.4), a.N - 0.2]])
    return (
      bridge(x, top, a.N - 2, 2.4, 3.6, p.skin) +
      shadow(loop([[x(-5), a.N + 2.4], [x(0), a.N + 5.4], [x(5), a.N + 2.4], [x(0), a.N + 3.6]])) +
      path(plate, { fill: p.skin }) +
      ellipse(x(-2.5), a.N + 0.4, 1.3, 1.9, { fill: O, stroke: 'none' }) +
      ellipse(x(2.5), a.N + 0.4, 1.3, 1.9, { fill: O, stroke: 'none' })
    )
  },
  flat: ({ a, p }, x) => {
    // Wide and squashed: flared wings, nostrils showing.
    const top = a.E + 3
    const body = loop([
      [x(0), a.N - 4.2], [x(4.4), a.N - 2.8], [x(8.4), a.N - 0.2], [x(9.2), a.N + 1.6], [x(7.2), a.N + 3.4],
      [x(3.8), a.N + 2.4], [x(0), a.N + 3.2], [x(-3.8), a.N + 2.4], [x(-7.2), a.N + 3.4], [x(-9.2), a.N + 1.6],
      [x(-8.4), a.N - 0.2], [x(-4.4), a.N - 2.8],
    ])
    const wing = (s: Side) => stroke(curve([[x(s * 6.2), a.N - 1.4], [x(s * 6.6), a.N + 1], [x(s * 7.4), a.N + 3.2]]), W.detail)
    return (
      bridge(x, top, a.N - 3, 2.6, 4.2, p.skin) +
      shadow(loop([[x(-7), a.N + 3], [x(0), a.N + 5.6], [x(7), a.N + 3], [x(0), a.N + 3.8]])) +
      path(body, { fill: p.skin }) +
      wing(1) +
      wing(-1) +
      ellipse(x(-3.6), a.N + 1.2, 1.7, 1.1, { fill: O, stroke: 'none' }) +
      ellipse(x(3.6), a.N + 1.2, 1.7, 1.1, { fill: O, stroke: 'none' })
    )
  },
  pug: ({ a, p }, x) => {
    // Small, round and upturned: the nostrils face front.
    const body = loop([[x(0), a.N - 5], [x(4), a.N - 2.6], [x(5), a.N + 0.6], [x(2.8), a.N + 2.4], [x(-2.8), a.N + 2.4], [x(-5), a.N + 0.6], [x(-4), a.N - 2.6]])
    return (
      shadow(loop([[x(-4), a.N + 2], [x(0), a.N + 4.6], [x(4), a.N + 2], [x(0), a.N + 3]])) +
      path(body, { fill: p.skin }) +
      circle(x(1.2), a.N - 2.6, 1, { fill: p.skinLight, stroke: 'none' }) +
      ellipse(x(-1.9), a.N + 0.5, 1.1, 1.5, { fill: O, stroke: 'none' }) +
      ellipse(x(1.9), a.N + 0.5, 1.1, 1.5, { fill: O, stroke: 'none' })
    )
  },
  button: ({ a, p }, x) => {
    // A round bulb in the skin (x(4.6) − 50 is its half-width after any squeeze). A lighter ball
    // with a white glint read as a pea stuck on the nose, and a bare outlined circle as a hole: the
    // bulb gets a lit crescent on its upper edge, big nostrils and a shadow under it instead.
    const rx = x(4.6) - 50
    const ry = 3.6
    const cy = a.N - 0.8
    // A point `k` in from the bulb's edge at angle `deg` (−90 is the top; the light is on side +1).
    const rim = (deg: number, k: number): Pt => {
      const t = (deg * Math.PI) / 180
      return [50 + (rx - k) * Math.cos(t), cy + (ry - k) * Math.sin(t)]
    }
    const lit = loop([rim(-140, 1.5), rim(-82, 1.4), rim(-25, 1.5), rim(-58, 2.6), rim(-108, 2.6)], [0, 2])
    return (
      shadow(loop([[x(-4.2), a.N + 1.6], [x(0), a.N + 5.2], [x(4.2), a.N + 1.6], [x(0), a.N + 3.2]])) +
      ellipse(50, cy, rx, ry, { fill: p.skin }) +
      flat(lit, p.skinLight) +
      ellipse(x(-1.8), a.N + 1, 1.3, 1, { fill: O, stroke: 'none' }) +
      ellipse(x(1.8), a.N + 1, 1.3, 1, { fill: O, stroke: 'none' })
    )
  },
  hooked: ({ a, p }, x) => {
    // A beak: a long bridge to a tip that hooks down past the nostrils.
    const top = a.E + 2
    const pts: Pt[] = [
      [x(-2.2), top], [x(-2.8), a.N - 5], [x(-4.4), a.N - 2.6], [x(-6.2), a.N + 0.4], [x(-4.6), a.N + 2.4],
      [x(-2.4), a.N + 1.8], [x(-1.6), a.N + 4.4], [x(0), a.N + 5.6], [x(1.6), a.N + 4.4], [x(2.4), a.N + 1.8],
      [x(4.6), a.N + 2.4], [x(6.2), a.N + 0.4], [x(4.4), a.N - 2.6], [x(2.8), a.N - 5], [x(2.2), top],
    ]
    const open = curve(pts, [0, 5, 9, 14])
    return (
      shadow(loop([[x(-4.6), a.N + 2.6], [x(0), a.N + 7], [x(4.6), a.N + 2.6], [x(0), a.N + 4.6]])) +
      flat(`${open} Z`, p.skin) +
      flat(loop([[x(0.6), top + 1.5], [x(1.5), a.N - 2], [x(0.8), a.N + 2], [x(-0.2), a.N - 2]]), p.skinLight) +
      stroke(open) +
      ellipse(x(-3.6), a.N + 0.8, 1.1, 1.3, { fill: O, stroke: 'none' }) +
      ellipse(x(3.6), a.N + 0.8, 1.1, 1.3, { fill: O, stroke: 'none' })
    )
  },
  broken: ({ a, p }, x) => {
    // Knocked sideways: the bridge kinks and the bulb lands off-centre, with a plaster on the break.
    const top = a.E + 2
    const lean = 2
    const kink = (top + a.N - 3) / 2
    const pts: Pt[] = [
      [x(-2.2), top], [x(-2.6), kink], [x(lean - 3.6), a.N - 2.6], [x(lean - 5.2), a.N], [x(lean - 3), a.N + 3.4],
      [x(lean + 3), a.N + 3.4], [x(lean + 5.2), a.N], [x(lean + 3.6), a.N - 2.6], [x(1.4), kink], [x(2.2), top],
    ]
    const open = curve(pts, [0, 1, 8, 9])
    // The plaster: a small tilted strip across the kink, with its pad.
    const cx = x(0.2)
    const cy = kink + 0.6
    const strip = loop([[cx - 4.6, cy - 2.8], [cx + 4.6, cy - 0.4], [cx + 3.8, cy + 2.8], [cx - 5.4, cy + 0.4]], [0, 1, 2, 3])
    return (
      shadow(loop([[x(lean - 4.6), a.N + 2.6], [x(lean), a.N + 6], [x(lean + 4.6), a.N + 2.6], [x(lean), a.N + 4]])) +
      flat(`${open} Z`, p.skin) +
      flat(loop([[x(lean - 1), a.N - 2], [x(lean + 2.4), a.N - 1.6], [x(lean + 1), a.N - 0.6]]), p.skinLight) +
      stroke(open) +
      ellipse(x(lean - 2.3), a.N + 1, 1.1, 1.4, { fill: O, stroke: 'none' }) +
      ellipse(x(lean + 2.3), a.N + 1, 1.1, 1.4, { fill: O, stroke: 'none' }) +
      path(strip, { fill: PLASTER, sw: W.detail }) +
      circle(cx - 1.4, cy - 0.4, 0.6, { fill: mix(PLASTER, O, 0.35), stroke: 'none' }) +
      circle(cx + 1.2, cy + 0.3, 0.6, { fill: mix(PLASTER, O, 0.35), stroke: 'none' })
    )
  },
}

/** A nose bridge from `top` down to `bottom`, widening from w0 to w1: skin fill, sides outlined. */
function bridge(x: (u: number) => number, top: number, bottom: number, w0: number, w1: number, fill: string): string {
  const side = (s: Side) => curve([[x(s * w0), top], [x(s * (w0 + 0.2)), (top + bottom) / 2], [x(s * w1), bottom]])
  return (
    flat(`M${n(x(-w0))} ${n(top)} L${n(x(w0))} ${n(top)} L${n(x(w1))} ${n(bottom + 1)} L${n(x(-w1))} ${n(bottom + 1)} Z`, fill) +
    stroke(side(-1)) +
    stroke(side(1))
  )
}

export function nose(ctx: Ctx): string {
  const k = noseSqueeze(ctx)
  return NOSES[ctx.look.nose](ctx, u => 50 + u * k)
}

// Mouths ----------------------------------------------------------------------------------------
// Layer 15. On the mouth line M, half-width MW. The lower jaw juts (the underbite), so closed mouths
// get a soft shadow under the line where the lower lip overhangs.

function lipShadow(a: Anchors, drop = 0): string {
  const l = 50 - a.MW + 3
  const r = 50 + a.MW - 3
  const y = a.M + 1.8 + drop
  return shadow(`M${n(l)} ${n(y)} Q50 ${n(y + 3.4)} ${n(r)} ${n(y)} Q50 ${n(y + 1.2)} ${n(l)} ${n(y)} Z`, 0.18)
}

/** An open mouth: the cavity, what's inside it (flat), then the outline again on top. */
function opening(outline: string, inside: string, fill: string): string {
  return path(outline, { fill, sw: W.feature }) + inside + stroke(outline)
}

/** A row of upper teeth hanging from the top edge, a flat band with a pointed lower edge. */
function upperTeeth(pts: readonly Pt[], depth: number, colour: string): string {
  // pts: the top edge, left to right. Below it, a zigzag of points.
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (first === undefined || last === undefined) return ''
  const teeth = 5
  const zig: Pt[] = []
  for (let i = 0; i <= teeth * 2; i++) {
    const t = i / (teeth * 2)
    const x = last[0] + (first[0] - last[0]) * t
    // Follow the top edge's height (pts are few; interpolate linearly between neighbours).
    const y = edgeY(pts, x) + (i % 2 === 1 ? depth : depth * 0.45)
    zig.push([x, y])
  }
  return flat(`${curve([...pts])} ${zig.map(([x, y]) => `L${n(x)} ${n(y)}`).join(' ')} Z`, colour)
}

/** The y of a polyline at x (pts sorted by x). */
function edgeY(pts: readonly Pt[], x: number): number {
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    if (p0 === undefined || p1 === undefined) continue
    if (x >= p0[0] && x <= p1[0]) return p0[1] + ((p1[1] - p0[1]) * (x - p0[0])) / (p1[0] - p0[0] || 1)
  }
  return (pts[0] ?? [0, 0])[1]
}

/**
 * Closed mouths run a little past MW, so their corners show beyond the tusks (whose outer edge is
 * about MW).
 */
const CORNER = 1.6

/**
 * Closed mouths are drawn at the brow's weight: between the tusks only a short stretch of the line
 * shows, and at 48 px a thinner one (and the shape it carries) melts into the skin.
 */
const LIP_SW = W.brow

/**
 * Each mouth's corner on a side, as [distance from the centre line, y]. Symmetric mouths ignore the
 * side; the smirk hitches its side −1 corner up. The drawings end their lines here, and
 * mouthCorner() hands the same point to parts held in the corner (body.ts's pipe and cigar).
 */
const CORNERS: Record<MouthName, (a: Anchors, side: Side) => Pt> = {
  grim: a => [a.MW + CORNER, a.M + 2],
  frown: a => [a.MW + CORNER + 0.6, a.M + 5],
  smirk: (a, side) => (side === 1 ? [a.MW + CORNER, a.M + 1.6] : [a.MW + CORNER + 0.8, a.M - 4.6]),
  wavy: a => [a.MW + 1, a.M + 0.8],
  snarl: a => [a.MW - 1, a.M + 0.6],
  roar: a => [a.MW - 0.5, a.M - 0.6],
  grin: a => [a.MW + 0.6, a.M - 4],
  gape: a => [a.MW - 2, a.M - 0.4],
  tongue: a => [a.MW + CORNER, a.M - 1.6],
  ooh: a => [3.6, a.M + 1.4],
}

/** The corner of this look's mouth on `side`, on the canvas. */
export function mouthCorner({ a, look }: Ctx, side: Side): [number, number] {
  const [x, y] = CORNERS[look.mouth](a, side)
  return [X(side, x), y]
}

/** A symmetric line from the side −1 corner to the side +1 corner: `half` runs corner to centre. */
function across(half: readonly Pt[]): Pt[] {
  const left = half.map(([x, y]): Pt => [50 - x, y])
  const right = half.slice(0, -1).reverse().map(([x, y]): Pt => [50 + x, y])
  return [...left, ...right]
}

const MOUTHS: Record<MouthName, (ctx: Ctx) => string> = {
  grim: ({ a }) => {
    // Flat, the corners just turned down.
    const [w, y] = CORNERS.grim(a, 1)
    return lipShadow(a) + stroke(curve(across([[w, y], [w - 3.6, a.M + 0.3], [0, a.M]])), LIP_SW)
  },
  frown: ({ a }) => {
    // An arch: high in the middle (between the tusks, where it shows) and the corners well down.
    const [w, y] = CORNERS.frown(a, 1)
    return lipShadow(a, 0.5) + stroke(curve(across([[w, y], [w - 4.4, a.M + 1.4], [0, a.M - 1.4]])), LIP_SW)
  },
  smirk: ({ a }) => {
    // Flat on side +1, sloping up across the middle into a hook on side −1, dimpled at the hook.
    const [rx, ry] = CORNERS.smirk(a, 1)
    const [lx, ly] = CORNERS.smirk(a, -1)
    const l = 50 - lx
    const r = 50 + rx
    return (
      lipShadow(a) +
      stroke(curve([[r, ry], [r - 5, a.M + 1.2], [50, a.M + 0.3], [l + 5.4, a.M - 1.4], [l, ly]]), LIP_SW) +
      stroke(curve([[l - 0.4, ly - 1.8], [l - 1.4, ly + 0.2], [l - 0.2, ly + 2.4]]), W.detail)
    )
  },
  wavy: ({ a }) => {
    // A worried wobble: two full waves, one of them between the tusks.
    const [w, y] = CORNERS.wavy(a, 1)
    const l = 50 - w
    const s = (2 * w) / 4
    const wave: Pt[] = [
      [l, y], [l + s * 0.5, a.M - 1.6], [l + s * 1.5, a.M + 2.2], [l + s * 2.5, a.M - 1.6], [l + s * 3.5, a.M + 2.2], [50 + w, y],
    ]
    return lipShadow(a) + stroke(curve(wave), LIP_SW)
  },
  snarl: ({ a, p }) => {
    // The upper lip hitched up over a row of pointed teeth.
    const [w, y] = CORNERS.snarl(a, 1)
    const l = 50 - w
    const r = 50 + w
    const top: Pt[] = [[l, y], [l + 3.5, a.M - 2.2], [50, a.M - 3.2], [r - 3.5, a.M - 2.2], [r, y]]
    const outline = loop([...top, [r - 4, a.M + 2.6], [50, a.M + 3], [l + 4, a.M + 2.6]], [0, 4])
    return opening(outline, upperTeeth(top, 2.8, p.teeth), p.mouth)
  },
  roar: ({ a, p }) => {
    // Jaw dropped wide: upper fangs, the tongue in the bottom.
    const [w, y] = CORNERS.roar(a, 1)
    const l = 50 - w
    const r = 50 + w
    const top: Pt[] = [[l, y], [l + 3.5, a.M - 3.6], [50, a.M - 4.4], [r - 3.5, a.M - 3.6], [r, y]]
    const outline = loop([...top, [r - 1.6, a.M + 5], [50, a.M + 9.4], [l + 1.6, a.M + 5]], [0, 4])
    const tongue = loop([[50 - a.MW * 0.5, a.M + 7.2], [50, a.M + 3.6], [50 + a.MW * 0.5, a.M + 7.2], [50, a.M + 9]])
    return opening(outline, flat(tongue, p.tongue) + upperTeeth(top, 3, p.teeth), p.mouth)
  },
  grin: ({ a, p }) => {
    // A wide open smile: a crescent with its corners swept up, the upper teeth in a band along
    // the top and the tongue below. (A full bar of teeth reads as a clenched grimace.)
    const [w, y] = CORNERS.grin(a, 1)
    const top = across([[w, y], [w * 0.55, a.M - 0.6], [0, a.M + 0.2]])
    const outline = loop([...top, [50 + w - 2.4, a.M + 2.2], [50, a.M + 6.8], [50 - w + 2.4, a.M + 2.2]], [0, top.length - 1])
    // The teeth hang from the top edge, deepest in the middle and tapering into the corners.
    const depth = [0.4, 2.4, 2.8, 2.4, 0.4]
    const hang = [...top].reverse().map(([x, yy], i) => `L${n(x)} ${n(yy + (depth[i] ?? 0))}`)
    const teeth = flat(`${curve(top)} ${hang.join(' ')} Z`, p.teeth)
    const tongue = loop([[50 - w * 0.42, a.M + 5.2], [50, a.M + 3.8], [50 + w * 0.42, a.M + 5.2], [50, a.M + 6.8]])
    return opening(outline, flat(tongue, p.tongue) + teeth, p.mouth)
  },
  gape: ({ a, p }) => {
    // Hanging open, two buck teeth, the tongue lolling out over the lip on side +1: the dopey peon.
    const [w, y] = CORNERS.gape(a, 1)
    const l = 50 - w
    const r = 50 + w
    const outline = loop([[l, y], [50, a.M - 1.2], [r, y], [r - 2, a.M + 5], [50, a.M + 7.6], [l + 2, a.M + 5]], [0, 2])
    const tooth = (x: number) =>
      path(`M${n(x)} ${n(a.M - 1)} L${n(x)} ${n(a.M + 1.8)} Q${n(x)} ${n(a.M + 2.6)} ${n(x + 0.8)} ${n(a.M + 2.6)} L${n(x + 2)} ${n(a.M + 2.6)} Q${n(x + 2.8)} ${n(a.M + 2.6)} ${n(x + 2.8)} ${n(a.M + 1.8)} L${n(x + 2.8)} ${n(a.M - 1)} Z`, {
        fill: p.teeth,
        sw: W.detail,
      })
    // Off-centre, but clear of the tusk on narrow jaws.
    const tx = 50 + Math.min(4, a.TD - 5)
    const tongue = `M${n(tx - 3)} ${n(a.M + 3.4)} L${n(tx - 3)} ${n(a.M + 7.6)} C${n(tx - 3)} ${n(a.M + 11.6)} ${n(tx + 3)} ${n(a.M + 11.6)} ${n(tx + 3)} ${n(a.M + 7.6)} L${n(tx + 3)} ${n(a.M + 3.4)} Z`
    return (
      opening(outline, '', p.mouth) +
      tooth(47) +
      tooth(50.2) +
      path(tongue, { fill: p.tongue, sw: W.detail }) +
      path(`M${n(tx)} ${n(a.M + 6.4)} L${n(tx)} ${n(a.M + 9)}`, { fill: 'none', stroke: mix(p.tongue, O, 0.45), sw: W.detail })
    )
  },
  tongue: ({ a, p }) => {
    // A blep: a closed smile with the tongue poking out the side, clear of the tusk.
    const [w, y] = CORNERS.tongue(a, 1)
    const tx = 50 + Math.min(3, a.TD - 7)
    const tongue = `M${n(tx - 3.2)} ${n(a.M + 0.4)} L${n(tx - 3.2)} ${n(a.M + 4)} C${n(tx - 3.2)} ${n(a.M + 8.2)} ${n(tx + 3.2)} ${n(a.M + 8.2)} ${n(tx + 3.2)} ${n(a.M + 4)} L${n(tx + 3.2)} ${n(a.M + 0.4)} Z`
    return (
      lipShadow(a) +
      path(tongue, { fill: p.tongue }) +
      path(`M${n(tx)} ${n(a.M + 1.6)} L${n(tx)} ${n(a.M + 4.4)}`, { fill: 'none', stroke: mix(p.tongue, O, 0.45), sw: W.detail }) +
      stroke(curve(across([[w, y], [w - 4, a.M + 0.6], [0, a.M + 1]])), LIP_SW)
    )
  },
  ooh: ({ a, p }) => {
    // A small round O, lips pursed (or a yawn, under shut eyes).
    const [w, y] = CORNERS.ooh(a, 1)
    return (
      lipShadow(a, 0.6) +
      ellipse(50, y, w, 4.4, { fill: p.mouth }) +
      ellipse(50, a.M + 3.6, 2, 1.2, { fill: p.tongue, stroke: 'none' })
    )
  },
}

export function mouth(ctx: Ctx): string {
  return MOUTHS[ctx.look.mouth](ctx)
}

// Tusks -----------------------------------------------------------------------------------------
// Layer 17. Lower tusks, rising from the lower lip over the upper lip. Each is a fang sampled along
// a curved centreline, so bands and caps can follow its shape. The tips stay clear of the eyes and
// any rims round them (tipFloor), and a tusk rising past the nose clears it sideways (fang).
//
// Geometry (others steer round it; tuskSpans() gives it per look): bases at x = 50 ± TD on
// y = lowerLip(), or up to 2.1 further out to clear a wide nose (the bean's jaw, and a flat nose
// over double tusks); base half-width 3.4 (stubs 3.2, big 4.4, single 3.8, boar 3.6); tips lean out
// by 1.8 (stubs 0.4, big 2.4, boar 5.5) and rise 10 + 1.6 × tuskLength (stubs 4.5 + 0.7 L, big
// 13 + 2 L, single one more than a pair, boar 9 + 1.4 L). 'double' adds a pair 4.8 outside the main
// one (half-width 2.6, rise 6 + L) and moves the main pair in to TD − 0.8. Caps reach 1.2 above the
// tip.

interface Fang {
  /** Base centre: distance from the centre line, and y. */
  x: number
  y: number
  /** Base to tip, upward. */
  rise: number
  /** How far out the tip leans. */
  lean: number
  /** The centreline's control point, as shares of lean and rise: (0, 1) holds vertical then hooks out. */
  bend: readonly [number, number]
  /** Half-width at the base, and at the tip (0 for a point). */
  w: number
  tip: number
  /** Snapped off at this share of the length, with a jagged top. */
  snap?: number
}

/** A fang's centreline point, outward normal and half-width at t (0 base .. 1 tip), local x. */
function fangAt(f: Fang, t: number): { pt: Pt; out: Pt; hw: number } {
  const p0: Pt = [f.x, f.y]
  const p1: Pt = [f.x + f.lean * f.bend[0], f.y - f.rise * f.bend[1]]
  const p2: Pt = [f.x + f.lean, f.y - f.rise]
  const s = 1 - t
  const pt: Pt = [s * s * p0[0] + 2 * s * t * p1[0] + t * t * p2[0], s * s * p0[1] + 2 * s * t * p1[1] + t * t * p2[1]]
  const dx = 2 * s * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
  const dy = 2 * s * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
  const len = Math.hypot(dx, dy) || 1
  return { pt, out: [-dy / len, dx / len], hw: f.w * Math.pow(1 - t, 0.6) + f.tip * t }
}

/** A point beside the centreline: `k` half-widths outward (negative: inward), plus `extra`. */
function beside(f: Fang, t: number, k: number, extra = 0): Pt {
  const { pt, out, hw } = fangAt(f, t)
  const r = k * hw + Math.sign(k) * extra
  return [pt[0] + out[0] * r, pt[1] + out[1] * r]
}

const SAMPLES = [0, 0.3, 0.55, 0.75, 0.9]

function fangOutline(f: Fang): { pts: Pt[]; corners: number[] } {
  const end = f.snap ?? 1
  const ts = SAMPLES.filter(t => t < end - 0.05).concat(f.snap === undefined ? [] : [end])
  const outer = ts.map(t => beside(f, t, 1))
  const inner = ts.map(t => beside(f, t, -1)).reverse()
  const { pt } = fangAt(f, 1)
  if (f.snap === undefined) {
    // A rounded point, the base bulging a little into the lip.
    const pts = [...outer, pt, ...inner, [f.x, f.y + 1.2] as const]
    return { pts, corners: [] }
  }
  // Snapped: a jagged break across the top.
  const { pt: mid, out } = fangAt(f, end)
  const hw = fangAt(f, end).hw
  const jag: Pt[] = [
    [mid[0] + out[0] * hw * 0.3, mid[1] + out[1] * hw * 0.3 + 1.4],
    [mid[0] - out[0] * hw * 0.25, mid[1] - out[1] * hw * 0.25 - 0.6],
  ]
  const pts = [...outer, ...jag, ...inner, [f.x, f.y + 1.2] as const]
  const top = outer.length - 1
  return { pts, corners: [top, top + 1, top + 2, top + 3] }
}

function drawFang(ctx: Ctx, side: Side, f: Fang, extras: { band: boolean; cap: boolean }): string {
  const { p } = ctx
  const { pts, corners } = fangOutline(f)
  const outline = loop(onSide(side, pts), corners)
  // The shade on the inner flank, inset from the edge.
  const end = (f.snap ?? 1) - 0.08
  const ts = [0.05, 0.3, 0.55, 0.75].filter(t => t < end)
  const shadeEdge = ts.map(t => beside(f, t, -1))
  const shadeIn = ts.map(t => beside(f, t, -0.35)).reverse()
  let out =
    flat(outline, p.tusk) +
    flat(loop(onSide(side, [...shadeEdge, ...shadeIn])), p.tuskShade) +
    stroke(outline)
  if (extras.cap && f.snap === undefined) {
    // A metal sheath over the top half, a little proud of the tusk, with a shine down one side.
    const along = [0.48, 0.7, 0.88]
    const outer = along.map(t => beside(f, t, 1, 0.7))
    const inner = along.map(t => beside(f, t, -1, 0.7)).reverse()
    const { pt, out: o } = fangAt(f, 1)
    const tip: Pt = [pt[0] + o[0] * 0.3, pt[1] - 1.2]
    const cap = loop(onSide(side, [...outer, tip, ...inner]), [0, along.length * 2])
    const shine = [beside(f, 0.54, 0.75), beside(f, 0.8, 0.55), beside(f, 0.8, 0.1), beside(f, 0.54, 0.2)]
    out += path(cap, { fill: p.metal, sw: W.detail }) + flat(loop(onSide(side, shine)), p.metalLight)
  }
  if (extras.band) {
    // A metal ring hugging the root: about 3.4 units tall whatever the tusk's length, so the metal
    // shows inside its outline, and clear of a cap.
    const t0 = Math.min(0.14, 0.9 / f.rise)
    const t1 = Math.min(t0 + (f.rise < 7 ? 2.6 : 3.4) / f.rise, (f.snap ?? 0.48) - 0.04)
    const ring = [beside(f, t0, -1, 0.8), beside(f, t0, 1, 0.8), beside(f, t1, 1, 0.8), beside(f, t1, -1, 0.8)]
    out += path(loop(onSide(side, ring), [0, 1, 2, 3]), { fill: p.metal, sw: W.detail })
  }
  return out
}

/**
 * Where tusk tips may reach. The widest eye and its socket come down to E + 4.6, and rims round
 * the eyes (monocle, pince-nez, spectacles, goggles, patch, shades; not brow-goggles, up on the
 * forehead) to E + 7.6 .. 9.8, so a tip stops at E + 7.5 under bare eyes and E + 10.5 under rims,
 * leaving skin between: touching, a tusk seems to poke the eye or prop up the glasses. A cap
 * rises 1.2 above its tip, so capped tusks stop that much lower.
 */
function tipFloor(ctx: Ctx): number {
  const { a, look } = ctx
  const rims = look.eyewear !== 'none' && look.eyewear !== 'brow-goggles'
  return a.E + (rims ? 10.5 : 7.5) + (look.tuskCaps ? 1.2 : 0)
}

/** Where along a fang (0 base .. 1 tip) its centreline reaches height y: fangAt's y, inverted. */
function crossing(f: Fang, y: number): number {
  const r = Math.min(1, Math.max(0, (f.y - y) / f.rise))
  const b = f.bend[1]
  return r / (b + Math.sqrt(b * b + (1 - 2 * b) * r))
}

/**
 * A fang of `base.rise` at `base.x`, its tip held under the eyes (tipFloor). A tusk that rises
 * past the nose's line (1.5 below its bottom) keeps its inner flank the nose's half-width + 1.2
 * from the centre line, checked where it crosses the line, or at its upper half (t = 0.65) if it
 * crosses lower down. A wide nose over a narrow jaw (the bean's) moves the base outward until it
 * clears: holding the tip under the nose instead cut a big tusk to a wedge shorter than a pair.
 * Only a jaw with no room for that (none of the four heads) holds the tip at the line.
 */
function fang(ctx: Ctx, base: Omit<Fang, 'y'>, y: number): Fang {
  const { a } = ctx
  const box = noseBox(ctx)
  const f: Fang = { ...base, y, rise: Math.max(3, Math.min(base.rise, y - tipFloor(ctx))) }
  const line = a.N + box.bottom + 1.5
  if (y - f.rise >= line) return f
  // The flank only moves outward towards the tip, so its lowest point past the line is the one to
  // clear. Sliding a fang sideways keeps its shape: the shortfall is exactly how far to move it.
  const short = box.hw + 1.2 - beside(f, Math.max(0.65, crossing(f, line)), -1)[0]
  if (short <= 0) return f
  if (base.x + short <= a.JW - base.w - 1) return { ...f, x: base.x + short }
  return { ...f, rise: Math.max(3, y - line) }
}

/** A tusk placed on a side, with whether it wears a band and a cap. */
interface Placed {
  side: Side
  fang: Fang
  band: boolean
  cap: boolean
}

/** Every tusk this look has, in drawing order. */
function placeTusks(ctx: Ctx): Placed[] {
  const { a, look } = ctx
  const y = lowerLip(ctx)
  const len = look.tuskLength
  const band = look.tuskBands
  const cap = look.tuskCaps
  const pair: Omit<Fang, 'y'> = { x: a.TD, rise: 10 + len * 1.6, lean: 1.8, bend: [0.1, 0.55], w: 3.4, tip: 0.3 }
  const pairOf = (f: Fang): Placed[] => [
    { side: 1, fang: f, band, cap },
    { side: -1, fang: f, band, cap },
  ]

  switch (look.tusks) {
    case 'pair':
      return pairOf(fang(ctx, pair, y))
    case 'stubs':
      // Short and blunt.
      return pairOf(fang(ctx, { ...pair, rise: 4.5 + len * 0.7, lean: 0.4, w: 3.2, tip: 1.6 }, y))
    case 'big':
      return pairOf(fang(ctx, { ...pair, rise: 13 + len * 2, lean: 2.4, w: 4.4, tip: 0.4 }, y))
    case 'broken': {
      // Side +1 snapped off halfway (no cap on the stump); side −1 whole.
      const whole = fang(ctx, pair, y)
      return [
        { side: 1, fang: { ...whole, snap: 0.55 }, band, cap: false },
        { side: -1, fang: whole, band, cap },
      ]
    }
    case 'single':
      return [{ side: 1, fang: fang(ctx, { ...pair, w: 3.8, rise: pair.rise + 1 }, y), band, cap }]
    case 'boar':
      // Rising straight, then sweeping outward like a boar's.
      return pairOf(fang(ctx, { ...pair, rise: 9 + len * 1.4, lean: 5.5, bend: [-0.1, 0.95], w: 3.6, tip: 0.3 }, y))
    case 'double': {
      // A second, smaller pair outside the first, where the jaw is wide enough. The outer pair is
      // drawn first (behind) and goes without bands.
      if (a.TD < 10) return pairOf(fang(ctx, pair, y))
      const inner = fang(ctx, { ...pair, x: a.TD - 0.8 }, y)
      // 4.8 outside the inner pair, wherever a wide nose moved it (at TD + 4 otherwise).
      const outer = fang(ctx, { ...pair, x: inner.x + 4.8, rise: 6 + len, lean: 1.6, w: 2.6, tip: 0.3 }, y + 0.4)
      return ([1, -1] as const).flatMap(side => [
        { side, fang: outer, band: false, cap },
        { side, fang: inner, band, cap },
      ])
    }
  }
}

export function tusks(ctx: Ctx): string {
  return placeTusks(ctx)
    .map(t => drawFang(ctx, t.side, t.fang, { band: t.band, cap: t.cap }))
    .join('')
}

/** Where one tusk sits on the canvas, for parts that must steer round it (mustache strands). */
export interface TuskSpan {
  side: Side
  /** The base: centre x, half-width, and y (the lower lip). */
  x: number
  halfWidth: number
  base: number
  /** The tip (or the top of the break); a cap adds up to 1.2 above it. */
  tipX: number
  tipY: number
}

/** Every tusk's base and tip, in canvas units. */
export function tuskSpans(ctx: Ctx): TuskSpan[] {
  return placeTusks(ctx).map(({ side, fang: f }) => {
    const [tx, ty] = fangAt(f, f.snap ?? 1).pt
    return { side, x: X(side, f.x), halfWidth: f.w, base: f.y, tipX: X(side, tx), tipY: ty }
  })
}
