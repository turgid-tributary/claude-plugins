// The orc style's vocabulary: every slot's names, the traits the seed draws, and the resolved look
// the parts draw from. Part modules implement a drawing for every name here (`Record<Name, ...>`),
// so adding a name means drawing it.
//
// Import types from here with `import type`: the preview tooling strips types without a compiler.

import type { Palette } from './palette'

export const BUILDS = ['peon', 'grunt'] as const
export const HEADS = ['brute', 'bean', 'dome', 'lantern'] as const
export const SKIN_FAMILIES = ['green', 'olive', 'ash', 'rust', 'slate'] as const
export const EARS = ['long', 'swept', 'droopy', 'bat', 'notched', 'torn', 'stub'] as const
export const EYE_COLOURS = ['red', 'amber', 'yellow', 'orange', 'bone', 'ice', 'fel'] as const
export const EXPRESSIONS = [
  'scowl', 'snarl', 'roar', 'grumpy', 'smug', 'skeptic', 'manic',
  'cheerful', 'dopey', 'worried', 'startled', 'sleepy', 'wink', 'blep',
] as const
export const EYE_SHAPES = ['round', 'wide', 'slit', 'glare', 'sleepy', 'happy', 'closed', 'glowing'] as const
export const MOUTHS = ['grim', 'frown', 'smirk', 'wavy', 'snarl', 'roar', 'grin', 'gape', 'tongue', 'ooh'] as const
export const NOSES = ['snout', 'flat', 'pug', 'button', 'hooked', 'broken'] as const
export const TUSKS = ['pair', 'stubs', 'big', 'broken', 'single', 'boar', 'double'] as const
export const TUSK_COLOURS = ['ivory', 'old', 'grey'] as const
export const HAIRS = ['bald', 'tuft', 'topknot', 'mohawk', 'spikes', 'ponytail', 'braids', 'fringe'] as const
export const HAIR_COLOURS = ['black', 'brown', 'chestnut', 'rust', 'ash', 'white'] as const
export const MUSTACHES = [
  'none', 'handlebar', 'walrus', 'imperial', 'pencil', 'chevron', 'horseshoe', 'drooper', 'curly', 'braids',
] as const
export const BEARDS = ['none', 'tuft', 'braided', 'chops', 'full'] as const
export const HATS = [
  'none', 'top-hat', 'tiny-top-hat', 'bowler', 'boater', 'fez', 'tricorn', 'crown', 'pith', 'flat-cap',
  'captain', 'horned-helm', 'spiked-helm', 'skull-helm', 'bandana', 'feather-band', 'straw', 'hard-hat',
  'miner', 'beanie', 'propeller', 'toque', 'party',
] as const
export const EYEWEAR = [
  'none', 'monocle', 'pince-nez', 'spectacles', 'goggles', 'brow-goggles', 'eyepatch', 'patch-monocle', 'shades',
] as const
export const METALS = ['gold', 'silver', 'bronze', 'iron'] as const
export const PAINTS = ['none', 'eye-band', 'claws', 'jaw-bars', 'chin-stripes', 'chevron', 'skull', 'mud'] as const
export const PAINT_COLOURS = ['red', 'bone', 'black', 'ochre', 'woad'] as const
export const SCARS = ['none', 'eye-slash', 'cheek-x', 'stitches', 'split-lip'] as const
export const CLOTHES = [
  'burlap-v', 'burlap-round', 'burlap-patched', 'burlap-rope', 'burlap-strap', 'harness', 'vest', 'mail', 'tabard',
] as const
export const SHOULDERS = ['none', 'spiked', 'great', 'fur', 'plate', 'bone'] as const
export const NECKWEAR = ['none', 'bow-tie', 'cravat', 'tooth-necklace', 'amulet', 'spiked-collar', 'scarf'] as const
/** `pickaxe` rides behind the shoulder; the rest sit in the mouth. */
export const PROPS = ['none', 'pipe', 'cigar', 'wheat', 'toothpick', 'pickaxe'] as const

export type Build = (typeof BUILDS)[number]
export type HeadName = (typeof HEADS)[number]
export type SkinFamily = (typeof SKIN_FAMILIES)[number]
export type EarName = (typeof EARS)[number]
export type EyeColour = (typeof EYE_COLOURS)[number]
export type ExpressionName = (typeof EXPRESSIONS)[number]
export type EyeShape = (typeof EYE_SHAPES)[number]
export type MouthName = (typeof MOUTHS)[number]
export type NoseName = (typeof NOSES)[number]
export type TuskName = (typeof TUSKS)[number]
export type TuskColour = (typeof TUSK_COLOURS)[number]
export type HairName = (typeof HAIRS)[number]
export type HairColour = (typeof HAIR_COLOURS)[number]
export type MustacheName = (typeof MUSTACHES)[number]
export type BeardName = (typeof BEARDS)[number]
export type HatName = (typeof HATS)[number]
export type EyewearName = (typeof EYEWEAR)[number]
export type MetalName = (typeof METALS)[number]
export type PaintName = (typeof PAINTS)[number]
export type PaintColour = (typeof PAINT_COLOURS)[number]
export type ScarName = (typeof SCARS)[number]
export type ClothingName = (typeof CLOTHES)[number]
export type ShoulderName = (typeof SHOULDERS)[number]
export type NeckwearName = (typeof NECKWEAR)[number]
export type PropName = (typeof PROPS)[number]

/** +1 is the drawing's right (x > 50); the global flip shows it on the viewer's LEFT. */
export type Side = 1 | -1

/**
 * Where a brow ridge sits, in units below the brow line B (negative raises it): `inner` is the end
 * by the nose, `outer` the end by the ear. An angry V has inner > outer.
 */
export interface BrowPose {
  inner: number
  outer: number
}

/** Everything the seed draws, before the rules in `resolve`. */
export interface Traits {
  build: Build
  head: HeadName
  /** Head jitter: jaw half-width −1..2, jaw bottom −1..1, crown −1..1. */
  jitter: { jw: number; j: number; c: number }
  skin: { family: SkinFamily; h: number; s: number; l: number }
  ears: EarName
  /** 0..3: each step lengthens the ear a little. */
  earLength: number
  eyeColour: EyeColour
  expression: ExpressionName
  /** When true, `mouthAlt` replaces the expression's mouth. */
  mouthSwap: boolean
  mouthAlt: MouthName
  /** −1..1, added to both ends of both brows. */
  browJitter: number
  bushy: boolean
  nose: NoseName
  tusks: TuskName
  /** 0..2: each step lengthens the tusks a little. */
  tuskLength: number
  tuskColour: TuskColour
  hair: HairName
  hairColour: HairColour
  grey: boolean
  hat: HatName
  /** 0..99: an index into the hat's own colour list (taken modulo its length). */
  hatColour: number
  /** 0..99: an index into the accent list (bands, bow ties, trims). */
  hatAccent: number
  /** −8..8 degrees, before the hat's own limit. */
  hatTilt: number
  /** The gentleman set: a gentleman hat, or a monocle or pince-nez. Switches some tables. */
  gent: boolean
  eyewear: EyewearName
  metal: MetalName
  mustache: MustacheName
  beard: BeardName
  facialMatch: boolean
  facialColour: HairColour
  paint: PaintName
  paintColour: PaintColour
  scar: ScarName
  /** Ear hoops, 0..3 per ear. */
  hoops: number
  hoopsBoth: boolean
  noseRing: boolean
  tuskBands: boolean
  tuskCaps: boolean
  clothing: ClothingName
  shoulders: ShoulderName
  /** 0..99: picks burlap, leather and fur tones. */
  clothTone: number
  /** 0..99 each: indices into the team colours (tabards, bandanas, beanies, scarves). */
  team: number
  team2: number
  neckwear: NeckwearName
  /** 0..99: an index into the neckwear's colour list. */
  neckColour: number
  prop: PropName
}

/** The look the parts draw: the traits after `resolve`'s rules, plus what the rules worked out. */
export interface Look extends Traits {
  /** Each eye's shape by side; null when the eye is hidden (under an eyepatch). */
  eye: { p: EyeShape | null; m: EyeShape | null }
  brow: { p: BrowPose; m: BrowPose }
  mouth: MouthName
  /** Front hair shows (tuft, topknot, mohawk, spikes, fringe); false under most hats. */
  frontHair: boolean
  /** A mohawk under a horned or spiked helm, drawn as the helmet's crest. */
  crest: boolean
  /** The bald scalp's shine: only bare-headed. */
  shine: boolean
  /** The hat's tilt in degrees, within its limit. */
  tilt: number
  /** Degrees the ears tip down so a wide brim clears them. */
  earDroop: number
  /** The side the eye-slash scar goes on. */
  scarSide: Side
  /** The hair colour of mustache and beard. */
  facial: HairColour
}

/** The chosen head's anchor lines and widths, in viewBox units. Every part places itself by these. */
export interface Anchors {
  /** Crown: the top of the skull. */
  C: number
  /** Where a hat's band sits; the skull is almost full width here. */
  SEAT: number
  /** Skull half-width (at SEAT and down to the brow). A hat band of SW+2 covers the skull's edge. */
  SW: number
  /** Brow line: the centre of the brow ridge. Hats stop at B−3. */
  B: number
  /** Eye centres' y. */
  E: number
  /** Eye half-spacing: eyes at x = 50 ± ED. */
  ED: number
  /** Nose (tip and nostrils) y. */
  N: number
  /** Mouth line y: the top of the jutting lower jaw. */
  M: number
  /** Jaw bottom (chin) y. */
  J: number
  /** Cheek half-width, at N. */
  CW: number
  /** Jaw half-width, at the jaw corner (M+6). */
  JW: number
  /** Mouth half-width. */
  MW: number
  /** Tusk x offset: tusks at x = 50 ± TD. */
  TD: number
  /** Ear root: x offset from the centre line, and y. */
  earX: number
  earY: number
  /** Where neckwear sits (just under the chin). */
  COLLAR: number
  /** Top of the shoulders. */
  SHOULDER: number
}

/** What every part drawing receives. */
export interface Ctx {
  look: Look
  a: Anchors
  p: Palette
}

/** A part drawing: returns SVG markup, or '' for nothing. */
export type Draw = (ctx: Ctx) => string
