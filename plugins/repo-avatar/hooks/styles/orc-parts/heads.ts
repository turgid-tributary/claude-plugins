// Heads: the four skull shapes, the anchors every other part places itself by, the head and jaw,
// and the ears.

import { W, both, d, flat, g, n, path, shape } from './svg'
import type { Row } from './svg'
import type { Anchors, Ctx, EarName, HeadName, Look, Side } from './types'

export const HEAD_ROWS: readonly Row<HeadName>[] = [
  ['brute', 20, 40],
  ['bean', 40, 15],
  ['dome', 25, 25],
  ['lantern', 15, 20],
]

interface HeadShape {
  C: number
  B: number
  E: number
  ED: number
  N: number
  M: number
  J: number
  SW: number
  CW: number
  JW: number
  /** The flat of the chin, as a share of the jaw half-width: square jaws have a wide flat. */
  chin: number
}

/**
 * Brute: a square block, the most grunt-like. Bean: rounder and jowly, the most peon-like. Dome:
 * a tall narrow skull over a wide jaw. Lantern: a long jaw.
 */
const HEAD_SHAPES: Record<HeadName, HeadShape> = {
  brute: { C: 20, B: 40, E: 46, ED: 12, N: 55, M: 65, J: 83, SW: 24, CW: 31, JW: 30, chin: 0.55 },
  bean: { C: 22, B: 42, E: 48, ED: 11, N: 56, M: 66, J: 82, SW: 22, CW: 28, JW: 24, chin: 0.3 },
  dome: { C: 17, B: 40, E: 46, ED: 11, N: 54, M: 65, J: 84, SW: 21, CW: 31, JW: 29, chin: 0.45 },
  lantern: { C: 19, B: 39, E: 45, ED: 12, N: 55, M: 67, J: 86, SW: 23, CW: 29, JW: 31, chin: 0.5 },
}

export function anchorsFor(look: Look): Anchors {
  const shape = HEAD_SHAPES[look.head]
  const C = shape.C + look.jitter.c
  const J = shape.J + look.jitter.j
  const JW = shape.JW + look.jitter.jw
  const MW = Math.min(15, JW - 12)
  return {
    C,
    SEAT: C + 9,
    SW: shape.SW,
    B: shape.B,
    E: shape.E,
    ED: shape.ED,
    N: shape.N,
    M: shape.M,
    J,
    CW: shape.CW,
    JW,
    MW,
    TD: MW - 3,
    earX: shape.SW - 1,
    earY: shape.B + 5,
    COLLAR: J + 5,
    SHOULDER: 88,
  }
}

type Pt = readonly [number, number]
type Cubic = readonly [Pt, Pt, Pt, Pt]

function cubicAt([p0, p1, p2, p3]: Cubic, t: number): [number, number] {
  const u = 1 - t
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const
  return [
    k[0] * p0[0] + k[1] * p1[0] + k[2] * p2[0] + k[3] * p3[0],
    k[0] * p0[1] + k[1] * p1[1] + k[2] * p2[1] + k[3] * p3[1],
  ]
}

/**
 * The right half of the head outline (x ≥ 50) as cubics, from the crown down to the chin's centre:
 * the domed skull, the straight temple, the flare to the cheeks, the jaw corner, the flat chin.
 */
function rightHalf(look: Look, a: Anchors): Cubic[] {
  const chin = HEAD_SHAPES[look.head].chin * a.JW
  const at = (dist: number, y: number): Pt => [50 + dist, y]
  const line = (from: Pt, to: Pt): Cubic => [from, from, to, to]
  const crown = at(0, a.C)
  const temple = at(a.SW, a.C + 13)
  const brow = at(a.SW, a.B + 1)
  const cheek = at(a.CW, a.N)
  const corner = at(a.JW, a.M + 6)
  const chinEnd = at(chin, a.J)
  return [
    [crown, at(0.62 * a.SW, a.C), at(a.SW, a.C + 4), temple],
    line(temple, brow),
    [brow, at(a.SW + 1, a.B + 6), at(a.CW, a.N - 7), cheek],
    [cheek, at(a.CW, a.N + 5), at(a.JW + 1, a.M + 1), corner],
    [corner, at(a.JW, a.J - 5), at(chin + 4, a.J), chinEnd],
    line(chinEnd, at(0, a.J)),
  ]
}

/** The head outline, crown to chin, both sides. */
export function headPath(look: Look, a: Anchors): string {
  const half = rightHalf(look, a)
  const mirror = ([x, y]: Pt): Pt => [100 - x, y]
  const step = (p1: Pt, p2: Pt, p3: Pt, straight: boolean) =>
    straight ? d`L${p3[0]} ${p3[1]}` : d`C${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`
  const isLine = ([p0, p1, p2, p3]: Cubic) => p0 === p1 && p2 === p3
  const right = half.map(seg => step(seg[1], seg[2], seg[3], isLine(seg)))
  // The left half walks the right half backwards, mirrored: from the chin back up to the crown.
  const left = [...half].reverse().map(seg => step(mirror(seg[2]), mirror(seg[1]), mirror(seg[0]), isLine(seg)))
  return `M50 ${n(a.C)} ${right.join(' ')} ${left.join(' ')} Z`
}

/** One cubic of the outline as a polyline of 24 steps, and the span of y it covers. */
interface Polyline {
  top: number
  bottom: number
  points: readonly Pt[]
}

/**
 * The right half's outline as polylines, kept by the anchors object (which nothing changes once
 * made): the parts measure one head many thousands of times in a drawing, and resolve fits the
 * paint to it, so sampling it afresh each time made resolve slow.
 */
const OUTLINES = new WeakMap<Anchors, { head: HeadName; polylines: readonly Polyline[] }>()

function outline(look: Look, a: Anchors): readonly Polyline[] {
  const kept = OUTLINES.get(a)
  if (kept?.head === look.head) return kept.polylines
  const polylines = rightHalf(look, a).map(seg => {
    const points = Array.from({ length: 25 }, (_, i) => cubicAt(seg, i / 24))
    const ys = points.map(([, y]) => y)
    return { top: Math.min(...ys), bottom: Math.max(...ys), points }
  })
  OUTLINES.set(a, { head: look.head, polylines })
  return polylines
}

/**
 * The head's half-width at height y (its outline's distance from the centre line), or 0 above the
 * crown and below the chin. For parts that must stay inside the head (paint, scars) or clear it
 * (hoops, chains).
 */
export function headHalfWidth(look: Look, a: Anchors, y: number): number {
  let widest = 0
  for (const { top, bottom, points } of outline(look, a)) {
    if (y < top || y > bottom) continue
    let prev: Pt | undefined
    for (const next of points) {
      if (prev !== undefined) {
        const [y0, y1] = [prev[1], next[1]]
        if ((y >= y0 && y <= y1) || (y >= y1 && y <= y0)) {
          const t = y1 === y0 ? 1 : (y - y0) / (y1 - y0)
          widest = Math.max(widest, prev[0] + (next[0] - prev[0]) * t - 50)
        }
      }
      prev = next
    }
  }
  return widest
}

/** Layer 7: the head, filled with skin and outlined. */
export function head({ look, a, p }: Ctx): string {
  return shape(headPath(look, a), p.skin, W.silhouette)
}

/**
 * Layer 8: shading on the jutting lower jaw (the underbite): a darker crescent above the chin. Flat,
 * with no outline, so it never reads as a mouth.
 */
export function jaw({ a, p }: Ctx): string {
  const w = a.MW + 3
  return flat(d`M${50 - w} ${a.J - 6} Q50 ${a.J - 1} ${50 + w} ${a.J - 6} Q50 ${a.J - 3.5} ${50 - w} ${a.J - 6} Z`, p.skinDark)
}

// Ears ------------------------------------------------------------------------------------------
// Each ear is drawn in its own coordinates: the root at (0, 0), pointing out along +x, y down. The
// root is buried a few units inside the head, which is drawn over it.

interface Ear {
  outline: string
  /** The outline's lower edge, from the tip back towards the root: where hoops hang. */
  lower: Cubic
}

export const EAR_ROWS: readonly Row<EarName>[] = [
  ['long', 30, 30],
  ['swept', 12, 30],
  ['droopy', 22, 5],
  ['bat', 22, 4],
  ['notched', 4, 18],
  ['torn', 4, 13],
  ['stub', 6, 10],
]

const EAR_SHAPES: Record<EarName, Ear> = {
  long: {
    outline: 'M-3 -6 C6 -9 15 -14 25 -21 C21 -10 13 0 4 6 C1 7 -2 6 -3 4 Z',
    lower: [[25, -21], [21, -10], [13, 0], [4, 6]],
  },
  swept: {
    outline: 'M-3 -6 C7 -9 17 -11 27 -11 C20 -4 12 3 3 6 C0 7 -2 6 -3 4 Z',
    lower: [[27, -11], [20, -4], [12, 3], [3, 6]],
  },
  droopy: {
    outline: 'M-3 -7 C8 -9 17 -3 23 10 C15 10 6 9 0 6 C-1 6 -2 5 -3 4 Z',
    lower: [[23, 10], [15, 10], [6, 9], [0, 6]],
  },
  bat: {
    outline: 'M-3 -9 C3 -20 13 -24 22 -24 C22 -12 16 2 3 7 C0 8 -2 6 -3 4 Z',
    lower: [[22, -24], [22, -12], [16, 2], [3, 7]],
  },
  notched: {
    outline: 'M-3 -6 C4 -8 8 -10 11 -12 L13 -8.5 L16 -15.5 C19 -17.5 22 -19.5 25 -21 C21 -10 13 0 4 6 C1 7 -2 6 -3 4 Z',
    lower: [[25, -21], [21, -10], [13, 0], [4, 6]],
  },
  torn: {
    outline: 'M-3 -6 C6 -9 13 -13 19 -17 L21.5 -14.5 L23 -20 L24.5 -14 C20 -7 12 1 4 6 C1 7 -2 6 -3 4 Z',
    lower: [[24.5, -14], [20, -7], [12, 1], [4, 6]],
  },
  stub: {
    outline: 'M-3 -6 C3 -8 8 -10 14 -12 C11 -4 7 2 3 5 C0 6 -2 5 -3 4 Z',
    lower: [[14, -12], [11, -4], [7, 2], [3, 5]],
  },
}

/** An outline's segments as cubics (a line as a straight one), read from its absolute M L C Z path. */
function cubicsOf(outline: string): Cubic[] {
  const tokens = outline.match(/[MLCZ]|-?\d*\.?\d+/g) ?? []
  const cubics: Cubic[] = []
  let start: Pt = [0, 0]
  let pen: Pt = [0, 0]
  let i = 0
  const point = (): Pt => [Number(tokens[i++]), Number(tokens[i++])]
  while (i < tokens.length) {
    const op = tokens[i++]
    if (op === 'M') start = pen = point()
    else if (op === 'L' || op === 'Z') {
      const to = op === 'L' ? point() : start
      cubics.push([pen, pen, to, to])
      pen = to
    } else if (op === 'C') {
      const cubic: Cubic = [pen, point(), point(), point()]
      cubics.push(cubic)
      pen = cubic[3]
    }
  }
  return cubics
}

/**
 * Each ear's whole outline as cubics. Its reach must count the upper edge too: under a wide brim's
 * droop, the torn ear's notch turns out past the lower edge's tip, and the canvas cut it flat.
 */
const EAR_CURVES = Object.fromEntries(
  Object.entries(EAR_SHAPES).map(([name, ear]) => [name, cubicsOf(ear.outline)]),
) as Record<EarName, Cubic[]>

/** The ear's outermost x after the droop rotation, in its own coordinates. */
function earReach(name: EarName, droop: number): number {
  const rad = (droop * Math.PI) / 180
  let reach = 0
  for (const seg of EAR_CURVES[name]) {
    for (let i = 0; i <= 16; i++) {
      const [x, y] = cubicAt(seg, i / 16)
      reach = Math.max(reach, x * Math.cos(rad) - y * Math.sin(rad))
    }
  }
  return reach
}

/**
 * The ear's scale: a little longer per earLength step, but its outline never past x 3..97, droop
 * included, so its stroke (1.75 either side) stays on the canvas. Floored to two decimals, which
 * `earTransform` writes in full: the drawing, its stroke and `earPoint` all use this one value.
 */
function earScale(look: Look, a: Anchors): number {
  const length = 1 + look.earLength * 0.06
  return Math.floor(Math.min(length, (47 - a.earX) / earReach(look.ears, look.earDroop)) * 100) / 100
}

/**
 * The scale goes in as is, not through n(): rounded to one decimal, a 0.96 ear was drawn at 1, off
 * the canvas, and a 0.95 one at −0.9 by 1, a stretch whose droop `flatten` couldn't bake.
 */
function earTransform(look: Look, a: Anchors, side: Side): string {
  const k = earScale(look, a)
  return `translate(${n(50 + side * a.earX)} ${n(a.earY)}) scale(${side * k} ${k}) rotate(${n(look.earDroop)})`
}

/** A point given in an ear's own coordinates, on the canvas: for hoops and anything hung on an ear. */
export function earPoint({ look, a }: Ctx, side: Side, local: readonly [number, number]): [number, number] {
  const k = earScale(look, a)
  const rad = (look.earDroop * Math.PI) / 180
  const [lx, ly] = local
  const rx = lx * Math.cos(rad) - ly * Math.sin(rad)
  const ry = lx * Math.sin(rad) + ly * Math.cos(rad)
  return [50 + side * a.earX + side * k * rx, a.earY + k * ry]
}

/** A point on the ear's lower edge, on the canvas: t = 0 is the tip, 1 the root (under the head). */
export function earEdge(ctx: Ctx, side: Side, t: number): [number, number] {
  return earPoint(ctx, side, cubicAt(EAR_SHAPES[ctx.look.ears].lower, t))
}

/** How far along the lower edge (from the tip) the ear still clears the head by `margin`. */
export function earClearT(ctx: Ctx, side: Side, margin = 2.5): number {
  for (let t = 0.95; t > 0.3; t -= 0.05) {
    const [x, y] = earEdge(ctx, side, t)
    if (Math.abs(x - 50) >= headHalfWidth(ctx.look, ctx.a, y) + margin) return t
  }
  return 0.3
}

/** Where a hoop hangs on this ear: the lobe, as near the root as the head leaves showing. */
export function earLobe(ctx: Ctx, side: Side): [number, number] {
  return earEdge(ctx, side, earClearT(ctx, side))
}

/** Layer 6: both ears, behind the head. */
export function ears(ctx: Ctx): string {
  const { look, a, p } = ctx
  const ear = EAR_SHAPES[look.ears]
  return both(side =>
    g(
      path(ear.outline, { fill: p.skin, sw: W.silhouette / earScale(look, a) }) +
        path(ear.outline, { fill: p.skinDark, stroke: 'none', transform: 'translate(3 0) scale(0.6)' }),
      { transform: earTransform(look, a, side) },
    ),
  )
}
