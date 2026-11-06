// Hats. Each is built from the crown C, the seat SEAT and the skull half-width SW, never reaches
// below B−3 over the face, and keeps its top at y ≥ 2. Drawn last, inside a group tilted about
// (50, SEAT), so every top leaves room for its own HAT_INFO.maxTilt.
//
// The look: flat fills, the thick dark outline (W.silhouette on the big shapes), a darker shade of
// the same hue for depth on side −1 and a light sheen on side +1. Dark hats (soot, navy) keep
// palette.ts's lightness 30+ for large fills and carry a light band, trim or sheen, so they still
// read once the outline vanishes into a dark terminal. A hat's fill comes from its own colour list
// through `hatFill`, which steps past any colour that would melt into the skin under it.

import { METAL_HEX, clashes } from './palette'
import { W, at, circle, d, ellipse, flat, g, mix, n, outlined, path, rect, shade, shape, toHsl } from './svg'
import type { Paint, Row } from './svg'
import type { Ctx, Draw, HairName, HatName } from './types'

/**
 * About a third of peons and two grunts in five go bare-headed, so their own scalp, topknot or
 * mohawk shows. No one hat dominates: the top hat stays a treat, and the round work and war helmets
 * are spread thin. A gentleman hat (top hat, tiny top hat, bowler, pith) brings the gentleman's
 * neckwear and props with it, so grunts get them less often than peons, and go bare-headed
 * instead: the warrior isn't as often a dandy as the worker.
 */
export const HAT_ROWS: readonly Row<HatName>[] = [
  ['none', 30, 34],
  ['top-hat', 4, 3],
  ['tiny-top-hat', 3, 2],
  ['bowler', 3, 2],
  ['boater', 4, 1],
  ['fez', 3, 2],
  ['tricorn', 3, 3],
  ['crown', 2, 2],
  ['pith', 2, 1],
  ['flat-cap', 4, 1],
  ['captain', 3, 2],
  ['horned-helm', 1, 7],
  ['spiked-helm', 0, 6],
  ['skull-helm', 0, 4],
  ['bandana', 2, 8],
  // The alpine hat (a felt hat with one feather in its band); the name is fixed in types.ts.
  ['feather-band', 3, 4],
  ['straw', 7, 0],
  ['hard-hat', 7, 0],
  ['miner', 3, 0],
  ['beanie', 4, 2],
  ['propeller', 3, 0],
  ['toque', 3, 0],
  ['party', 3, 1],
]

export interface HatInfo {
  /**
   * Front hair under the hat. 'hide': it goes under the hat. 'poke': it shows, through the hat
   * (which covers its base) or round a small perched one, all but the kinds in `hides`. See
   * `hairShows`.
   */
  hair: 'hide' | 'poke'
  /** Front hair that goes under a 'poke' hat all the same. */
  hides: readonly HairName[]
  /** Degrees the ears tip down so the brim clears them. */
  earDroop: number
  /** The most the hat may tilt either way; 0 keeps it level. */
  maxTilt: number
  /** Part of the gentleman set: switches eyewear, mustache, neckwear and props to gentleman weights. */
  gent: boolean
  /** Covers the forehead band (B−8..B−3): goggles can't rest there, so they go over the eyes. */
  coversForehead: boolean
}

const info = (hair: HatInfo['hair'], earDroop: number, maxTilt: number, more: Partial<HatInfo> = {}): HatInfo => ({
  hair,
  hides: [],
  earDroop,
  maxTilt,
  gent: false,
  coversForehead: false,
  ...more,
})

/**
 * Front hair that stands up off the top of the skull, just where a small perched hat sits: it
 * hides under one. The tuft's tall middle lock stood against the tiny top hat's side as a grey
 * fin, and its outer two stuck out from under the party hat like a pair of horns.
 */
const TALL_HAIR: readonly HairName[] = ['tuft', 'topknot', 'mohawk']

/**
 * Front hair the bandana hides. Its cloth covers the crown the tuft grows from, so the middle lock
 * came up through the cloth's top as a fin; the fringe's locks are under its forehead edge, so
 * hair.ts draws no fringe there.
 */
const UNDER_BANDANA: readonly HairName[] = ['tuft', 'fringe']

/**
 * Front hair the crown hides. Drawn behind it, a topknot's bun filled the gaps between its points
 * (gold points on a dark dome, a clump at 48 px), a tuft left a speck in one, and a fringe ringed
 * its foot like fur trim. A mohawk shows as a narrow plume behind its middle point (hair.ts
 * `crownedMohawk`), and spikes all round it still read as hair.
 */
const UNDER_CROWN: readonly HairName[] = ['tuft', 'topknot', 'fringe']

/**
 * maxTilt keeps each top at y ≥ 2 (with its outline) on the tallest skull. coversForehead marks the
 * hats whose front edge comes down to about B−7.5, the middle of brow-goggles' lenses (the fez stops
 * just above it, leaving only a sliver of lens): only the crown, tiny top hat and party hat leave
 * pushed-up goggles showing, riding higher over them (`goggleLift`). It also squashes raised brows
 * (face.ts), so a perched hat must not set it.
 */
export const HAT_INFO: Record<HatName, HatInfo> = {
  none: info('poke', 0, 0),
  'top-hat': info('hide', 0, 5, { gent: true, coversForehead: true }),
  'tiny-top-hat': info('poke', 0, 0, { hides: TALL_HAIR, gent: true }),
  bowler: info('hide', 0, 6, { gent: true, coversForehead: true }),
  boater: info('hide', 10, 5, { coversForehead: true }),
  fez: info('hide', 0, 5, { coversForehead: true }),
  tricorn: info('hide', 15, 6, { coversForehead: true }),
  crown: info('poke', 0, 6, { hides: UNDER_CROWN }),
  pith: info('hide', 15, 3, { gent: true, coversForehead: true }),
  'flat-cap': info('hide', 0, 6, { coversForehead: true }),
  captain: info('hide', 0, 4, { coversForehead: true }),
  'horned-helm': info('hide', 0, 0, { coversForehead: true }),
  'spiked-helm': info('hide', 0, 0, { coversForehead: true }),
  'skull-helm': info('hide', 0, 0, { coversForehead: true }),
  bandana: info('poke', 0, 4, { hides: UNDER_BANDANA, coversForehead: true }),
  'feather-band': info('hide', 0, 5, { coversForehead: true }),
  // The wide brim: ears tip down well clear of it, not tucked just under its edge.
  straw: info('hide', 30, 5, { coversForehead: true }),
  'hard-hat': info('hide', 0, 4, { coversForehead: true }),
  miner: info('hide', 0, 0, { coversForehead: true }),
  beanie: info('hide', 0, 4, { coversForehead: true }),
  propeller: info('hide', 0, 4, { coversForehead: true }),
  toque: info('hide', 0, 4, { coversForehead: true }),
  party: info('poke', 0, 8, { hides: TALL_HAIR }),
}

/**
 * Whether a front hair shows under `hat`, by its HAT_INFO: the rule for resolve's frontHair, so the
 * busyness cap counts only hair that's drawn. Bare heads count as 'poke', so every front hair shows.
 * Under a hat, only spikes and a fringe show round the tiny top hat and the party hat, spikes and a
 * mohawk's plume round the crown, and spikes, a topknot or a mohawk through the bandana.
 */
export function hairShows(hat: HatName, hair: HairName): boolean {
  const { hair: rule, hides } = HAT_INFO[hat]
  return rule === 'poke' && !hides.includes(hair)
}

// Fills -----------------------------------------------------------------------------------------

/** Saturation under which a colour reads as grey, its hue just noise. */
const GREY = 15
/** Saturation under which skin is dull enough for a grey hat to melt into (ash, slate). */
const DULL = 25
/** Hues closer than this are one family: a dull olive felt and vivid grunt green both read green. */
const HUE_FAMILY = 60

/**
 * Whether a hat fill melts into the skin under it at 48 px, so the hat reads as a taller skull:
 * close in tone (palette's `clashes`) and in hue as well. A soot or grey felt that close in tone
 * still reads as cloth on green skin, so a grey melts only into skin nearly as grey.
 */
function melts(colour: string, skin: string): boolean {
  if (!clashes(colour, skin)) return false
  const [h1, s1] = toHsl(colour)
  const [h2, s2] = toHsl(skin)
  if (Math.min(s1, s2) < GREY) return Math.max(s1, s2) < DULL
  const gap = Math.abs(h1 - h2) % 360
  return Math.min(gap, 360 - gap) < HUE_FAMILY
}

/**
 * The drawn entry of a colour list, or the next one along that `fits`. Only the drawn index is
 * used, so no draws change. If none fits, the drawn one stays.
 */
function nextFitting(list: readonly string[], drawn: number, fits: (colour: string) => boolean): string {
  for (let step = 0; step < list.length; step++) {
    const colour = at(list, drawn + step)
    if (fits(colour)) return colour
  }
  return at(list, drawn)
}

/**
 * A hat's fill: its colour list's drawn entry, or the next that doesn't melt into the skin (loden
 * steps to grey on grunt green, a brown top hat to plum on rust; tweed on ash, all melting, stays).
 */
function hatFill(list: readonly string[], drawn: number, skin: string): string {
  return nextFitting(list, drawn, colour => !melts(colour, skin))
}

/**
 * How far a hat perched on top of the skull (the crown, the tiny top hat, the party hat) rises to
 * clear pushed-up goggles. Their rims reach up to B − 13.2 (eyewear.ts: lenses 4.3 tall at B − 7.5,
 * in a 2.8 rim), and the brows cover their lower half, so a hat coming down over the top half left
 * two strap tabs, or cut a lens flat. `bottom` is the hat's lowest edge over them, outline included.
 */
function goggleLift({ a, look }: Ctx, bottom: number): number {
  return look.eyewear === 'brow-goggles' ? Math.max(0, bottom - (a.B - 13.2)) : 0
}

// Shapes ----------------------------------------------------------------------------------------

/**
 * A dome from (50 − w, base) up to `top` and back down to (50 + w, base), its bottom edge sagging
 * by `sag` at the front. `round` 0.55 is elliptical; higher is boxier, lower is pointier.
 */
function dome(w: number, base: number, top: number, round = 0.55, sag = 0): string {
  const h = base - top
  return (
    d`M${50 - w} ${base} C${50 - w} ${base - h * round} ${50 - w * round} ${top} 50 ${top} ` +
    d`C${50 + w * round} ${top} ${50 + w} ${base - h * round} ${50 + w} ${base} Q50 ${base + 2 * sag} ${50 - w} ${base} Z`
  )
}

/**
 * A closed band from (xl, yl) to (xr, yr): its upper edge passes through y `top` at the middle and
 * its lower edge through `bottom`. Brims, bands, visors.
 */
function lens(xl: number, yl: number, xr: number, yr: number, top: number, bottom: number): string {
  const xm = (xl + xr) / 2
  const ym = (yl + yr) / 2
  return d`M${xl} ${yl} Q${xm} ${2 * top - ym} ${xr} ${yr} Q${xm} ${2 * bottom - ym} ${xl} ${yl} Z`
}

/** A strip across the hat between two smile-curves, from x 50 − w to 50 + w: hat bands, cuffs. */
function strip(w: number, top: number, bottom: number, curve = 1): string {
  return d`M${50 - w} ${top} Q50 ${top + 2 * curve} ${50 + w} ${top} L${50 + w} ${bottom} Q50 ${bottom + 2 * curve} ${50 - w} ${bottom} Z`
}

/**
 * Overlapping parts drawn as one shape (a cloud, a pompom): every outline first, at twice the
 * width so its outer half shows, then every fill over the seams between them.
 */
function blob(parts: readonly ((paint: Paint) => string)[], fill: string, sw: number = W.silhouette): string {
  return parts.map(part => part({ fill, sw: sw * 2 })).join('') + parts.map(part => part({ fill, stroke: 'none' })).join('')
}

const disc = (cx: number, cy: number, r: number) => (paint: Paint) => circle(cx, cy, r, paint)

/** A fluffy pompom: five lobes round a centre. */
function pompom(cx: number, cy: number, r: number, fill: string): string {
  const lobes = [0, 1, 2, 3, 4].map(i => {
    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2
    return disc(cx + Math.cos(angle) * r * 0.45, cy + Math.sin(angle) * r * 0.45, r * 0.62)
  })
  return blob([...lobes, disc(cx, cy, r * 0.6)], fill, W.feature) + circle(cx + r * 0.3, cy - r * 0.3, r * 0.22, { fill: shade(fill, 18), stroke: 'none' })
}

/**
 * The shaded flank on side −1 of a dome `w` half-wide: from its foot at y `foot` up round to near
 * the `top`. Flat, no outline, a darker tone of the hat.
 */
function domeShade(w: number, foot: number, top: number, colour: string): string {
  return flat(
    d`M${50 - w + 1.8} ${foot} C${50 - w + 1.8} ${top + 9} ${50 - w * 0.5} ${top + 2.5} ${50 - w * 0.3} ${top + 2} ` +
      d`C${50 - w * 0.55} ${top + 6} ${50 - w + 6} ${top + 12} ${50 - w + 5.5} ${foot} Z`,
    colour,
  )
}

/** The same flank on a straight-sided shell (helmets, the skull, the bandana): down to `foot`. */
function shellShade(w: number, foot: number, shoulder: number, top: number, colour: string): string {
  return flat(
    d`M${50 - w + 1.8} ${foot} L${50 - w + 1.8} ${shoulder} C${50 - w + 1.8} ${top + 6} ${50 - w * 0.5} ${top + 2} ${50 - w * 0.25} ${top + 1.8} ` +
      d`C${50 - w * 0.6} ${top + 7} ${50 - w + 6} ${top + 12} ${50 - w + 5.5} ${foot - 0.5} Z`,
    colour,
  )
}

/** The sheen arc down a dome's side +1, from near the top (`from` out from the middle) to `end`. */
function domeSheen(w: number, top: number, end: number, colour: string, from = w * 0.3): string {
  return sheen(d`M${50 + from} ${top + 2.6} C${50 + w * 0.7} ${top + 3.5} ${50 + w - 2.5} ${top + 8} ${50 + w - 2.6} ${end}`, colour, 2.4)
}

/** A soft light stroke with no outline: the sheen on a hat's side +1. */
function sheen(data: string, colour: string, w = 2.2): string {
  return path(data, { fill: 'none', stroke: colour, sw: w })
}

/** The lighter tone for a hat's sheen; on the dark hats it's what still reads on a dark terminal. */
function lightOf(colour: string): string {
  return shade(colour, 18)
}

/** A thin glint or rivet with no outline. */
const dot = (cx: number, cy: number, r: number, fill: string) => circle(cx, cy, r, { fill, stroke: 'none' })

const GOLD = METAL_HEX.gold

// Gentleman hats ---------------------------------------------------------------------------------

/**
 * Soot, slate, brown, plum and burgundy: dark, but at lightness 30+ so the crown still shows on a
 * dark terminal, and each carries a light band and sheen. No green: a green top hat with a gold
 * band on a green orc was a leprechaun.
 */
const TOP_HAT = ['#5b5049', '#464e5e', '#6d4836', '#663d62', '#742f3f'] as const
/** Band colours that stand out on every dark top hat. */
const TOP_BAND = ['#c23b33', '#e0b23c', '#efe2c4', '#2f9b98', '#8a5cc8', '#5d86e0'] as const

/**
 * A top hat's crown: a cylinder with a slight waist, `wb` half-wide at its base and `wt` at the
 * top, plus its band, sheen and top rim. Shared with the tiny top hat.
 */
function stovepipe(cx: number, base: number, top: number, wb: number, wt: number, colour: string, bandColour: string): string {
  const mid = (base + top) / 2
  const pinch = Math.min(2.5, wb * 0.12)
  // The side's x at a share t of the way up (the sides are quadratic, linear in y).
  const side = (s: 1 | -1, t: number) => cx + s * ((1 - t) ** 2 * wb + 2 * t * (1 - t) * (wb - pinch) + t * t * wt)
  const y = (t: number) => base + (top - base) * t
  const body =
    d`M${side(-1, 0)} ${base} Q${cx - wb + pinch} ${mid} ${side(-1, 1)} ${top} Q${cx} ${top - 1.6} ${side(1, 1)} ${top} ` +
    d`Q${cx + wb - pinch} ${mid} ${side(1, 0)} ${base} Z`
  // The band: from the base to about 6.5 units above it (the brim covers its foot).
  const t1 = Math.min(0.4, 6.5 / (base - top))
  const bandPath =
    d`M${side(-1, t1)} ${y(t1)} Q${cx} ${y(t1) + 1} ${side(1, t1)} ${y(t1)} L${side(1, 0)} ${base} ` +
    d`Q${cx} ${base + 1} ${side(-1, 0)} ${base} Z`
  // Depth: a darker flank on side −1; sheen on side +1; a light rim under the top edge.
  const flank = d`M${side(-1, 0.05)} ${y(0.05)} Q${cx - wb + pinch} ${mid} ${side(-1, 0.97)} ${y(0.97)} L${side(-1, 0.97) + wt * 0.3} ${y(0.97)} Q${cx - wb * 0.7} ${mid} ${side(-1, 0.05) + wb * 0.3} ${y(0.05)} Z`
  const shine = d`M${side(1, 0.9) - wt * 0.3} ${y(0.9)} Q${cx + (wb - pinch) * 0.72} ${mid} ${side(1, t1 + 0.08) - wb * 0.3} ${y(t1 + 0.08)}`
  const rim = d`M${side(-1, 1) + 1.5} ${top + 1.2} Q${cx} ${top - 0.6} ${side(1, 1) - 1.5} ${top + 1.2}`
  return (
    shape(body, colour, W.silhouette) +
    flat(flank, shade(colour, -8)) +
    sheen(shine, lightOf(colour), Math.max(1.6, wb * 0.12)) +
    // At 2 or more the rim still marks the crown's top edge where the outline meets a dark terminal.
    sheen(rim, lightOf(colour), 2) +
    shape(bandPath, bandColour, W.detail)
  )
}

/** The top hat: tall, a little flared, on a brim that curls up at both ends. */
function topHat({ a, look, p }: Ctx): string {
  const colour = hatFill(TOP_HAT, look.hatColour, p.skin)
  const brimY = a.SEAT + 2.5
  const top = Math.max(6.5, brimY - 27)
  const bw = a.SW + 7
  const brim = lens(50 - bw, brimY - 2.5, 50 + bw, brimY - 2.5, brimY - 1.5, brimY + 3)
  return (
    stovepipe(50, brimY, top, a.SW - 2.5, a.SW - 1, colour, at(TOP_BAND, look.hatAccent)) +
    shape(brim, colour, W.silhouette) +
    sheen(d`M${50 - bw + 5} ${brimY - 1.6} Q50 ${brimY + 0.4} ${50 + bw - 5} ${brimY - 1.6}`, lightOf(colour), 1.6)
  )
}

/**
 * The tiny top hat, perched off-centre on side +1 and cocked outward. Spikes or a fringe show round
 * it; a tuft, topknot or mohawk would stand right under it, so they hide (TALL_HAIR). It rides
 * higher over pushed-up goggles, whose side +1 lens is right under its brim.
 */
function tinyTopHat(ctx: Ctx): string {
  const { a, look, p } = ctx
  const colour = hatFill(TOP_HAT, look.hatColour, p.skin)
  // It sits on the skull's shoulder, 0.42 SW out, where the crown curve is ~1.5 below C. Cocked,
  // the brim's lowest point, outline included, is 4.8 below `base`. Lifted, the hat's top (outline
  // included) is at B − 33.75, well clear of y 2.
  const cx = 50 + a.SW * 0.42
  const base = a.C + 2.5 - goggleLift(ctx, a.C + 2.5 + 4.8)
  const top = base - 12.5
  const brim = lens(cx - 10.5, base - 1.4, cx + 10.5, base - 1.4, base - 1, base + 2.6)
  const body =
    stovepipe(cx, base, top, 6.2, 7.2, colour, at(TOP_BAND, look.hatAccent)) +
    shape(brim, colour, W.silhouette) +
    sheen(d`M${cx - 6} ${base - 0.3} Q${cx} ${base + 1} ${cx + 6} ${base - 0.3}`, lightOf(colour), 1.4)
  return g(body, { transform: `rotate(16 ${n(cx)} ${n(base)})` })
}

/** Soot, brown, grey and tan bowlers, all at lightness 30+. */
const BOWLER = ['#5b5049', '#734a30', '#4a4d55', '#7a6142'] as const

/** The bowler: a round dome on a short brim rolled up at the ends. */
function bowler({ a, look, p }: Ctx): string {
  const colour = hatFill(BOWLER, look.hatColour, p.skin)
  const w = a.SW + 1
  const base = a.SEAT + 3
  const top = a.C - 7
  const bw = w + 5
  return (
    shape(dome(w, base, top, 0.62), colour, W.silhouette) +
    domeShade(w, base - 1, top, shade(colour, -8)) +
    domeSheen(w, top, base - 7, lightOf(colour)) +
    shape(strip(w, base - 5, base - 1, 0.6), at(TOP_BAND, look.hatAccent), W.detail) +
    shape(lens(50 - bw, base - 3.5, 50 + bw, base - 3.5, base - 1.2, base + 2.8), colour, W.silhouette) +
    sheen(d`M${50 - bw + 4} ${base - 2.3} Q50 ${base + 0.6} ${50 + bw - 4} ${base - 2.3}`, lightOf(colour), 1.4)
  )
}

/** Pale gold, golden and wheat straw. */
const STRAW = ['#ecd08a', '#e2bd62', '#f0dfa8', '#d9ae55'] as const
/** Boater ribbons: navy, red, black-green, burgundy. */
const RIBBON = ['#2b3a66', '#b8322e', '#24443a', '#6e2436', '#2f9b98'] as const

/** The boater: a short flat-topped straw crown with a ribbon, on a wide flat brim. */
function boater({ a, look, p }: Ctx): string {
  const straw = hatFill(STRAW, look.hatColour, p.skin)
  const w = a.SW - 1
  const base = Math.min(a.SEAT + 1.5, a.B - 9.5)
  const top = base - 11
  const bw = a.SW + 11
  const crown =
    d`M${50 - w} ${base} L${50 - w + 0.6} ${top + 1.2} Q${50 - w + 0.8} ${top} ${50 - w + 2.5} ${top} L${50 + w - 2.5} ${top} ` +
    d`Q${50 + w - 0.8} ${top} ${50 + w - 0.6} ${top + 1.2} L${50 + w} ${base} Z`
  const dark = shade(straw, -14)
  // The brim is a flat disc seen from just above: an ellipse, its back half behind the crown.
  return (
    ellipse(50, base + 0.6, bw, 3.4, { fill: straw, sw: W.silhouette }) +
    path(d`M${50 - bw + 4} ${base + 0.9} C${50 - bw + 6} ${base + 3.6} ${50 + bw - 6} ${base + 3.6} ${50 + bw - 4} ${base + 0.9}`, { fill: 'none', stroke: dark, sw: 1.3 }) +
    shape(crown, straw, W.silhouette) +
    flat(d`M${50 - w + 1.8} ${top + 1.6} L${50 - w + 4.5} ${top + 1.6} L${50 - w + 4.5} ${base - 1} L${50 - w + 1.6} ${base - 1} Z`, dark) +
    sheen(d`M${50 - w + 3} ${top + 2.2} L${50 + w - 3} ${top + 2.2}`, dark, 1.4) +
    shape(d`M${50 - w + 0.3} ${base - 6} L${50 + w - 0.3} ${base - 6} L${50 + w} ${base - 0.2} L${50 - w} ${base - 0.2} Z`, at(RIBBON, look.hatAccent), W.detail)
  )
}

/** Fez reds, and a rarer teal. */
const FEZ = ['#c0302c', '#a8263a', '#cf4a2a', '#8e2232', '#2a7f78'] as const
/** Tassels: black, gold, navy. */
const TASSEL = ['#2e2824', '#e0b23c', '#26345a'] as const

/** The fez: a truncated cone perched on the crown, its tassel dropping down the front on side +1. */
function fez({ a, look, p }: Ctx): string {
  const colour = hatFill(FEZ, look.hatColour, p.skin)
  const base = a.SEAT + 1
  const top = Math.max(5.5, a.C - 8)
  const wb = a.SW - 5
  const wt = a.SW - 10.5
  const body = d`M${50 - wb} ${base} L${50 - wt} ${top} Q50 ${top - 1.4} ${50 + wt} ${top} L${50 + wb} ${base} Q50 ${base + 2.4} ${50 - wb} ${base} Z`
  const flank = d`M${50 - wb + 1} ${base} L${50 - wt + 0.6} ${top + 1} L${50 - wt + 4} ${top + 1} L${50 - wb + 5} ${base + 1} Z`
  const tassel = at(TASSEL, look.hatAccent)
  // The cord runs from the top's middle across to side +1, then hangs down the front; the tassel
  // flares at its end, always against the fez so even a black one reads on a dark terminal.
  const cx = 50 + wt * 0.75
  const hang = top + (base - top) * 0.42
  const cord = d`M50 ${top - 0.2} Q${cx - 1} ${top - 0.6} ${cx} ${top + 1.8} L${cx} ${hang}`
  const bundle = d`M${cx - 1.4} ${hang - 0.6} L${cx + 1.4} ${hang - 0.6} L${cx + 3} ${hang + 6.5} Q${cx} ${hang + 7.6} ${cx - 3} ${hang + 6.5} Z`
  const strands = d`M${cx - 0.9} ${hang + 1.4} L${cx - 1.5} ${hang + 6} M${cx + 0.9} ${hang + 1.4} L${cx + 1.5} ${hang + 6}`
  return (
    shape(body, colour, W.silhouette) +
    flat(flank, shade(colour, -9)) +
    sheen(d`M${50 + wb - 3} ${base - 1.5} L${50 + wt - 1.8} ${top + 2.5}`, lightOf(colour), 2) +
    outlined(cord, tassel, 1.6) +
    shape(bundle, tassel, W.detail) +
    path(strands, { fill: 'none', stroke: shade(tassel, tassel === TASSEL[0] ? 30 : -22), sw: 1 }) +
    circle(cx, hang - 0.4, 1.6, { fill: tassel, sw: W.detail }) +
    circle(50, top - 0.4, 1.5, { fill: tassel, sw: W.detail })
  )
}

/** Tricorns: soot, navy, brown, burgundy, at lightness 30+. The gold trim is their light edge. */
const TRICORN = ['#59504a', '#35446e', '#734a30', '#762d41'] as const

/** The tricorn: the brim cocked up into three corners, two out to the sides and one to the front. */
function tricorn({ a, look, p }: Ctx): string {
  const colour = hatFill(TRICORN, look.hatColour, p.skin)
  const s = a.SEAT
  const w = a.SW
  const corner = w + 11
  const top = a.C - 6
  const dark = shade(colour, -8)
  // The crown's dome peeks over the dip in the middle of the brim.
  const crown = dome(w - 9, s, top - 1.5, 0.6)
  // Side corners up at s − 6, the front point down at s + 5.5; the brim rises to two humps either
  // side of a dip in the middle.
  const brim =
    d`M${50 - corner} ${s - 6} C${50 - w + 1} ${s - 2} ${50 - 9} ${s + 2} 50 ${s + 5.5} C${50 + 9} ${s + 2} ${50 + w - 1} ${s - 2} ${50 + corner} ${s - 6} ` +
    d`C${50 + w + 2} ${top + 2} ${50 + 15} ${top - 1} ${50 + 9} ${top + 1} Q50 ${top + 6.5} ${50 - 9} ${top + 1} ` +
    d`C${50 - 15} ${top - 1} ${50 - w - 2} ${top + 2} ${50 - corner} ${s - 6} Z`
  // The gold trim follows the top edge, just inside it.
  const trim =
    d`M${50 - corner + 2.5} ${s - 6.6} C${50 - w - 0.5} ${top + 3} ${50 - 15} ${top + 0.6} ${50 - 9} ${top + 2.6} Q50 ${top + 8} ${50 + 9} ${top + 2.6} ` +
    d`C${50 + 15} ${top + 0.6} ${50 + w + 0.5} ${top + 3} ${50 + corner - 2.5} ${s - 6.6}`
  return (
    shape(crown, dark, W.silhouette) +
    shape(brim, colour, W.silhouette) +
    flat(d`M${50 - corner + 3} ${s - 5.4} C${50 - w + 3} ${s - 1.8} ${50 - 9} ${s + 1.6} 50 ${s + 4} L50 ${s + 0.5} C${50 - 9} ${s - 1} ${50 - w + 4} ${s - 3.5} ${50 - corner + 3} ${s - 5.4} Z`, dark) +
    outlined(trim, GOLD[0], 1.8) +
    sheen(d`M${50 + 4} ${s + 1.6} C${50 + 9} ${s - 0.8} ${50 + w - 3} ${s - 3.2} ${50 + w + 4} ${s - 5}`, lightOf(colour), 2)
  )
}

/** Gems for the crown: ruby, sapphire, emerald. */
const GEMS = ['#d8323a', '#3b6fe0', '#2fae6a'] as const

/**
 * The crown: small, gold, three bold points with pearls, gems on the band; it perches on the crown,
 * and rides higher over pushed-up goggles. The gaps between its points stay open to the sky: of the
 * front hair, only a mohawk's plume behind it and spikes round it show (UNDER_CROWN).
 */
function crown(ctx: Ctx): string {
  const { a, look } = ctx
  const [gold, light, dark] = GOLD
  const w = a.SW - 7
  // The band's foot sags 0.8 at the front, plus the outline: 2.55 below `base`.
  const lift = goggleLift(ctx, a.C + 6.5 + 2.55)
  const base = a.C + 6.5 - lift
  const bandTop = base - 5.5
  const peak = Math.max(5.5, a.C - 8 - lift)
  const points =
    d`M${50 - w} ${base} L${50 - w - 2} ${peak + 2.5} L${50 - w * 0.42} ${bandTop - 1.5} L50 ${peak} L${50 + w * 0.42} ${bandTop - 1.5} ` +
    d`L${50 + w + 2} ${peak + 2.5} L${50 + w} ${base} Q50 ${base + 1.6} ${50 - w} ${base} Z`
  const gem = at(GEMS, look.hatAccent)
  const side = at(GEMS, look.hatAccent + 1)
  return (
    shape(points, gold, W.silhouette) +
    flat(d`M${50 - w + 1} ${bandTop} L${50 - w - 0.4} ${peak + 4.5} L${50 - w * 0.55} ${bandTop - 0.8} Z`, dark) +
    flat(d`M${50 - 1} ${bandTop - 1} L${50 - 0.6} ${peak + 3} L${50 - w * 0.3} ${bandTop - 1} Z`, dark) +
    shape(strip(w + 0.4, bandTop, base, 0.8), gold, W.feature) +
    sheen(d`M${50 - w + 2.5} ${bandTop + 1.4} Q50 ${bandTop + 2.6} ${50 + w - 2.5} ${bandTop + 1.4}`, light, 1.2) +
    ellipse(50, bandTop + 3, 2.4, 2, { fill: gem, sw: 1.4 }) +
    circle(50 - w * 0.62, bandTop + 2.8, 1.5, { fill: side, sw: 1.3 }) +
    circle(50 + w * 0.62, bandTop + 2.8, 1.5, { fill: side, sw: 1.3 }) +
    dot(50 - 0.7, bandTop + 2.4, 0.6, '#ffffff') +
    circle(50, peak - 0.8, 1.9, { fill: light, sw: W.detail }) +
    circle(50 - w - 2, peak + 1.6, 1.7, { fill: light, sw: W.detail }) +
    circle(50 + w + 2, peak + 1.6, 1.7, { fill: light, sw: W.detail })
  )
}

/** Khaki, cream, sand and olive pith helmets. */
const PITH = ['#ded0a2', '#efe9d8', '#cdb782', '#9a9a68'] as const

/** The pith helmet: a tall dome, a narrow band, a top button, a brim sloping down all round. */
function pith({ a, look, p }: Ctx): string {
  const colour = hatFill(PITH, look.hatColour, p.skin)
  const w = a.SW + 1
  const base = a.SEAT + 2
  const top = Math.max(6, a.C - 9)
  const bw = a.SW + 10
  const tip = base + 3.5
  const front = Math.min(base + 2.5, a.B - 5.5)
  // The brim leaves the dome at its foot and droops to the tips; its front edge stays over the brow.
  const brim =
    d`M${50 - bw} ${tip} C${50 - bw + 3} ${base - 1} ${50 - w} ${base - 2.5} ${50 - w + 3} ${base - 2.5} L${50 + w - 3} ${base - 2.5} ` +
    d`C${50 + w} ${base - 2.5} ${50 + bw - 3} ${base - 1} ${50 + bw} ${tip} C${50 + bw - 6} ${tip + 1} ${50 + 10} ${front} 50 ${front} ` +
    d`C${50 - 10} ${front} ${50 - bw + 6} ${tip + 1} ${50 - bw} ${tip} Z`
  const dark = shade(colour, -12)
  return (
    shape(dome(w, base, top, 0.6), colour, W.silhouette) +
    domeShade(w, base - 4, top, dark) +
    domeSheen(w, top, base - 8, shade(colour, 10)) +
    shape(strip(w - 0.2, base - 6.5, base - 2.5, 0.7), dark, W.detail) +
    shape(brim, colour, W.silhouette) +
    path(d`M${50 - bw + 3} ${tip - 0.4} C${50 - bw + 8} ${tip} ${50 - 10} ${front - 1.6} 50 ${front - 1.6} C${50 + 10} ${front - 1.6} ${50 + bw - 8} ${tip} ${50 + bw - 3} ${tip - 0.4}`, { fill: 'none', stroke: dark, sw: 1.4 }) +
    ellipse(50, top + 0.2, 3.4, 2, { fill: colour, sw: W.detail })
  )
}

/** Tweeds: brown, grey, moss and slate. */
const TWEED = ['#7a6450', '#6c6a66', '#6b7350', '#56606e'] as const

/** The flat cap: a low puffed top pulled forward over a short peak, the puff to side +1. */
function flatCap({ a, look, p }: Ctx): string {
  const colour = hatFill(TWEED, look.hatColour, p.skin)
  const s = a.SEAT
  const w = a.SW + 2.5
  const top = a.C - 3
  // The puff overhangs side +1: its top is highest and widest there.
  const body =
    d`M${50 - w} ${s + 3} C${50 - w - 1} ${s - 3} ${50 - w + 3} ${top + 1.5} ${50 - 4} ${top + 1} ` +
    d`C${50 + 7} ${top - 0.6} ${50 + w + 2} ${top} ${50 + w + 2} ${s - 1.5} L${50 + w} ${s + 3} Q50 ${s + 5} ${50 - w} ${s + 3} Z`
  const peak = lens(50 - w + 4, s + 3, 50 + w - 4, s + 3, s + 4.6, Math.min(s + 7.5, a.B - 4.5))
  const dark = shade(colour, -12)
  return (
    shape(body, colour, W.silhouette) +
    flat(d`M${50 - w + 1.5} ${s + 2.5} C${50 - w + 1} ${s - 3} ${50 - w + 4} ${top + 3} ${50 - 6} ${top + 2.5} C${50 - w + 8} ${top + 6.5} ${50 - w + 5} ${s - 2} ${50 - w + 5.5} ${s + 3.5} Z`, dark) +
    // The seam where the top panel is stitched over the peak.
    path(d`M${50 - w + 2} ${s + 1.2} Q50 ${s + 3.4} ${50 + w - 1} ${s + 0.6}`, { fill: 'none', stroke: dark, sw: 1.6 }) +
    sheen(d`M${50 + 6} ${top + 2.2} C${50 + w - 4} ${top + 2.4} ${50 + w - 1} ${top + 6} ${50 + w - 1} ${s - 2}`, shade(colour, 14), 2) +
    shape(peak, dark, W.silhouette) +
    sheen(d`M${50 - w + 8} ${s + 4.6} Q50 ${s + 6.2} ${50 + w - 8} ${s + 4.6}`, colour, 1.4) +
    circle(50 + 2, top + 1.1, 1.5, { fill: dark, sw: W.detail })
  )
}

/** Captain's caps: white, navy or cream tops (the band and peak are always dark). */
const CAPTAIN = ['#f1efe8', '#2d3a5e', '#efe6cf'] as const
/**
 * The navy top, a peon's only: on a stern grunt in pauldrons a navy peaked cap read as a police or
 * officer's cap, not a ship's captain. A grunt who draws it gets the cream.
 */
const NAVY = CAPTAIN[1]

/**
 * The cap badge: a gold anchor standing on the band's top edge, its ring and stock on the crown and
 * its arms curling up over the band, its foot clear of the gold cord. A gold disc there made an
 * officer's cap.
 */
function anchorBadge(foot: number, gold: string): string {
  const ring = foot - 7.4
  const stock = foot - 5
  const arms = foot - 2.8
  const lines =
    d`M50 ${ring} L50 ${foot} M${50 - 2.6} ${stock} L${50 + 2.6} ${stock} ` +
    d`M${50 - 4} ${arms} Q${50 - 3.4} ${foot} 50 ${foot} Q${50 + 3.4} ${foot} ${50 + 4} ${arms}`
  return outlined(lines, gold, 1.4) + circle(50, ring, 1.5, { fill: gold, sw: W.detail })
}

/** The captain's cap: a flat top flaring over a dark band, a glossy black peak, a gold anchor. */
function captain({ a, look, p }: Ctx): string {
  const colour = nextFitting(CAPTAIN, look.hatColour, top => !melts(top, p.skin) && (look.build === 'peon' || top !== NAVY))
  const s = a.SEAT
  const w = a.SW
  const flare = w + 4.5
  const top = a.C - 4
  const bandTop = s - 2
  const bandBottom = s + 3.5
  const crown =
    d`M${50 - w + 0.5} ${bandTop + 1} C${50 - w - 3} ${bandTop} ${50 - flare - 1} ${bandTop - 3} ${50 - flare} ${bandTop - 5} ` +
    d`C${50 - flare + 1} ${top + 1} ${50 - w * 0.5} ${top} 50 ${top} C${50 + w * 0.5} ${top} ${50 + flare - 1} ${top + 1} ${50 + flare} ${bandTop - 5} ` +
    d`C${50 + flare + 1} ${bandTop - 3} ${50 + w + 3} ${bandTop} ${50 + w - 0.5} ${bandTop + 1} Z`
  const band = '#232a3d'
  const peakBottom = Math.min(s + 8, a.B - 4.5)
  const peak = lens(50 - w + 2.5, bandBottom - 0.5, 50 + w - 2.5, bandBottom - 0.5, bandBottom + 0.6, peakBottom)
  const [gold] = GOLD
  return (
    shape(crown, colour, W.silhouette) +
    flat(d`M${50 - flare + 1.5} ${bandTop - 4.6} C${50 - flare + 2} ${top + 2} ${50 - w * 0.6} ${top + 1.2} ${50 - w * 0.3} ${top + 1} C${50 - w * 0.65} ${top + 3} ${50 - flare + 5} ${top + 4} ${50 - flare + 5} ${bandTop - 3.8} Z`, shade(colour, -10)) +
    sheen(d`M${50 + w * 0.25} ${top + 1.6} C${50 + w * 0.6} ${top + 1.8} ${50 + flare - 2.5} ${top + 3} ${50 + flare - 2.4} ${bandTop - 4.6}`, lightOf(colour), 1.8) +
    shape(strip(w, bandTop, bandBottom, 0.6), band, W.silhouette) +
    shape(peak, '#26221f', W.silhouette) +
    sheen(d`M${50 - w + 6} ${bandBottom + 1.6} Q50 ${bandBottom + 3.4} ${50 + w - 6} ${bandBottom + 1.6}`, '#6a6560', 1.6) +
    outlined(d`M${50 - w + 3} ${bandBottom - 0.3} Q50 ${bandBottom + 1.3} ${50 + w - 3} ${bandBottom - 0.3}`, gold, 1.4) +
    anchorBadge(bandBottom - 1.8, gold)
  )
}

// Helmets --------------------------------------------------------------------------------------

/**
 * The horned helm's metals: iron, bronze, blackened iron, brass and copper. Only one is the grey
 * of the iron pauldrons, so a grunt in both isn't grey from crown to shoulders, and horned grunts
 * differ by metal. Blackened iron (lightness 33) keeps its light sheen and rivets on a dark terminal.
 */
const HORNED_HELM = ['#7f868e', '#a8783a', '#4f555c', '#b8963c', '#a0603a'] as const
/**
 * The spiked helm's crude irons: blackened, blued and rusted, three colours apart at 48 px (a dark
 * iron was blackened's twin, so two helms in three were one grey) and none the grey of the iron
 * pauldrons. No brass: a brass-banded dome under a spike is a Pickelhaube. The blued steel is
 * blue enough (saturation 28) for `hatFill` to step to on grey ash or slate skin, which blackened
 * iron melts into; the rust steps on to blackened over rust or olive skin.
 */
const SPIKED_HELM = ['#4f555c', '#4a5a84', '#7a4632'] as const

/**
 * A helmet over the whole skull: down the sides to B−3, its front rim up at SEAT+4.5 over the
 * forehead, its dome from `tones`. Returns the shell, the rim band with rivets, and the trim metal
 * and its light tone. The trim is the orc's metal; an iron one is a darker shade of the shell, so
 * it still shows. `steel` trims dark iron in a lighter shade of itself instead: a bright frame that
 * holds the dome's shape on a dark terminal.
 */
function helmet(
  ctx: Ctx,
  top: number,
  tones: readonly string[],
  steel = false,
): { shell: string; rim: string; socket: string; light: string; tone: string; hw: number } {
  const { a, look, p } = ctx
  const iron = look.metal === 'iron'
  const tone = hatFill(tones, look.hatColour, p.skin)
  const hw = a.SW + 2.5
  const low = a.B - 3
  const front = a.SEAT + 4.5
  const edge = d`C${50 + hw - 4} ${low} ${50 + hw * 0.55} ${front} 50 ${front} C${50 - hw * 0.55} ${front} ${50 - hw + 4} ${low} ${50 - hw} ${low}`
  const outline =
    d`M${50 - hw} ${low} L${50 - hw} ${a.SEAT - 1} C${50 - hw} ${top + 4} ${50 - hw * 0.6} ${top} 50 ${top} ` +
    d`C${50 + hw * 0.6} ${top} ${50 + hw} ${top + 4} ${50 + hw} ${a.SEAT - 1} L${50 + hw} ${low} ` +
    edge +
    ' Z'
  const rimTop = front - 4.5
  const rimPath =
    d`M${50 - hw} ${low - 4.5} C${50 - hw + 4} ${low - 4.5} ${50 - hw * 0.55} ${rimTop} 50 ${rimTop} C${50 + hw * 0.55} ${rimTop} ${50 + hw - 4} ${low - 4.5} ${50 + hw} ${low - 4.5} ` +
    d`L${50 + hw} ${low} ` +
    edge +
    ' Z'
  const metal = steel ? shade(tone, 12) : iron ? shade(tone, -14) : p.metal
  const light = steel ? shade(tone, 34) : iron ? shade(tone, 22) : p.metalLight
  const shell =
    shape(outline, tone, W.silhouette) +
    shellShade(hw, low - 4, a.SEAT - 1, top, shade(tone, -12)) +
    sheen(d`M${50 + hw * 0.25} ${top + 2.4} C${50 + hw * 0.65} ${top + 3} ${50 + hw - 2.6} ${top + 7} ${50 + hw - 2.6} ${a.SEAT}`, shade(tone, 26), 2.4)
  // Rivets along the rim: tiny light dots, no outline.
  const rivets = [-0.78, -0.42, 0, 0.42, 0.78]
    .map(t => {
      const x = 50 + t * hw
      const yTop = rimTop + (low - 4.5 - rimTop) * t * t * 0.95
      return dot(x, yTop + 2.4, 0.95, light)
    })
    .join('')
  return { shell, rim: shape(rimPath, metal, W.feature) + rivets, socket: metal, light, tone, hw }
}

/**
 * The y of a helmet's top outline (as `helmet` draws it, `hw` half-wide) at x offset `dx` from the
 * middle: the boxy dome is nearly flat across the top, then turns down at the shoulders.
 */
function shellY(hw: number, top: number, foot: number, dx: number): number {
  // The outline's side +1 cubic, from the middle of the top out and down to the side.
  const pts = [
    [0, top],
    [0.6 * hw, top],
    [hw, top + 4],
    [hw, foot],
  ] as const
  const coord = (t: number, i: 0 | 1) => {
    const u = 1 - t
    return u * u * u * pts[0][i] + 3 * u * u * t * pts[1][i] + 3 * u * t * t * pts[2][i] + t * t * t * pts[3][i]
  }
  for (let i = 1; i <= 40; i++) {
    if (coord(i / 40, 0) >= Math.abs(dx)) return coord(i / 40, 1)
  }
  return foot
}

/**
 * A short iron spike from its base (x, y), leaning `angle` degrees from upright (+ toward side
 * +1), `len` long and `hw` half-wide at the root, its sides bowed a little. The root is buried in
 * the helmet, which is drawn over it. The flank on side −1 is in shade.
 */
function ironSpike(x: number, y: number, angle: number, len: number, hw: number, colour: string): string {
  const r = (angle * Math.PI) / 180
  const [ux, uy] = [Math.sin(r), -Math.cos(r)]
  const pt = (along: number, across: number): [number, number] => [x + ux * along - uy * across, y + uy * along + ux * across]
  const [tx, ty] = pt(len, 0)
  const [lx, ly] = pt(0, -hw)
  const [rx, ry] = pt(0, hw)
  const [lcx, lcy] = pt(len * 0.5, -hw * 0.62)
  const [rcx, rcy] = pt(len * 0.5, hw * 0.62)
  const [mx, my] = pt(len * 0.12, -hw * 0.1)
  return (
    shape(d`M${lx} ${ly} Q${lcx} ${lcy} ${tx} ${ty} Q${rcx} ${rcy} ${rx} ${ry} Z`, colour, W.feature) +
    flat(d`M${lx} ${ly} Q${lcx} ${lcy} ${tx} ${ty} L${mx} ${my} Z`, shade(colour, -16))
  )
}

/**
 * A mohawk worn as the helmet's crest: the hair module's five-spike fan, rising from a metal
 * socket on the helmet's top (y `top`) and squashed on a tall skull so its outline stays below
 * y 2. The hair module leaves the crest to the hat (look.crest).
 */
function crest(ctx: Ctx, top: number, socket: string): string {
  const { p } = ctx
  const foot = top + 3.5
  const k = Math.min(1.15, (top - 3.8) / 14)
  const up = (dy: number) => top + dy * k
  const x = (dx: number) => 50 + dx
  const fan = [
    d`M50 ${foot}`,
    d`Q${x(-5.5)} ${foot - 0.5} ${x(-6.5)} ${top + 1.5}`,
    d`Q${x(-11)} ${top + 1} ${x(-16)} ${up(-4.5)}`,
    d`Q${x(-11)} ${up(-3.5)} ${x(-8.5)} ${up(-2.5)}`,
    d`Q${x(-12.5)} ${up(-6)} ${x(-12)} ${up(-10.5)}`,
    d`Q${x(-7.5)} ${up(-8)} ${x(-4.5)} ${up(-6)}`,
    d`Q${x(-4)} ${up(-10.5)} 50 ${up(-14)}`,
    d`Q${x(4)} ${up(-10.5)} ${x(4.5)} ${up(-6)}`,
    d`Q${x(7.5)} ${up(-8)} ${x(12)} ${up(-10.5)}`,
    d`Q${x(12.5)} ${up(-6)} ${x(8.5)} ${up(-2.5)}`,
    d`Q${x(11)} ${up(-3.5)} ${x(16)} ${up(-4.5)}`,
    d`Q${x(11)} ${top + 1} ${x(6.5)} ${top + 1.5}`,
    d`Q${x(5.5)} ${foot - 0.5} 50 ${foot} Z`,
  ].join(' ')
  // The same light streaks as the hair module's mohawk, which keep black hair visible on dark.
  const light = mix(p.hair, '#ffffff', 0.34)
  const streaks =
    d`M${x(-1.5)} ${top + 1} Q${x(-2)} ${up(-5)} ${x(-0.5)} ${up(-10.5)} ` +
    d`M${x(-5)} ${top} Q${x(-8)} ${up(-3)} ${x(-10.5)} ${up(-8)}`
  return (
    shape(fan, p.hair, W.silhouette) +
    path(streaks, { fill: 'none', stroke: light, sw: W.detail }) +
    shape(strip(6.5, top - 0.2, top + 3.6, 0.6), socket, W.feature)
  )
}

/** A horn for side `s`, sweeping out and up from the helmet's side; ridged near the base. */
function horn(ctx: Ctx, s: 1 | -1): string {
  const { a, p } = ctx
  const x = (dist: number) => 50 + s * dist
  const w = a.SW
  const by = a.SEAT
  const tipX = Math.min(w + 20, 45)
  const tipY = Math.max(5, a.C - 9)
  // Thick at the root (by − 8 .. by + 4), curling up to a point.
  const outline =
    d`M${x(w - 3)} ${by + 4} C${x(w + 13)} ${by + 5} ${x(tipX + 1.5)} ${by - 2} ${x(tipX)} ${tipY} ` +
    d`C${x(tipX - 3.5)} ${by - 9} ${x(w + 6)} ${by - 9} ${x(w - 3)} ${by - 8} Z`
  const tipShade =
    d`M${x(tipX)} ${tipY} C${x(tipX - 1.2)} ${tipY + 4} ${x(tipX - 2.6)} ${tipY + 7} ${x(tipX - 3.8)} ${tipY + 8.5} ` +
    d`L${x(tipX + 1)} ${tipY + 9} C${x(tipX + 0.8)} ${tipY + 6} ${x(tipX + 0.4)} ${tipY + 3} ${x(tipX)} ${tipY} Z`
  const ridges = [0, 1]
    .map(i => {
      const rx = w + 4.5 + i * 4.5
      return d`M${x(rx)} ${by - 8.4 + i * 1.2} Q${x(rx + 2)} ${by - 2} ${x(rx + 0.6)} ${by + 4.4 - i * 1.4}`
    })
    .join(' ')
  return (
    shape(outline, p.tusk, W.silhouette) +
    flat(tipShade, p.tuskShade) +
    path(ridges, { fill: 'none', stroke: p.tuskShade, sw: 1.6 })
  )
}

/** The horned helm: a metal helm with two big horns. A mohawk rises from it as a crest. */
function hornedHelm(ctx: Ctx): string {
  const { a, look } = ctx
  // Under a crest the helm sits a little lower, to give the fan room.
  const top = a.C - (look.crest ? 2.5 : 4.5)
  const { shell, rim, socket } = helmet(ctx, top, HORNED_HELM)
  return horn(ctx, 1) + horn(ctx, -1) + shell + rim + (look.crest ? crest(ctx, top, socket) : '')
}

/**
 * The spiked helm: a crude dark-iron orc helm, trimmed in its own iron. A riveted strap runs up the
 * front to a row of three short spikes, and a nasal guard drops from the rim between the brows.
 * One tall spike on a smooth banded dome was a Pickelhaube. A mohawk crest takes the spikes' place:
 * spikes through the fan made a grey clump.
 */
function spikedHelm(ctx: Ctx): string {
  const { a, look } = ctx
  const top = a.C - (look.crest ? 2.5 : 4.5)
  const { shell, rim, socket, light, tone, hw } = helmet(ctx, top, SPIKED_HELM, true)
  const front = a.SEAT + 4.5
  const rimTop = front - 4.5
  // Bright steel, so the spikes and the nasal stand off the dark dome and a dark terminal.
  const steel = shade(tone, 30)
  // The spikes: one upright in the middle, one either side leaning out, their roots sunk 2 into
  // the dome. The middle tip stays at y ≥ 4, its outline above y 2.
  const sx = hw * 0.5
  const sy = shellY(hw, top, a.SEAT - 1, sx) + 2
  const spikes =
    ironSpike(50, top + 2, 0, Math.min(13, top - 2), 4, steel) +
    ironSpike(50 + sx, sy, 30, 12, 3.8, steel) +
    ironSpike(50 - sx, sy, -30, 12, 3.8, steel)
  // The strap up the front, under the spikes' middle root, with two rivets.
  const strap =
    shape(d`M${50 - 2.6} ${top + 0.6} L${50 + 2.6} ${top + 0.6} L${50 + 2.6} ${rimTop + 1} L${50 - 2.6} ${rimTop + 1} Z`, socket, W.detail) +
    [1 / 3, 2 / 3].map(t => dot(50, top + 0.6 + (rimTop - top) * t, 0.95, light)).join('')
  // The nasal guard: from the rim's top down the middle of the forehead, stopping at B−4.5 so its
  // outline clears B−3 (and the brows under it).
  const tip = a.B - 4.5
  const nasal =
    shape(d`M${50 - 2.8} ${rimTop - 0.5} L${50 + 2.8} ${rimTop - 0.5} L${50 + 2.2} ${tip - 1.6} Q50 ${tip + 0.6} ${50 - 2.2} ${tip - 1.6} Z`, steel, W.feature) +
    flat(d`M${50 - 2.8} ${rimTop - 0.5} L${50 - 0.8} ${rimTop - 0.5} L${50 - 0.6} ${tip - 0.4} Q${50 - 1.6} ${tip} ${50 - 2.2} ${tip - 1.6} Z`, shade(steel, -14)) +
    dot(50 + 0.6, rimTop + 1.6, 0.95, shade(steel, 20))
  return (look.crest ? '' : spikes) + shell + strap + rim + nasal + (look.crest ? crest(ctx, top, socket) : '')
}

/** Bone, old bone and grey bone. */
const BONE = ['#eae0c8', '#ddcca2', '#d3cfc3'] as const

/**
 * The skull helm: a beast's skull worn over the head. At 48 px big sockets above the orc's own eyes
 * read as a second pair of eyes, so the skull is told by its nose hole and its teeth, light in a
 * dark slot: the sockets stay small, slanted and empty. The teeth stop well above the brows, so
 * fangs, brows and the skull's edge don't merge into one dark band over the eyes, and the dome
 * rises as far as its face needs (higher than the other helmets on a low-browed head).
 */
function skullHelm(ctx: Ctx): string {
  const { a, look, p } = ctx
  const bone = hatFill(BONE, look.hatColour, p.skin)
  const dark = shade(bone, -16)
  const hole = '#2a221d'
  const hw = a.SW + 3
  const low = a.B - 3
  const s = a.SEAT
  // Laid out from the fang tips up. The tips' outline stops at B − 8.3: 2.5 above a level brow
  // ridge's top (B − 5.8, face.ts), and clear of one raised under the skull (underBrim: 2 at most).
  const tip = a.B - 9.3
  // The slot the teeth stand in, `root` to `foot`; the fangs hang 2.2 below it.
  const foot = tip - 2.2
  const root = foot - 3.8
  // The nose hole's lobes, a bone bridge above the slot, and the sockets' centre line.
  const nb = root - 2.6
  const sy = nb - 4
  const top = Math.min(a.C - 5, sy - 7.2)
  // The cranium comes down the sides to `low`; in front, its edge runs under the slot.
  const jaw = foot - 1
  const outline =
    d`M${50 - hw} ${low} L${50 - hw} ${s - 1} C${50 - hw} ${top + 4} ${50 - hw * 0.6} ${top} 50 ${top} ` +
    d`C${50 + hw * 0.6} ${top} ${50 + hw} ${top + 4} ${50 + hw} ${s - 1} L${50 + hw} ${low} ` +
    d`C${50 + hw - 3} ${low} ${50 + 15} ${jaw + 1} ${50 + 11} ${jaw} L${50 - 11} ${jaw} C${50 - 15} ${jaw + 1} ${50 - hw + 3} ${low} ${50 - hw} ${low} Z`
  // The teeth, over the skull's edge: a fang at each corner of the snout and two wide incisors
  // between, in a dark slot that fills the gaps, so they read light on dark at 48 px. The incisors
  // have no outline of their own (it left only a speck of bone): they grow from the bone over the
  // slot's top edge and stop short of its foot.
  const slot = shape(d`M${50 - 9.6} ${root} L${50 + 9.6} ${root} L${50 + 9.6} ${foot} Q50 ${foot + 0.6} ${50 - 9.6} ${foot} Z`, hole, W.detail)
  const incisor = (x: number) =>
    flat(d`M${x - 2.6} ${root - 1.2} L${x + 2.6} ${root - 1.2} L${x + 2.6} ${foot - 1.6} Q${x} ${foot} ${x - 2.6} ${foot - 1.6} Z`, bone)
  const fang = (x: number) =>
    shape(d`M${x - 2.4} ${root - 0.4} L${x + 2.4} ${root - 0.4} Q${x + 1.8} ${foot} ${x} ${tip} Q${x - 1.8} ${foot} ${x - 2.4} ${root - 0.4} Z`, bone, W.detail)
  const teeth = slot + incisor(50 - 3.3) + incisor(50 + 3.3) + fang(50 - 9.6) + fang(50 + 9.6)
  // Eye sockets: small slanted holes, low at the inner end, set out toward the temples.
  const socket = (sd: 1 | -1) => {
    const x = (dist: number) => 50 + sd * dist
    return shape(
      d`M${x(5)} ${sy + 1.4} C${x(5)} ${sy - 1.2} ${x(8.4)} ${sy - 2.6} ${x(11.6)} ${sy - 2.2} ` +
        d`C${x(13.2)} ${sy - 1} ${x(12.6)} ${sy + 1.8} ${x(10.2)} ${sy + 2.4} C${x(7.6)} ${sy + 3} ${x(5)} ${sy + 3} ${x(5)} ${sy + 1.4} Z`,
      hole,
      W.feature,
    )
  }
  // The nose hole: an upturned heart between the sockets.
  const nasal =
    d`M50 ${sy} C${50 + 1.2} ${sy + 1.6} ${50 + 3.2} ${nb - 2.4} ${50 + 2.8} ${nb} Q${50 + 1.6} ${nb + 1} 50 ${nb - 0.6} ` +
    d`Q${50 - 1.6} ${nb + 1} ${50 - 2.8} ${nb} C${50 - 3.2} ${nb - 2.4} ${50 - 1.2} ${sy + 1.6} 50 ${sy} Z`
  return (
    shape(outline, bone, W.silhouette) +
    shellShade(hw, low - 1.5, s - 1, top, dark) +
    sheen(d`M${50 + hw * 0.55} ${top + 2.5} C${50 + hw * 0.8} ${top + 4} ${50 + hw - 2.4} ${top + 7} ${50 + hw - 2.4} ${s - 2}`, shade(bone, 8), 2.2) +
    socket(1) +
    socket(-1) +
    shape(nasal, hole, W.detail) +
    teeth
  )
}

// Cloth -----------------------------------------------------------------------------------------

/**
 * The bandana: a team-colour cloth over the skull, tied off at side +1 with two tails. Hair 'pokes':
 * the hair layer is drawn under it, so a topknot, mohawk or spikes show where they rise above it (a
 * tuft or a fringe hides: UNDER_BANDANA).
 */
function bandana({ a, p }: Ctx): string {
  const colour = p.team
  const dark = shade(colour, -14)
  const s = a.SEAT
  const hw = a.SW + 2
  const top = a.C - 2
  const front = s + 5.5
  const cloth =
    d`M${50 - hw} ${s + 4} L${50 - hw} ${s - 1} C${50 - hw} ${top + 4} ${50 - hw * 0.6} ${top} 50 ${top} ` +
    d`C${50 + hw * 0.6} ${top} ${50 + hw} ${top + 4} ${50 + hw} ${s - 1} L${50 + hw} ${s + 4} Q50 ${2 * front - s - 4} ${50 - hw} ${s + 4} Z`
  // The knot and its tails, at the skull's side +1 edge.
  const kx = 50 + hw - 0.5
  const ky = s + 1
  const tails =
    shape(d`M${kx} ${ky - 1} C${kx + 4} ${ky - 3} ${kx + 8} ${ky - 2} ${kx + 11} ${ky + 1} C${kx + 8} ${ky + 2.5} ${kx + 4} ${ky + 2.5} ${kx} ${ky + 1.5} Z`, colour, W.feature) +
    shape(d`M${kx} ${ky} C${kx + 3} ${ky + 3} ${kx + 6} ${ky + 7} ${kx + 6.5} ${ky + 11} C${kx + 3} ${ky + 9} ${kx} ${ky + 6} ${kx - 1.5} ${ky + 2} Z`, colour, W.feature)
  const spots = [
    [-0.55, 0.42],
    [0, 0.25],
    [0.5, 0.45],
    [-0.25, 0.7],
    [0.28, 0.72],
  ]
    .map(([u, v]) => dot(50 + (u ?? 0) * hw, top + (front - top) * (v ?? 0), 1.6, shade(colour, 26)))
    .join('')
  return (
    shape(cloth, colour, W.silhouette) +
    shellShade(hw, s + 3.6, s - 1, top, dark) +
    spots +
    path(d`M${50 - hw + 2} ${s + 2} Q50 ${front + 0.5} ${50 + hw - 2} ${s + 2}`, { fill: 'none', stroke: dark, sw: 1.6 }) +
    tails +
    ellipse(kx, ky + 0.5, 3.2, 3, { fill: colour, sw: W.feature }) +
    path(d`M${kx - 1.2} ${ky - 1} Q${kx + 0.5} ${ky + 0.5} ${kx - 0.6} ${ky + 2.2}`, { fill: 'none', stroke: dark, sw: 1.2 })
  )
}

/** Hat feathers: red, pheasant, ochre, teal, jay blue. Nothing dark: they stand against the sky. */
const FEATHERS = ['#c8312f', '#c07a3e', '#e3a33a', '#2f9b98', '#6f8fd0'] as const

/** A feather, base at (x, y), leaning `angle` degrees from upright, `len` long. */
function feather(x: number, y: number, angle: number, len: number, colour: string): string {
  const w = len * 0.22
  const vane = d`M0 0 C${-w * 1.2} ${-len * 0.25} ${-w} ${-len * 0.75} 0 ${-len} C${w} ${-len * 0.75} ${w * 1.2} ${-len * 0.25} 0 0 Z`
  const tip = d`M${-w * 0.62} ${-len * 0.76} C${-w * 0.5} ${-len * 0.88} ${-w * 0.25} ${-len * 0.95} 0 ${-len} C${w * 0.25} ${-len * 0.95} ${w * 0.5} ${-len * 0.88} ${w * 0.62} ${-len * 0.76} Q0 ${-len * 0.8} ${-w * 0.62} ${-len * 0.76} Z`
  const notch = d`M${w * 0.9} ${-len * 0.45} L${w * 0.2} ${-len * 0.5}`
  const quill = d`M0 ${len * 0.12} L0 ${-len * 0.85}`
  const dark = shade(colour, -24)
  return g(
    shape(vane, colour, W.feature) +
      flat(tip, dark) +
      path(notch, { fill: 'none', sw: W.detail }) +
      path(quill, { fill: 'none', stroke: dark, sw: 1.3 }),
    { transform: `translate(${n(x)} ${n(y)}) rotate(${n(angle)})` },
  )
}

/** Alpine felts: loden green, grey, brown and slate, all at lightness 30+. */
const ALPINE = ['#4f6b45', '#6b6a64', '#6e5238', '#4c586c'] as const
/** Twisted-cord bands: red, cream, forest green, gold. */
const CORD = ['#b8322e', '#efe2c4', '#2f5a3a', '#e0b23c'] as const

/**
 * The alpine hat (the 'feather-band' slot): a tapered felt crown pinched in the middle of its top,
 * a cord band, a short brim curled up at the sides, and one feather tucked into the band at side
 * +1, leaning out. A single side feather on a hat, never an upright fan on a headband.
 */
function alpine({ a, look, p }: Ctx): string {
  const colour = hatFill(ALPINE, look.hatColour, p.skin)
  const dark = shade(colour, -9)
  const w = a.SW
  const wt = w * 0.48
  const base = a.SEAT + 3
  const top = a.C - 9
  const h = base - top
  const bw = w + 5.5
  // The crown: sides tapering straight up to round shoulders, the top dipping between them at the
  // pinch.
  const crown =
    d`M${50 - w} ${base} C${50 - w + 1} ${base - h * 0.4} ${50 - wt - 0.5} ${top + 4} ${50 - wt} ${top + 1} ` +
    d`Q${50 - wt * 0.45} ${top - 1.6} 50 ${top + 1.8} Q${50 + wt * 0.45} ${top - 1.6} ${50 + wt} ${top + 1} ` +
    d`C${50 + wt + 0.5} ${top + 4} ${50 + w - 1} ${base - h * 0.4} ${50 + w} ${base} Z`
  const flank =
    d`M${50 - w + 1.8} ${base - 1} C${50 - w + 2.6} ${base - h * 0.4} ${50 - wt + 1} ${top + 4.5} ${50 - wt + 1.2} ${top + 2.2} ` +
    d`L${50 - wt + 4.5} ${top + 2.6} C${50 - wt + 4} ${top + 6} ${50 - w + 7} ${base - h * 0.4} ${50 - w + 6} ${base - 1} Z`
  // The pinch: a short crease down the front from the dip.
  const crease = d`M50 ${top + 2.8} Q${50 - 0.6} ${top + 5.5} 50 ${top + 8}`
  // The feather stands from the band near side +1, leaning out past the shoulder and up above the
  // crown. Its tip stays at y ≥ 6 untilted, so at the full tilt, outline and all, it's above y 2.
  const fy = base - 3.5
  const lean = 20
  const len = Math.min(24, (fy - 6) / Math.cos((lean * Math.PI) / 180))
  return (
    shape(crown, colour, W.silhouette) +
    flat(flank, dark) +
    path(crease, { fill: 'none', stroke: dark, sw: W.detail }) +
    sheen(d`M${50 + wt * 0.5} ${top + 2.2} C${50 + wt} ${top + 2.6} ${50 + wt + 1.6} ${top + 6} ${50 + w - 3.4} ${base - 6}`, lightOf(colour), 2) +
    feather(50 + w * 0.58, fy, lean, len, at(FEATHERS, look.hatAccent)) +
    shape(strip(w - 0.4, base - 5.5, base - 1.5, 0.6), at(CORD, look.hatAccent + 1), W.detail) +
    shape(lens(50 - bw, base - 4.5, 50 + bw, base - 4.5, base - 1.6, base + 2.6), colour, W.silhouette) +
    sheen(d`M${50 - bw + 4.5} ${base - 2.8} Q50 ${base + 0.4} ${50 + bw - 4.5} ${base - 2.8}`, lightOf(colour), 1.4)
  )
}

/** Straw hat bands: rust, moss, brown, denim. */
const STRAW_BAND = ['#8a3a2a', '#3a5a3a', '#5a4632', '#2f4a6a'] as const

/** The straw hat: a low rounded crown on a huge drooping brim; the peon's sun hat. */
function straw({ a, look, p }: Ctx): string {
  const colour = hatFill(STRAW, look.hatColour, p.skin)
  const s = a.SEAT
  const bw = Math.min(43, a.SW + 18)
  const cy = Math.min(s + 1, a.B - 10.5)
  const w = a.SW - 3
  const top = a.C - 7
  const dark = shade(colour, -16)
  const band = at(STRAW_BAND, look.hatAccent)
  // The brim: a flat ellipse whose front edge sags a little lower than its back.
  const brim = d`M${50 - bw} ${cy + 1} C${50 - bw} ${cy - 5.5} ${50 + bw} ${cy - 5.5} ${50 + bw} ${cy + 1} C${50 + bw} ${cy + 7.5} ${50 - bw} ${cy + 7.5} ${50 - bw} ${cy + 1} Z`
  // Ragged ends: three short straws bristling out of each end of the rim. Each starts inside the
  // brim; its outline goes under the brim and its straw colour over it, so the straw runs on out
  // through the rim and reads as a loose end, not a stray line.
  const frays = [-1, 1]
    .map(sd => {
      const x = (dist: number) => 50 + sd * dist
      return (
        d`M${x(bw - 3.5)} ${cy + 0.4} L${x(bw + 2.2)} ${cy - 2.4} ` +
        d`M${x(bw - 3.5)} ${cy + 2} L${x(bw + 3)} ${cy + 2.8} ` +
        d`M${x(bw - 7.5)} ${cy + 2.2} L${x(bw - 4)} ${cy + 7.2}`
      )
    })
    .join(' ')
  const fraySw = 1.6
  // A woven ring on the brim.
  const ring = d`M${50 - bw + 6} ${cy + 1.5} C${50 - bw + 6} ${cy + 6} ${50 + bw - 6} ${cy + 6} ${50 + bw - 6} ${cy + 1.5}`
  return (
    // outlined(), split round the brim.
    path(frays, { fill: 'none', sw: fraySw + 2.5 }) +
    shape(brim, colour, W.silhouette) +
    path(frays, { fill: 'none', stroke: colour, sw: fraySw }) +
    path(ring, { fill: 'none', stroke: dark, sw: 1.4 }) +
    shape(dome(w, cy, top, 0.5, 0.8), colour, W.silhouette) +
    domeShade(w, cy - 1, top, dark) +
    path(d`M${50 + w * 0.2} ${top + 3} C${50 + w * 0.5} ${top + 4} ${50 + w * 0.7} ${top + 8} ${50 + w * 0.75} ${cy - 5}`, { fill: 'none', stroke: dark, sw: 1.4 }) +
    shape(strip(w - 0.4, cy - 4.5, cy - 0.5, 0.8), band, W.feature)
  )
}

// Work and play ---------------------------------------------------------------------------------

/** Safety yellow, safety orange, white, blue and red: one each, so hard hats vary. */
const HARD_HAT = ['#f5c02a', '#f08a24', '#eeede6', '#3f7fd0', '#e4472f'] as const

/** The hard hat: a smooth dome with a raised ridge down the middle and a peak all round. */
function hardHat({ a, look, p }: Ctx): string {
  const colour = hatFill(HARD_HAT, look.hatColour, p.skin)
  const s = a.SEAT
  const w = a.SW + 2
  const base = s + 3
  const top = a.C - 5
  const bw = a.SW + 6
  const dark = shade(colour, -14)
  const light = shade(colour, 16)
  const ridge = d`M${50 - 3} ${top + 0.6} C${50 - 3.4} ${top + 6} ${50 - 3.8} ${base - 6} ${50 - 4} ${base} L${50 + 4} ${base} C${50 + 3.8} ${base - 6} ${50 + 3.4} ${top + 6} ${50 + 3} ${top + 0.6} Z`
  const low = Math.min(base + 4, a.B - 5)
  const peak = lens(50 - bw, base - 1, 50 + bw, base - 1, base - 0.6, low)
  return (
    shape(dome(w, base, top, 0.6), colour, W.silhouette) +
    domeShade(w, base - 1, top, dark) +
    sheen(d`M${50 + 6.5} ${top + 1.6} C${50 + w * 0.65} ${top + 2.6} ${50 + w - 2.6} ${top + 7} ${50 + w - 2.6} ${base - 6}`, light, 2.4) +
    shape(ridge, colour, W.detail) +
    sheen(d`M${50 + 1.2} ${top + 2.5} L${50 + 1.5} ${base - 3}`, light, 1.4) +
    shape(peak, colour, W.silhouette) +
    path(d`M${50 - bw + 4} ${base + 0.2} Q50 ${low + 0.8} ${50 + bw - 4} ${base + 0.2}`, { fill: 'none', stroke: dark, sw: 1.4 })
  )
}

/** Army green, leather brown, tin and navy miner's helmets. */
const MINER = ['#6f7d50', '#8a6440', '#8f959b', '#46556b'] as const

/** The miner's helmet: a round dome, a narrow brim, a lamp blazing at the front. */
function miner({ a, look, p }: Ctx): string {
  const colour = hatFill(MINER, look.hatColour, p.skin)
  const s = a.SEAT
  const w = a.SW + 1.5
  const base = s + 3
  const top = a.C - 6
  const bw = a.SW + 4.5
  const dark = shade(colour, -12)
  const ly = Math.max(top + 7.5, s - 4.5)
  const low = Math.min(base + 3.2, a.B - 3)
  return (
    shape(dome(w, base, top, 0.55), colour, W.silhouette) +
    domeShade(w, base - 1, top, dark) +
    domeSheen(w, top, base - 6, shade(colour, 20), w * 0.4) +
    shape(lens(50 - bw, base - 1.5, 50 + bw, base - 1.5, base - 1, low), colour, W.silhouette) +
    path(d`M${50 - bw + 3} ${base - 0.6} Q50 ${low + 0.4} ${50 + bw - 3} ${base - 0.6}`, { fill: 'none', stroke: dark, sw: 1.4 }) +
    // The lamp: a bracket, a metal housing, a glowing lens with a halo.
    rect(50 - 2.4, ly + 3, 4.8, base - ly - 3.4, { fill: p.metalDark, sw: W.detail }) +
    circle(50, ly, 7.4, { fill: '#fff4b0', stroke: 'none', fo: 0.35 }) +
    circle(50, ly, 5.2, { fill: p.metal, sw: W.feature }) +
    circle(50, ly, 3.4, { fill: '#fff2a0', sw: W.detail }) +
    dot(50 + 1.1, ly - 1.1, 1.1, '#ffffff')
  )
}

/**
 * The knitted cuff: a turned-up band a shade darker than the knit, with a light fold along its top
 * and two soft ribs either side (more turn into a zipper at 48 px).
 */
function cuff(w: number, top: number, bottom: number, colour: string): string {
  const band = shade(colour, -8)
  const ribs = [-0.62, -0.3, 0.3, 0.62]
    .map(t => {
      const bow = 0.6 * (1 - t * t)
      return d`M${50 + t * w} ${top + 1.6 + bow} L${50 + t * w} ${bottom - 1 + bow}`
    })
    .join(' ')
  return (
    shape(strip(w, top, bottom, 0.6), band, W.silhouette) +
    path(ribs, { fill: 'none', stroke: shade(band, -7), sw: 1.6 }) +
    sheen(d`M${50 - w + 2} ${top + 1} Q50 ${top + 2.2} ${50 + w - 2} ${top + 1}`, shade(colour, 12), 1.4)
  )
}

/** The beanie: a knitted team-colour dome with ribs, a deep turned-up cuff, a pompom on top. */
function beanie({ a, p }: Ctx): string {
  const colour = p.team
  const w = a.SW + 2
  const s = a.SEAT
  // A slouchy knit stands a little taller than the skull; the pompom's top stays at y ≥ 2.
  const top = Math.max(12, a.C - 6)
  const dark = shade(colour, -12)
  const pom = p.team2 === p.team ? shade(p.team, 30) : p.team2
  // Knit ribs: meridians from the crown to the cuff, like the seams of a ball.
  const ribs = [-0.62, -0.22, 0.22, 0.62]
    .map(t => d`M${50 + t * w * 0.25} ${top + 1.5} C${50 + t * w * 0.7} ${top + 3} ${50 + t * w} ${s - 6} ${50 + t * w * 1.02} ${s - 1.5}`)
    .join(' ')
  return (
    pompom(50, top - 2, 5, pom) +
    shape(dome(w, s + 2, top, 0.6), colour, W.silhouette) +
    domeShade(w, s + 1, top, dark) +
    path(ribs, { fill: 'none', stroke: dark, sw: 1.5 }) +
    cuff(w + 0.8, s - 2, Math.min(s + 5, a.B - 5), colour)
  )
}

/** Propeller blades: red, blue, yellow, green. */
const BLADES = ['#d8323a', '#2f6fd8', '#f2c230', '#2fae6a'] as const

/** The propeller beanie: a panelled cap, a stem, and two bright blades. */
function propeller({ a, look, p }: Ctx): string {
  const w = a.SW + 2
  const s = a.SEAT
  const top = Math.max(14.5, a.C - 3)
  const outer = p.team
  const inner = p.team2 === p.team ? '#f2c230' : p.team2
  const base = Math.min(s + 4, a.B - 3)
  // The front gore between two seams that bow out from the crown to the band.
  const gore = d`M50 ${top} C${50 - 7} ${top + 2} ${50 - 9} ${base - 6} ${50 - 8.5} ${base} L${50 + 8.5} ${base} C${50 + 9} ${base - 6} ${50 + 7} ${top + 2} 50 ${top} Z`
  const by = top - 6.5
  const blade = (sd: 1 | -1, colour: string) =>
    shape(d`M50 ${by} C${50 + sd * 4} ${by - 4.4} ${50 + sd * 11} ${by - 4} ${50 + sd * 13.5} ${by - 1.2} C${50 + sd * 12.5} ${by + 2} ${50 + sd * 4} ${by + 2} 50 ${by} Z`, colour, W.feature)
  return (
    shape(dome(w, base, top, 0.62), outer, W.silhouette) +
    domeShade(w, base - 1, top, shade(outer, -12)) +
    shape(gore, inner, W.feature) +
    sheen(d`M${50 + 2.4} ${top + 3} C${50 + 4.5} ${top + 6} ${50 + 5.5} ${base - 6} ${50 + 5.6} ${base - 2}`, shade(inner, 18), 1.8) +
    shape(strip(w + 0.4, base - 3.5, base, 0.6), shade(outer, -10), W.feature) +
    rect(50 - 1.2, by, 2.4, top - by + 0.6, { fill: p.metal, sw: W.detail }) +
    blade(1, at(BLADES, look.hatAccent)) +
    blade(-1, at(BLADES, look.hatAccent + 1)) +
    circle(50, by, 1.9, { fill: p.metal, sw: W.detail })
  )
}

/** The toque: a pleated band under a big puff, chef white. */
function toque({ a }: Ctx): string {
  const white = '#f7f4ec'
  const grey = '#d9d4c6'
  const s = a.SEAT
  const w = a.SW
  const bandTop = s - 3.5
  const bandBottom = Math.min(s + 3.5, a.B - 4.5)
  // Three puffs; the middle one tallest. Its top stays at y ≥ 3.
  const midR = 9.5
  const midY = Math.max(6 + midR, bandTop - 12)
  const sideR = 8
  const sideY = Math.max(midY + 3, bandTop - 7)
  const puffs = blob(
    [
      disc(50 - w + 6.5, sideY, sideR),
      disc(50 + w - 6.5, sideY, sideR),
      disc(50, midY, midR),
      (paint: Paint) => rect(50 - w + 2.5, sideY, 2 * w - 5, bandTop - sideY + 1, paint),
    ],
    white,
  )
  const creases = d`M${50 - 6} ${midY + 6} Q${50 - 8} ${sideY + 3} ${50 - 7} ${bandTop - 1} M${50 + 6} ${midY + 6} Q${50 + 8} ${sideY + 3} ${50 + 7} ${bandTop - 1}`
  const pleats: string[] = []
  for (let x = -w + 7; x <= w - 6; x += 8) pleats.push(d`M${50 + x} ${bandTop + 1.8} L${50 + x} ${bandBottom - 1.4}`)
  return (
    puffs +
    path(creases, { fill: 'none', stroke: grey, sw: 1.8 }) +
    flat(d`M${50 - w + 4} ${sideY + 2} Q${50 - w + 3} ${bandTop - 1} ${50 - w + 6} ${bandTop - 1} L${50 - w + 9} ${bandTop - 1} Q${50 - w + 6} ${bandTop - 4} ${50 - w + 4} ${sideY + 2} Z`, grey) +
    shape(strip(w - 1, bandTop, bandBottom, 0.6), white, W.silhouette) +
    path(pleats.join(' '), { fill: 'none', stroke: grey, sw: 2 })
  )
}

/** Party cones: pink, blue, purple, green and yellow (an orange one was a traffic cone). */
const PARTY = ['#e0457b', '#2f8fd6', '#7d3cc8', '#2fae6a', '#f2c230'] as const
/** Stripes and pompoms: pale yellow, white, sky and pink. */
const PARTY_STRIPE = ['#ffe066', '#ffffff', '#5ad1ff', '#ff8fb8'] as const

/**
 * Whether a stripe suits a cone: it stands off it (no pale yellow on yellow), and it isn't white
 * on a red, orange or yellow cone, which white bands turn into a traffic cone. Pink (hue 339)
 * stays a party colour.
 */
function stripeSuits(stripe: string, cone: string): boolean {
  const [hue] = toHsl(cone)
  const safety = hue < 65 || hue > 345
  return !clashes(stripe, cone) && !(safety && stripe === '#ffffff')
}

/**
 * The party hat: a bright cone on the crown, two light stripes, a pompom on its tip. At 48 px it's
 * a few pixels across, so it carries no dark ink inside: the stripes are flat (outlined, they drew
 * four dark lines across it), there's no shaded half, and one outline goes over the lot, trimming
 * the stripes' ends. It rides higher over pushed-up goggles.
 */
function party(ctx: Ctx): string {
  const { a, look, p } = ctx
  const colour = hatFill(PARTY, look.hatColour, p.skin)
  const stripe = nextFitting(PARTY_STRIPE, look.hatAccent, light => stripeSuits(light, colour))
  // The foot sags 1.3 at the front, plus the outline: 3.05 below `base`.
  const base = a.C + 7.5 - goggleLift(ctx, a.C + 7.5 + 3.05)
  // The pompom sits on the tip; its top (apex − 5.9 with its outline) stays at y ≥ 2 at any tilt.
  const apex = 7.9
  const hw = 15
  const cone = d`M${50 - hw} ${base} L50 ${apex} L${50 + hw} ${base} Q50 ${base + 2.6} ${50 - hw} ${base} Z`
  // A point on the cone's left (−1) or right (+1) edge at height y.
  const edge = (sd: 1 | -1, y: number) => 50 + sd * hw * ((y - apex) / (base - apex))
  // Stripes slant up to side +1: each is a quad between two slanted lines across the cone.
  const band = (y0: number, y1: number) =>
    d`M${edge(-1, y0 + 1.8)} ${y0 + 1.8} L${edge(1, y0 - 1.8)} ${y0 - 1.8} L${edge(1, y1 - 1.8)} ${y1 - 1.8} L${edge(-1, y1 + 1.8)} ${y1 + 1.8} Z`
  const h = base - apex
  const stripes = [0.26, 0.64].map(t => flat(band(apex + h * t, apex + h * (t + 0.18)), stripe)).join('')
  return (
    flat(cone, colour) +
    stripes +
    sheen(d`M${50 + 1.8} ${apex + 5} L${edge(1, base - 2) - 3} ${base - 2}`, shade(colour, 22), 1.6) +
    path(cone, { fill: 'none', sw: W.silhouette }) +
    pompom(50, apex + 0.4, 3.4, stripe)
  )
}

/** Every hat's drawing; 'none' draws nothing. */
const HATS: Record<HatName, Draw> = {
  none: () => '',
  'top-hat': topHat,
  'tiny-top-hat': tinyTopHat,
  bowler,
  boater,
  fez,
  tricorn,
  crown,
  pith,
  'flat-cap': flatCap,
  captain,
  'horned-helm': hornedHelm,
  'spiked-helm': spikedHelm,
  'skull-helm': skullHelm,
  bandana,
  'feather-band': alpine,
  straw,
  'hard-hat': hardHat,
  miner,
  beanie,
  propeller,
  toque,
  party,
}

/** Layer 22: the hat. The caller wraps it in the tilt group. */
export function hat(ctx: Ctx): string {
  return HATS[ctx.look.hat](ctx)
}
