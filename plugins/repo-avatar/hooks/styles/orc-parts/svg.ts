// Shared drawing helpers for the orc style: the outline, stroke widths, number formatting, element
// builders, colours, the rotation flattener, and the prng helpers every draw in `choose` goes
// through.
//
// The SVG stays within what rsvg-convert, resvg, ImageMagick and browsers draw alike: absolute
// M L C Q Z paths (no A arcs), circle, ellipse, rect, transforms, and per-element fill-opacity. No
// ids, defs, gradients, filters, masks, clip paths, text or CSS. ImageMagick's built-in renderer
// (MSVG, which Homebrew's magick uses) needs two more things, both handled here: a stroke colour
// draws only with a stroke-opacity after it (`attrs`), and rotations come out reversed and shifted
// (`flatten` bakes them into the coordinates, leaving only translate and scale). It also draws at
// the SVG's own size, 100 px from the viewBox here, and only then resizes the bitmap, which blurs
// every outline: its converter must set `-density` (px × 96 / 100) before the input to draw at
// full size, and write `png32:` for an 8-bit PNG (plain `png:` is 16-bit, six times the bytes).

import type { Prng } from '../../vendor/dicebear.js'
import type { Side } from './types'

/** The one outline colour, a warm near-black. The root group strokes everything with it. */
export const O = '#1b1712'

/**
 * Stroke widths in viewBox units. At 48 px a unit is 0.48 px, so nothing essential is thinner than
 * `detail`.
 */
export const W = {
  /** Head, ears, hats, clothing, pauldrons, hair masses. */
  silhouette: 3.5,
  /** The brow ridge. */
  brow: 3,
  /** Eyes, nose, mouth, tusks, mustache, beard. The root group's default. */
  feature: 2.6,
  /** The thinnest allowed: stitches, chains, rims. */
  detail: 2,
} as const

/** Rounds to one decimal, as SVG text. */
export function n(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

/** Path data with each interpolated number rounded to one decimal: d`M${x} ${y} L${x2} ${y2}`. */
export function d(strings: TemplateStringsArray, ...values: number[]): string {
  let out = strings[0] ?? ''
  values.forEach((value, i) => {
    out += n(value) + (strings[i + 1] ?? '')
  })
  return out
}

/** Presentation attributes an element can override; the root group sets the rest. */
export interface Paint {
  fill?: string
  stroke?: string
  /** stroke-width */
  sw?: number
  /** fill-opacity */
  fo?: number
  /** stroke-opacity */
  so?: number
  /** stroke-linecap */
  cap?: 'butt' | 'round' | 'square'
  /** stroke-linejoin */
  join?: 'miter' | 'round' | 'bevel'
  transform?: string
}

const NAMES: Record<keyof Paint, string> = {
  fill: 'fill',
  stroke: 'stroke',
  sw: 'stroke-width',
  fo: 'fill-opacity',
  so: 'stroke-opacity',
  cap: 'stroke-linecap',
  join: 'stroke-linejoin',
  transform: 'transform',
}

/**
 * The attributes, always in NAMES order. MSVG starts every element at stroke-opacity 0 and lets a
 * stroke colour take that alpha, so a colour draws only when a stroke-opacity follows it: each
 * stroke colour gets an explicit one (1 unless `so` says otherwise). It changes nothing elsewhere.
 */
function attrs(paint: Paint): string {
  let out = ''
  for (const key of Object.keys(NAMES) as (keyof Paint)[]) {
    const value = paint[key]
    if (value === undefined) continue
    out += ` ${NAMES[key]}="${typeof value === 'number' ? n(value) : value}"`
    if (key === 'stroke' && value !== 'none' && paint.so === undefined) out += ' stroke-opacity="1"'
  }
  return out
}

export function path(data: string, paint: Paint = {}): string {
  return `<path d="${data}"${attrs(paint)}/>`
}

export function circle(cx: number, cy: number, r: number, paint: Paint = {}): string {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"${attrs(paint)}/>`
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, paint: Paint = {}): string {
  return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}"${attrs(paint)}/>`
}

export function rect(x: number, y: number, width: number, height: number, paint: Paint & { rx?: number } = {}): string {
  const { rx, ...rest } = paint
  const round = rx === undefined ? '' : ` rx="${n(rx)}"`
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}"${round}${attrs(rest)}/>`
}

/** A group; empty markup stays empty, so optional parts cost nothing. */
export function g(body: string, paint: Paint = {}): string {
  return body === '' ? '' : `<g${attrs(paint)}>${body}</g>`
}

/** A filled, outlined shape (the usual cartoon part). */
export function shape(data: string, fill: string, sw: number = W.feature): string {
  return path(data, { fill, sw })
}

/** A filled shape with no outline: shading, paint, highlights. */
export function flat(data: string, fill: string, fo?: number): string {
  return path(data, fo === undefined ? { fill, stroke: 'none' } : { fill, stroke: 'none', fo })
}

/**
 * A coloured line that reads on any skin and either background: the outline at w+2.5, then the
 * colour at w on top. For chains, rims, hoops, rope, thin mustaches.
 */
export function outlined(data: string, colour: string, w: number = W.detail, cap: Paint['cap'] = 'round'): string {
  return path(data, { fill: 'none', sw: w + 2.5, cap }) + path(data, { fill: 'none', stroke: colour, sw: w, cap })
}

/**
 * x at `dist` from the centre line on `side`. Side +1 is the drawing's right (x > 50), which the
 * global flip (register.tsx, FLIP) shows on the viewer's LEFT. That's intended: one-sided parts
 * (monocle, eyepatch, broken tusk) use side +1 and simply appear on the other side.
 */
export function X(side: Side, dist: number): number {
  return 50 + side * dist
}

/** Draws a part for side +1, then side −1. */
export function both(draw: (side: Side) => string): string {
  return draw(1) + draw(-1)
}

/** The group transform that mirrors right-side art (x > 50) to the left. */
export const MIRROR = 'matrix(-1 0 0 1 100 0)'

/** Picks `list[index mod length]`; for the 0..99 colour indices in Traits. */
export function at<T>(list: readonly T[], index: number): T {
  const item = list[((index % list.length) + list.length) % list.length]
  if (item === undefined) throw new Error('at: empty list')
  return item
}

// Colours ---------------------------------------------------------------------------------------

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

/** An HSL colour (h 0..360, s and l 0..100) as #rrggbb. Never emit hsl(): renderers disagree on it. */
export function hex(h: number, s: number, l: number): string {
  const sat = clamp(s, 0, 100) / 100
  const light = clamp(l, 0, 100) / 100
  const k = (k0: number) => (k0 + ((h % 360) + 360) / 30) % 12
  const a = sat * Math.min(light, 1 - light)
  const channel = (k0: number) => {
    const value = light - a * Math.max(-1, Math.min(k(k0) - 3, 9 - k(k0), 1))
    return Math.round(value * 255).toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

/** #rrggbb as [h 0..360, s 0..100, l 0..100]. */
export function toHsl(colour: string): [number, number, number] {
  const value = Number.parseInt(colour.slice(1), 16)
  const r = ((value >> 16) & 255) / 255
  const gr = ((value >> 8) & 255) / 255
  const b = (value & 255) / 255
  const max = Math.max(r, gr, b)
  const min = Math.min(r, gr, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const delta = max - min
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let h = max === r ? (gr - b) / delta + (gr < b ? 6 : 0) : max === gr ? (b - r) / delta + 2 : (r - gr) / delta + 4
  h *= 60
  return [h, s * 100, l * 100]
}

/** Shifts a colour's lightness (and optionally saturation) by points: shade('#556b2f', -10). */
export function shade(colour: string, dl: number, ds = 0): string {
  const [h, s, l] = toHsl(colour)
  return hex(h, s + ds, l + dl)
}

/** Blends two #rrggbb colours; t = 0 gives `a`, 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const pa = Number.parseInt(a.slice(1), 16)
  const pb = Number.parseInt(b.slice(1), 16)
  const channel = (shift: number) => {
    const ca = (pa >> shift) & 255
    const cb = (pb >> shift) & 255
    return Math.round(ca + (cb - ca) * t).toString(16).padStart(2, '0')
  }
  return `#${channel(16)}${channel(8)}${channel(0)}`
}

// Rotations ---------------------------------------------------------------------------------------
// MSVG turns rotate() (and any matrix() that rotates) the wrong way and shifts it: a tilted hat
// slid down its skull and the braids' chevrons flipped. Parts still write rotate() freely; draw()
// runs `flatten` last, which bakes each rotation into the coordinates of the shapes under it.

/** An affine map as SVG's matrix(a b c d e f): x' = a·x + c·y + e, y' = b·x + d·y + f. */
type Affine = readonly [a: number, b: number, c: number, d: number, e: number, f: number]

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0]
const EPS = 1e-6

/** m after k: the map that applies k first. */
function times(m: Affine, k: Affine): Affine {
  return [
    m[0] * k[0] + m[2] * k[1],
    m[1] * k[0] + m[3] * k[1],
    m[0] * k[2] + m[2] * k[3],
    m[1] * k[2] + m[3] * k[3],
    m[0] * k[4] + m[2] * k[5] + m[4],
    m[1] * k[4] + m[3] * k[5] + m[5],
  ]
}

function apply(m: Affine, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

/** A transform attribute as one matrix: translate, scale, rotate and matrix; null if it has more. */
function parseTransform(text: string): Affine | null {
  let m = IDENTITY
  for (const [, name, list] of text.matchAll(/([a-z]+)\(([^)]*)\)/gi)) {
    const v = (list ?? '').split(/[\s,]+/).filter(Boolean).map(Number)
    const [p = 0, q, r, s, t, u] = v
    if (name === 'translate') m = times(m, [1, 0, 0, 1, p, q ?? 0])
    else if (name === 'scale') m = times(m, [p, 0, 0, q ?? p, 0, 0])
    else if (name === 'matrix' && u !== undefined && q !== undefined && r !== undefined && s !== undefined && t !== undefined)
      m = times(m, [p, q, r, s, t, u])
    else if (name === 'rotate') {
      const rad = (p * Math.PI) / 180
      const [cx, cy] = [q ?? 0, r ?? 0]
      const turn: Affine = [Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0]
      m = times(times(times(m, [1, 0, 0, 1, cx, cy]), turn), [1, 0, 0, 1, -cx, -cy])
    } else return null
  }
  // Anything left over (skewX, a typo) is beyond this reader: leave that transform as written.
  return text.replace(/([a-z]+)\(([^)]*)\)/gi, '').trim() === '' ? m : null
}

/** True when the map keeps axes axis-aligned (translate, scale and mirrors): MSVG draws those right. */
const upright = (m: Affine) => Math.abs(m[1]) < EPS && Math.abs(m[2]) < EPS

/**
 * Splits a similarity (translation, uniform scale, mirror, rotation) into `place` (the translation
 * and the scale, mirrored when the map mirrors) after `turn` (a pure rotation about the origin).
 * `place` stays a transform, so strokes scale as before and baked points stay in the part's own
 * small coordinates; `turn` is baked. Null for a stretch that also rotates, which no part draws.
 */
function split(m: Affine): { place: Affine; turn: Affine } | null {
  const det = m[0] * m[3] - m[1] * m[2]
  const s = Math.sqrt(Math.abs(det))
  if (s < EPS) return null
  const sx = det < 0 ? -s : s
  const turn: Affine = [m[0] / sx, m[1] / s, m[2] / sx, m[3] / s, 0, 0]
  const isTurn = Math.abs(turn[0] - turn[3]) < EPS && Math.abs(turn[1] + turn[2]) < EPS
  return isTurn ? { place: [sx, 0, 0, s, m[4], m[5]], turn } : null
}

const isIdentity = (m: Affine) => m.every((v, i) => Math.abs(v - (IDENTITY[i] ?? 0)) < EPS)

/** A matrix as transform text, precise enough for scale factors (n() keeps one decimal). */
function matrixText(m: Affine): string {
  return `matrix(${m.map(v => String(Math.round(v * 1e4) / 1e4)).join(' ')})`
}

/** Path data mapped through `m`; null when it isn't all absolute M L C Q Z (every number in pairs). */
function mapPath(data: string, m: Affine): string | null {
  if (/[^MLCQZ\d\s.,eE+-]/.test(data)) return null
  let out = ''
  let pending: number | null = null
  for (const token of data.match(/[MLCQZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []) {
    if (/^[MLCQZ]$/.test(token)) {
      if (pending !== null) return null
      out += (out === '' ? '' : ' ') + token
    } else if (pending === null) {
      pending = Number(token)
    } else {
      const [x, y] = apply(m, pending, Number(token))
      out += `${/[MLCQZ]$/.test(out) ? '' : ' '}${n(x)} ${n(y)}`
      pending = null
    }
  }
  return pending === null ? out : null
}

/** An ellipse as four cubics (the usual 0.5523 handle), clockwise from its right end. */
function ellipseData(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5523
  return (
    `M${cx + rx} ${cy} C${cx + rx} ${cy + k * ry} ${cx + k * rx} ${cy + ry} ${cx} ${cy + ry} ` +
    `C${cx - k * rx} ${cy + ry} ${cx - rx} ${cy + k * ry} ${cx - rx} ${cy} ` +
    `C${cx - rx} ${cy - k * ry} ${cx - k * rx} ${cy - ry} ${cx} ${cy - ry} ` +
    `C${cx + k * rx} ${cy - ry} ${cx + rx} ${cy - k * ry} ${cx + rx} ${cy} Z`
  )
}

/** A rect (corners rounded by rx, ry as SVG clamps them) as a path. */
function rectData(x: number, y: number, w: number, h: number, rx: number, ry: number): string {
  const [a, b] = [Math.min(rx, w / 2), Math.min(ry, h / 2)]
  if (a <= 0 || b <= 0) return `M${x} ${y} L${x + w} ${y} L${x + w} ${y + h} L${x} ${y + h} Z`
  const k = 0.4477 // 1 − 0.5523: where a quarter-ellipse's handles sit, measured from the corner
  return (
    `M${x + a} ${y} L${x + w - a} ${y} C${x + w - k * a} ${y} ${x + w} ${y + k * b} ${x + w} ${y + b} ` +
    `L${x + w} ${y + h - b} C${x + w} ${y + h - k * b} ${x + w - k * a} ${y + h} ${x + w - a} ${y + h} ` +
    `L${x + a} ${y + h} C${x + k * a} ${y + h} ${x} ${y + h - k * b} ${x} ${y + h - b} ` +
    `L${x} ${y + b} C${x} ${y + k * b} ${x + k * a} ${y} ${x + a} ${y} Z`
  )
}

const GEOMETRY = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'transform']

/**
 * One element with the rotation `turn` baked into its geometry: circles move, ellipses and rects
 * become paths. Null when its path data can't be mapped.
 */
function bakeShape(tag: string, attr: Map<string, string>, turn: Affine): { tag: string; geometry: string } | null {
  const num = (name: string) => Number(attr.get(name) ?? 0)
  if (tag === 'circle') {
    const [x, y] = apply(turn, num('cx'), num('cy'))
    return { tag, geometry: ` cx="${n(x)}" cy="${n(y)}" r="${attr.get('r') ?? 0}"` }
  }
  const data =
    tag === 'path'
      ? (attr.get('d') ?? '')
      : tag === 'ellipse'
        ? ellipseData(num('cx'), num('cy'), num('rx'), num('ry'))
        : tag === 'rect'
          ? rectData(num('x'), num('y'), num('width'), num('height'), num(attr.has('rx') ? 'rx' : 'ry'), num(attr.has('ry') ? 'ry' : 'rx'))
          : null
  if (data === null) return null
  const mapped = mapPath(data, turn)
  return mapped === null ? null : { tag: 'path', geometry: ` d="${mapped}"` }
}

/**
 * Bakes every rotation in the markup into coordinates, so only translate and scale transforms are
 * left. Reads exactly what the builders above write: g, path, circle, ellipse and rect, with double
 * quoted attributes. Under a rotated group, each descendant's own transform is folded in too: its
 * translation and uniform scale stay a transform (strokes keep their width), the rotation turns its
 * points. A shape it can't map keeps an exact matrix(), which only MSVG would get wrong.
 */
export function flatten(markup: string): string {
  // The rotation still to bake into whatever comes next, per open group; null when none.
  const stack: (Affine | null)[] = [null]
  return markup.replace(/<(\/?)([a-z]+)([^>]*?)(\/?)>/g, (tag, close: string, name: string, rest: string, self: string) => {
    if (close !== '') {
      stack.pop()
      return tag
    }
    const outer = stack[stack.length - 1] ?? null
    const attr = new Map([...rest.matchAll(/([a-z-]+)="([^"]*)"/g)].map(([, k, v]) => [k ?? '', v ?? '']))
    const own = attr.get('transform')
    const parsed = own === undefined ? IDENTITY : parseTransform(own)
    let inner: Affine | null = null
    let out = tag
    if (outer !== null || parsed === null || !upright(parsed)) {
      const whole = parsed === null ? null : outer === null ? parsed : times(outer, parsed)
      const parts = whole === null ? null : split(whole)
      const baked = parts === null || name === 'g' ? null : bakeShape(name, attr, parts.turn)
      const others = [...attr].filter(([k]) => !GEOMETRY.includes(k) || (name === 'g' && k !== 'transform'))
      const kept = others.map(([k, v]) => ` ${k}="${v}"`).join('')
      if (parts !== null && (name === 'g' || baked !== null)) {
        // Translate and scale stay a transform; the rotation turns the points, or the children's.
        const place = isIdentity(parts.place) ? '' : ` transform="${matrixText(parts.place)}"`
        out = name === 'g' ? `<g${kept}${place}>` : `<${baked?.tag}${baked?.geometry}${kept}${place}/>`
        inner = isIdentity(parts.turn) ? null : parts.turn
      } else if (outer !== null) {
        // Can't bake it: keep the exact transform, the outer rotation in front of its own.
        const exact = matrixText(outer) + (own === undefined ? '' : ` ${own}`)
        out = tag.replace(/ transform="[^"]*"/, '').replace(/^<[a-z]+/, start => `${start} transform="${exact}"`)
      }
    }
    if (name === 'g' && self === '') stack.push(inner)
    return out
  })
}

// The prng ----------------------------------------------------------------------------------------
// Each helper makes exactly one draw. DiceBear's prng.integer(min, max) can return max + 1 (when its
// xorshift yields 2^31 − 1), so every result is clamped.

/**
 * A well-mixed prng for a seed. DiceBear's own barely mixes seeds that differ only at the end, so
 * /work/repo-0 to /work/repo-39 all made the same first draw: neighbouring repos would share a
 * build and look alike. This hashes the whole seed (FNV-1a, then murmur3's finalizer) into
 * mulberry32, so one changed character changes every draw.
 */
export function seeded(seed: string): Prng {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  let state = h | 0
  /** The next value in [0, 1). */
  const unit = (): number => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const integer = (min: number, max: number): number => min + Math.floor(unit() * (max - min + 1))
  const pick = <T>(items: T[], fallback?: T): T | undefined =>
    items.length === 0 ? (unit(), fallback) : (items[integer(0, items.length - 1)] ?? fallback)
  return {
    seed,
    next: () => void unit(),
    bool: (likelihood = 50) => integer(1, 100) <= likelihood,
    integer,
    pick: pick as Prng['pick'],
    shuffle: <T>(items: T[]): T[] => {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = integer(0, i)
        const swap = out[i] as T
        out[i] = out[j] as T
        out[j] = swap
      }
      return out
    },
    string: (length: number, characters = 'abcdefghijklmnopqrstuvwxyz1234567890') =>
      Array.from({ length }, () => characters[integer(0, characters.length - 1)] ?? '').join(''),
  }
}

/** One draw: a whole number from lo to hi, both included. */
export function range(prng: Prng, lo: number, hi: number): number {
  return clamp(prng.integer(lo, hi), lo, hi)
}

/** One draw: an index from 0 to count − 1. */
export function index(prng: Prng, count: number): number {
  return range(prng, 0, Math.max(count, 1) - 1)
}

/** One draw: true with `percent` chance (0 is never, still one draw). */
export function chance(prng: Prng, percent: number): boolean {
  return prng.bool(percent)
}

/**
 * A weighted table row: the name, its peon weight, its grunt weight, and optionally its gentleman
 * weight (used instead of both when the table is read in the 'gent' column). 0 means never.
 */
export type Row<N extends string> = readonly [name: N, peon: number, grunt: number, gent?: number]
export type Column = 'peon' | 'grunt' | 'gent'

function weightOf<N extends string>(row: Row<N>, column: Column): number {
  const weight = column === 'peon' ? row[1] : column === 'grunt' ? row[2] : (row[3] ?? 0)
  return Math.max(0, weight)
}

/**
 * One draw: a name from the table, weighted by `column`. A column whose weights are all 0 gives
 * the first row, still for one draw.
 */
export function weighted<N extends string>(prng: Prng, rows: readonly Row<N>[], column: Column): N {
  const total = rows.reduce((sum, row) => sum + weightOf(row, column), 0)
  const roll = range(prng, 0, Math.max(total, 1) - 1)
  const first = rows[0]
  if (first === undefined) throw new Error('weighted: empty table')
  if (total <= 0) return first[0]
  let left = roll
  let last = first[0]
  for (const row of rows) {
    const weight = weightOf(row, column)
    if (weight === 0) continue
    last = row[0]
    if (left < weight) return row[0]
    left -= weight
  }
  return last
}
