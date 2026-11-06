// Colours: skin families and the fixed lists the parts pick from. Every colour is #rrggbb.
//
// Contrast: large fills stay at lightness 30+ (skin 34+), so the orc reads on a dark terminal
// once the dark outline vanishes into it; on a light terminal the outline carries the edge.

import { at, hex, shade } from './svg'
import type { Row } from './svg'
import type { Build, EyeColour, HairColour, Look, MetalName, PaintColour, SkinFamily, TuskColour } from './types'

/** Skin families: the green most orcs have, and rare others. */
export const SKIN_FAMILY_ROWS: readonly Row<SkinFamily>[] = [
  ['green', 90, 90],
  ['olive', 3, 3],
  ['ash', 3, 3],
  ['rust', 2, 2],
  ['slate', 2, 2],
]

type Span = readonly [lo: number, hi: number]
/**
 * Hue, saturation and lightness spans per family; green differs by build (peons yellower, lighter).
 * The rare families stay in the orc's earthy range, and off every human skin tone. Rust (the name
 * is older than the colour) is a grey-olive mud brown, greyer than olive: every warmer brown is a
 * human's (a raw umber orc with a mustache read as a man), a pinker red read as a pig or a devil,
 * a ruddy chocolate as a bat or a teddy bear, and a brick red with braids or war paint would be a
 * real-world caricature. Slate is a cold sea green (a blue one read as a troll).
 */
const SKIN_SPANS: Record<SkinFamily, Record<Build, { h: Span; s: Span; l: Span }>> = {
  green: {
    peon: { h: [68, 105], s: [32, 50], l: [42, 54] },
    grunt: { h: [92, 132], s: [28, 48], l: [34, 46] },
  },
  olive: {
    peon: { h: [40, 58], s: [30, 40], l: [38, 46] },
    grunt: { h: [40, 58], s: [30, 40], l: [38, 46] },
  },
  ash: {
    peon: { h: [80, 110], s: [6, 12], l: [44, 52] },
    grunt: { h: [80, 110], s: [6, 12], l: [44, 52] },
  },
  rust: {
    peon: { h: [42, 50], s: [16, 26], l: [38, 44] },
    grunt: { h: [42, 50], s: [16, 26], l: [38, 44] },
  },
  slate: {
    peon: { h: [150, 172], s: [14, 24], l: [42, 50] },
    grunt: { h: [150, 172], s: [14, 24], l: [42, 50] },
  },
}

/** Scales a 0..100 draw into a span, so spans can change without changing the draw count. */
export function skinFrom(family: SkinFamily, build: Build, u: { h: number; s: number; l: number }) {
  const spans = SKIN_SPANS[family][build]
  const scale = ([lo, hi]: Span, value: number) => Math.round(lo + ((hi - lo) * value) / 100)
  return { family, h: scale(spans.h, u.h), s: scale(spans.s, u.s), l: scale(spans.l, u.l) }
}

export const EYE_COLOUR_ROWS: readonly Row<EyeColour>[] = [
  ['red', 12, 38],
  ['amber', 20, 20],
  ['yellow', 20, 15],
  ['orange', 10, 15],
  ['bone', 30, 4],
  ['ice', 4, 4],
  ['fel', 4, 4],
]
export const EYE_HEX: Record<EyeColour, string> = {
  red: '#ef4a32',
  amber: '#f5a133',
  yellow: '#f6d83e',
  orange: '#ff8a1f',
  bone: '#f2ead0',
  ice: '#a6e6ff',
  fel: '#b6ff5c',
}

export const TUSK_COLOUR_ROWS: readonly Row<TuskColour>[] = [
  ['ivory', 55, 55],
  ['old', 35, 35],
  ['grey', 10, 10],
]
const TUSK_HEX: Record<TuskColour, string> = { ivory: '#f1e8cb', old: '#e6d394', grey: '#d8d4c6' }

/**
 * Black and brown are under half: they're the two darks, and the lighter colours read apart. White
 * is rarest: the grey roll (orc.ts) and pale hair on a skin it fades into add to it, and it's the
 * colour that stands out most on a dark terminal, so at 12 a quarter of a sheet was grey-haired.
 */
export const HAIR_COLOUR_ROWS: readonly Row<HairColour>[] = [
  ['black', 28, 30],
  ['brown', 18, 18],
  ['chestnut', 18, 14],
  ['rust', 16, 18],
  ['ash', 12, 12],
  ['white', 8, 8],
]
/**
 * Black is a cool charcoal, not black, so it still shows on a dark terminal; a very dark brown was
 * as light as brown, and the two were one colour at 48 px.
 */
export const HAIR_HEX: Record<HairColour, string> = {
  black: '#393a42',
  brown: '#55341f',
  chestnut: '#7a4524',
  rust: '#9a4222',
  ash: '#8f8d87',
  white: '#e6e0d3',
}

export const METAL_ROWS: readonly Row<MetalName>[] = [
  ['gold', 40, 25, 50],
  ['silver', 25, 20, 35],
  ['bronze', 20, 25, 10],
  ['iron', 15, 30, 5],
]
/** Each metal as [base, light, dark]. */
export const METAL_HEX: Record<MetalName, readonly [string, string, string]> = {
  gold: ['#e3b43c', '#f6da82', '#9a7520'],
  silver: ['#cdd4da', '#f2f5f7', '#8b949c'],
  bronze: ['#b47c3c', '#dca866', '#6e4a22'],
  iron: ['#80878f', '#bcc3ca', '#4f555c'],
}

export const PAINT_COLOUR_ROWS: readonly Row<PaintColour>[] = [
  ['red', 40, 40],
  ['bone', 20, 20],
  ['black', 15, 15],
  ['ochre', 15, 15],
  ['woad', 10, 10],
]
/** Woad is a light blue: a darker one sank into grunt-green skin at 48 px. */
export const PAINT_HEX: Record<PaintColour, string> = {
  red: '#b8292e',
  bone: '#ece4cf',
  black: '#221c18',
  ochre: '#d38c2b',
  woad: '#5a8ad0',
}

/** Eye colours that vanish inside an eye-band of each paint colour at 48 px. */
const BAND_HIDES: Record<PaintColour, readonly EyeColour[]> = {
  red: ['red', 'orange', 'amber'],
  ochre: ['red', 'orange', 'amber', 'yellow'],
  bone: ['bone', 'ice', 'yellow'],
  black: [],
  woad: [],
}

/** True when eyes of this colour still show inside an eye-band of this paint. */
export function eyesShowIn(paint: PaintColour, eye: EyeColour): boolean {
  return !BAND_HIDES[paint].includes(eye)
}

/** The "redmean" distance between two colours, a cheap perceptual RGB distance: black to white is 765. */
export function distance(a: string, b: string): number {
  const rgb = (colour: string) => [16, 8, 0].map(shift => (Number.parseInt(colour.slice(1), 16) >> shift) & 255)
  const [r1 = 0, g1 = 0, b1 = 0] = rgb(a)
  const [r2 = 0, g2 = 0, b2 = 0] = rgb(b)
  const mean = (r1 + r2) / 2
  return Math.sqrt((2 + mean / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - mean) / 256) * (b1 - b2) ** 2)
}

/**
 * True when two colours run together at 48 px: closer than 115 in `distance`. Red on team red is
 * 31, a white bandana on bone 38, blue on woad 108; brown on red, at 120, still reads apart.
 */
export function clashes(a: string, b: string): boolean {
  return distance(a, b) < 115
}

/** Plain team colours for tabards, bandanas, beanies, scarves and bow ties. No emblems. */
export const TEAM_HEX = [
  '#c8312f', '#2f5fc8', '#22a39a', '#7d3cc8', '#e3c22d', '#e07a26', '#e06aa6', '#7a4a2a', '#e8e8e8',
] as const
/** Accents: hat bands, trims, bow ties. */
export const ACCENT_HEX = ['#c23b33', '#e0b23c', '#efe2c4', '#2f9b98', '#6a3fa0', '#2f5fc8'] as const

export interface Palette {
  skin: string
  /** Brow ridge underside, inner ear, neck, lip shadow. */
  skinDark: string
  /** Scalp shine, scars, highlights. */
  skinLight: string
  /** The eye's fill (the iris-and-white in one: orc eyes glow a single colour). */
  eye: string
  hair: string
  /** Mustache and beard. */
  facial: string
  tusk: string
  tuskShade: string
  metal: string
  metalLight: string
  metalDark: string
  paint: string
  burlap: string
  burlapDark: string
  leather: string
  leatherDark: string
  fur: string
  furLight: string
  team: string
  team2: string
  accent: string
  /** Mouth cavity, tongue, and the front teeth of a grin. */
  mouth: string
  tongue: string
  teeth: string
}

export function paletteFor(look: Look): Palette {
  const { h, s, l } = look.skin
  const skin = hex(h, s, l)
  const [metal, metalLight, metalDark] = METAL_HEX[look.metal]
  const tone = look.clothTone
  const burlap = hex(28 + (tone % 17), 30 + ((tone * 7) % 19), 48 + ((tone * 3) % 15))
  const leather = at(['#6b4226', '#5c3b22', '#7a5230'], tone)
  const fur = at(['#6b5440', '#8a8278', '#5a4636', '#9a8a70'], tone)
  const tusk = TUSK_HEX[look.tuskColour]
  return {
    skin,
    skinDark: hex(h, s + 5, l - 11),
    skinLight: hex(h, s - 4, Math.min(80, l + 12)),
    eye: EYE_HEX[look.eyeColour],
    hair: HAIR_HEX[look.hairColour],
    facial: HAIR_HEX[look.facial],
    tusk,
    tuskShade: shade(tusk, -18),
    metal,
    metalLight,
    metalDark,
    paint: PAINT_HEX[look.paintColour],
    burlap,
    burlapDark: shade(burlap, -14),
    leather,
    leatherDark: shade(leather, -10),
    fur,
    furLight: shade(fur, 15),
    team: at(TEAM_HEX, look.team),
    team2: at(TEAM_HEX, look.team2),
    accent: at(ACCENT_HEX, look.hatAccent),
    mouth: '#3a1a16',
    tongue: '#d4606a',
    teeth: '#f4efe0',
  }
}
