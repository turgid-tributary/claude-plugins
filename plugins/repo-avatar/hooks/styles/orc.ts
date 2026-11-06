// The orc style: a bold cartoon bust of an orc, a peon (worker) or a grunt (warrior), in one of
// four head shapes, with hats, mustaches, monocles, expressions, war paint and more on top.
//
// `create` runs three steps:
//   choose(prng)    draws every trait, in the fixed order below, from a prng seeded by the seed
//                   string (svg.ts `seeded`: DiceBear's own barely mixes similar repo paths)
//   resolve(traits) applies the rules (a hat hides hair, a monocle opens its eye, ...), no prng
//   draw(look)      stacks the parts from orc-parts/ into SVG
//
// THE PRNG CONTRACT. `choose` makes the same draws, in the same order, for every seed: each slot
// costs exactly one draw whatever it rolls, and tables whose column depends on an earlier draw
// (the gentleman set) still cost one. So a rule change in `resolve` never reshuffles anyone's face.
// Once released, keep the order append-only: a new slot goes at the end. Changing a table's rows or
// weights changes the faces that land on them; that's acceptable, but say so in the CHANGELOG.
// orc.test.ts checks the draw count.
//
// Sides: "side +1" is the drawing's right; the global flip in register.tsx shows it on the
// viewer's left. One-sided parts (monocle, eyepatch, broken tusk) use side +1 on purpose.

import type { Prng, Style } from '../vendor/dicebear.js'
import { BACK_HAIR, BEARD_ROWS, HAIR_ROWS, MUSTACHE_ROWS, backHair, beard, curlyFits, frontHair, mustache } from './orc-parts/hair'
import { CLOTHING_ROWS, MOUTH_PROPS, NECKWEAR_ROWS, PROP_ROWS, SHOULDER_ROWS, backProp, mouthProp, neckwear, shoulders, torso } from './orc-parts/body'
import { EXPRESSION_PRESETS, EXPRESSION_ROWS, NOSE_ROWS, OPEN_MOUTHS, TUSK_ROWS, brows, eyes, mouth, nose, tusks } from './orc-parts/face'
import { EYEWEAR_ROWS, eyewear } from './orc-parts/eyewear'
import { EAR_ROWS, HEAD_ROWS, anchorsFor, ears, head, jaw } from './orc-parts/heads'
import { HAT_INFO, HAT_ROWS, hairShows, hat } from './orc-parts/hats'
import {
  NOSE_RING_CHANCE, PAINT_ROWS, SCAR_ROWS, TUSK_BAND_CHANCE, TUSK_CAP_CHANCE, hoopCount, hoops, noseRing, paint, paintShows,
  scars,
} from './orc-parts/marks'
import {
  EYE_COLOUR_ROWS, EYE_HEX, HAIR_COLOUR_ROWS, HAIR_HEX, METAL_HEX, METAL_ROWS, PAINT_COLOUR_ROWS, PAINT_HEX,
  SKIN_FAMILY_ROWS, TEAM_HEX, TUSK_COLOUR_ROWS, clashes, distance, eyesShowIn, paletteFor, skinFrom,
} from './orc-parts/palette'
import { O, W, at, chance, flatten, g, hex, index, n, range, seeded, weighted } from './orc-parts/svg'
import type { Column } from './orc-parts/svg'
import {
  BEARDS, BUILDS, CLOTHES, EARS, EXPRESSIONS, EYEWEAR, EYE_COLOURS, HAIRS, HAIR_COLOURS, HATS, HEADS, METALS, MOUTHS,
  MUSTACHES, NECKWEAR, NOSES, PAINTS, PAINT_COLOURS, PROPS, SCARS, SHOULDERS, TUSKS, TUSK_COLOURS,
} from './orc-parts/types'
import type {
  BeardName, BrowPose, Ctx, Draw, EyeColour, ExpressionName, EyeShape, EyewearName, HairColour, Look, MouthName,
  MustacheName, NeckwearName, PaintColour, PaintName, Side, Traits,
} from './orc-parts/types'

export const meta: Style['meta'] = { title: 'Orc', creator: 'Joe' }

/**
 * DiceBear's options for this style. `clip: false` drops the <mask id="viewboxMask"> DiceBear wraps
 * every avatar in by default: the root viewport already clips the clothing's overhang, ImageMagick's
 * own renderer painted the mask as an opaque white square, and two inline avatars shared its id.
 */
export const schema = { properties: { clip: { type: 'boolean', default: false } } }

/** The eyewear that makes an orc a gentleman (with or without the hat). */
const GENT_EYEWEAR = ['monocle', 'pince-nez', 'patch-monocle']

/** Draws every trait. The order is the prng contract (see the top of this file): append only. */
export function choose(prng: Prng): Traits {
  const build = prng.bool(50) ? 'grunt' : 'peon'
  const col: Column = build
  const head = weighted(prng, HEAD_ROWS, col)
  const jitter = { jw: range(prng, -1, 2), j: range(prng, -1, 1), c: range(prng, -1, 1) }
  const family = weighted(prng, SKIN_FAMILY_ROWS, col)
  const skin = skinFrom(family, build, { h: index(prng, 101), s: index(prng, 101), l: index(prng, 101) })
  const ears = weighted(prng, EAR_ROWS, col)
  const earLength = range(prng, 0, 3)
  const eyeColour = weighted(prng, EYE_COLOUR_ROWS, col)
  const expression = weighted(prng, EXPRESSION_ROWS, col)
  const mouthSwap = chance(prng, 20)
  const mouthAlt = MOUTHS[index(prng, MOUTHS.length)] ?? 'grim'
  const browJitter = range(prng, -1, 1)
  const bushy = chance(prng, 25)
  const nose = weighted(prng, NOSE_ROWS, col)
  const tusks = weighted(prng, TUSK_ROWS, col)
  const tuskLength = range(prng, 0, 2)
  const tuskColour = weighted(prng, TUSK_COLOUR_ROWS, col)
  const hair = weighted(prng, HAIR_ROWS, col)
  const hairColour = weighted(prng, HAIR_COLOUR_ROWS, col)
  const grey = chance(prng, 5)
  const hat = weighted(prng, HAT_ROWS, col)
  const hatColour = index(prng, 100)
  const hatAccent = index(prng, 100)
  const hatTilt = range(prng, -8, 8)
  const gentHat = HAT_INFO[hat].gent
  const eyewear = weighted(prng, EYEWEAR_ROWS, gentHat ? 'gent' : col)
  const gent = gentHat || GENT_EYEWEAR.includes(eyewear)
  const metal = weighted(prng, METAL_ROWS, gent ? 'gent' : col)
  const mustache = weighted(prng, MUSTACHE_ROWS, gent ? 'gent' : col)
  const beard = weighted(prng, BEARD_ROWS, col)
  const facialMatch = chance(prng, 75)
  const facialColour = weighted(prng, HAIR_COLOUR_ROWS, col)
  const paint = weighted(prng, PAINT_ROWS, col)
  const paintColour = weighted(prng, PAINT_COLOUR_ROWS, col)
  const scar = weighted(prng, SCAR_ROWS, col)
  const hoops = hoopCount(build, index(prng, 100))
  const hoopsBoth = chance(prng, 60)
  const noseRing = chance(prng, NOSE_RING_CHANCE[build])
  const tuskBands = chance(prng, TUSK_BAND_CHANCE[build])
  const tuskCaps = chance(prng, TUSK_CAP_CHANCE[build])
  const clothing = weighted(prng, CLOTHING_ROWS, col)
  const shoulders = weighted(prng, SHOULDER_ROWS, col)
  const clothTone = index(prng, 100)
  const team = index(prng, 100)
  const team2 = index(prng, 100)
  const neckwear = weighted(prng, NECKWEAR_ROWS, gent ? 'gent' : col)
  const neckColour = index(prng, 100)
  const prop = weighted(prng, PROP_ROWS, gent ? 'gent' : col)
  return {
    build, head, jitter, skin, ears, earLength, eyeColour, expression, mouthSwap, mouthAlt, browJitter, bushy, nose,
    tusks, tuskLength, tuskColour, hair, hairColour, grey, hat, hatColour, hatAccent, hatTilt, gent, eyewear, metal,
    mustache, beard, facialMatch, facialColour, paint, paintColour, scar, hoops, hoopsBoth, noseRing, tuskBands,
    tuskCaps, clothing, shoulders, clothTone, team, team2, neckwear, neckColour, prop,
  }
}

/** How much a 48 px face holds before it turns to noise, in the units `mass` counts in resolve. */
const BUSY_LIMIT = 5

/** Paint that covers much of the face, and eyewear that hides both eyes: each weighs 2. */
const BIG_PAINT: readonly PaintName[] = ['eye-band', 'chevron', 'skull']
const BIG_EYEWEAR: readonly EyewearName[] = ['goggles', 'shades']
/** Paint thin enough that black vanishes into dark skin at 48 px: there, black bars were wrinkles. */
const THIN_PAINT: readonly PaintName[] = ['claws', 'jaw-bars', 'chin-stripes', 'chevron']
/** Skin lightness (HSL l) below which thin black paint goes bone. */
const DARK_SKIN = 44
/**
 * The colours the chin's stripes are drawn in instead of red (blood, under the mouth) and bone
 * (more teeth). A copy of marks.ts CHIN_STAND_IN, so resolve weighs the colour that shows: keep the
 * two in step.
 */
const CHIN_STAND_IN: Partial<Record<PaintColour, PaintColour>> = { red: 'ochre', bone: 'woad' }

/**
 * The gentle expressions a peon's red eyes would make look possessed: they soften to amber. A
 * grunt's red eyes are his war fury, so they stay.
 */
const GENTLE: readonly ExpressionName[] = ['dopey', 'worried', 'startled', 'cheerful', 'blep']
/**
 * How far fel eyes must be from the skin. They're a lighter tint of a light peon's own green, so a
 * clash's 115 isn't enough: up to about 165 they read as pale rings of skin, and narrowed ones
 * vanish; from 200 they glow. A third of green peons are nearer than this.
 */
const FEL_APART = 180
/** The eye colours an eye-band gives eyes that would vanish in it, in order of preference. */
const BAND_EYES: readonly EyeColour[] = ['yellow', 'bone', 'ice', 'amber']
/** Beards that hang from the chin's middle, over whatever neckwear hangs there (all but the scarf). */
const HANGING_BEARDS: readonly BeardName[] = ['tuft', 'braided']
/** Mustaches whose ends hang past the mouth's corners, down beside the tusks. */
const HANGING_MUSTACHES: readonly MustacheName[] = ['drooper', 'horseshoe', 'braids']

/**
 * The mustaches that cover the whole upper lip. Tusks drawn over one of these stand in a dark band
 * between two lips, which at 48 px reads as a gaping, fanged mouth, so they go behind it (`lip`)
 * and only their tips and roots show. Thin ones (pencil, drooper, horseshoe, braids) leave the lip
 * bare round the tusks, which stay in front.
 */
const WIDE_MUSTACHES: readonly MustacheName[] = ['walrus', 'chevron', 'imperial', 'handlebar', 'curly']

/**
 * The mouths a swap (`mouthSwap`, 20% of orcs) may give each expression besides its own: ones its
 * eyes and brows still read with (a sleepy roar is a yawn, a cheerful one a belly laugh). A swapped
 * mouth outside the list lands on one in it, so swaps stay as common and the prng is untouched.
 */
const MOUTH_FITS: Record<ExpressionName, readonly MouthName[]> = {
  scowl: ['frown', 'snarl', 'roar', 'grin', 'smirk'],
  snarl: ['grim', 'frown', 'roar', 'grin', 'smirk'],
  roar: ['snarl', 'gape', 'grin', 'frown', 'grim'],
  grumpy: ['grim', 'wavy', 'smirk', 'snarl'],
  smug: ['grin', 'grim', 'tongue'],
  skeptic: ['smirk', 'grim', 'frown'],
  manic: ['roar', 'gape', 'tongue', 'wavy', 'snarl'],
  cheerful: ['smirk', 'tongue', 'gape', 'roar'],
  dopey: ['tongue', 'ooh', 'wavy', 'grin', 'grim', 'smirk'],
  worried: ['frown', 'ooh', 'gape', 'grim', 'grin'],
  startled: ['gape', 'wavy', 'roar'],
  sleepy: ['grim', 'gape', 'roar', 'smirk'],
  wink: ['grin', 'tongue', 'ooh'],
  blep: ['grin', 'smirk'],
}

/**
 * The neckwear a beard leaves. A full beard hides a bow tie, and the fangs of a tooth necklace or
 * the spikes of a collar would hang below it like a second mouth: they become the amulet, whose
 * pendant clears it. A tuft or braid hangs over the middle of all of them but the scarf, which
 * wraps wide: a bow tie shows only its wings, a cravat two fang-like ruffles, fangs flank it like a
 * second jaw. The neckwear goes (a gentleman shaves instead, in resolve, so he never gets here).
 */
function neckwearUnder(t: Traits): NeckwearName {
  if (t.beard === 'full' && t.neckwear === 'bow-tie') return 'none'
  if (t.beard === 'full' && (t.neckwear === 'tooth-necklace' || t.neckwear === 'spiked-collar')) return 'amulet'
  if (HANGING_BEARDS.includes(t.beard) && t.neckwear !== 'scarf') return 'none'
  return t.neckwear
}

/**
 * The lower face's paint, and what each gives way to, up the face: the chin's daubs to the cheeks'
 * bars, the bars to the claws, the claws to the eye-band, which always shows.
 */
const PAINT_LADDER: Partial<Record<PaintName, PaintName>> = { 'chin-stripes': 'jaw-bars', 'jaw-bars': 'claws', claws: 'eye-band' }

/**
 * The lower face's paint that each beard leaves only scraps of. Paint lies under the beard: a full
 * beard leaves a strip of chin daubs under the lip (a painted lower lip), stops bars dead at its
 * edge and leaves the claws' roots as a red tick above it (a cut); the chops leave stubs of bars or
 * claws between their tops and the eye (a cut, or blood); a tuft or braid hangs between the chin's
 * daubs, like a second mustache.
 */
const BEARD_HIDES: Record<BeardName, readonly PaintName[]> = {
  none: [],
  full: ['chin-stripes', 'jaw-bars', 'claws'],
  chops: ['jaw-bars', 'claws'],
  tuft: ['chin-stripes'],
  braided: ['chin-stripes'],
}

/**
 * The paint that shows. Lower-face paint the beard hides, that a hanging mustache crowds (its
 * strands frame the chin's daubs as a badge where the lip should be, and stand beside the bars as
 * a cage), or that finds no room (marks.ts `paintShows`: claws under a wide mustache, the chin's
 * daubs under an open mouth) gives way up `PAINT_LADDER`, so a grunt keeps his paint and nothing
 * counts paint that never shows.
 */
function paintUnder(look: Look): PaintName {
  const a = anchorsFor(look)
  const crowded = (name: PaintName) =>
    BEARD_HIDES[look.beard].includes(name) ||
    (HANGING_MUSTACHES.includes(look.mustache) && (name === 'chin-stripes' || name === 'jaw-bars'))
  let shown = look.paint
  for (let next = PAINT_LADDER[shown]; next !== undefined; next = PAINT_LADDER[shown]) {
    if (!crowded(shown) && paintShows({ ...look, paint: shown }, a)) break
    shown = next
  }
  return shown
}

const greyOf = (colour: HairColour): HairColour => (colour === 'white' ? 'white' : 'ash')
/** An eye under a monocle must show its pupil. */
const opened = (shape: EyeShape | null): EyeShape | null =>
  shape === 'closed' || shape === 'happy' || shape === 'sleepy' ? 'round' : shape
/** The monocle's brow clamps down onto its rim. */
const ontoRim = (pose: BrowPose): BrowPose => ({ inner: Math.max(pose.inner, 1), outer: Math.max(pose.outer, 1) })

/** Applies the rules. Pure: no prng, so rules can change without reshuffling faces. */
export function resolve(traits: Traits): Look {
  const t = { ...traits }
  const info = HAT_INFO[t.hat]
  const preset = EXPRESSION_PRESETS[t.expression]
  const jittered = (pose: BrowPose): BrowPose => ({ inner: pose.inner + t.browJitter, outer: pose.outer + t.browJitter })

  const eye: Look['eye'] = { p: preset.eye, m: preset.eyeAlt ?? preset.eye }
  const brow: Look['brow'] = { p: jittered(preset.brow), m: jittered(preset.browAlt ?? preset.brow) }
  const fits = MOUTH_FITS[t.expression]
  const swapped = fits.includes(t.mouthAlt) ? t.mouthAlt : at(fits, MOUTHS.indexOf(t.mouthAlt))
  let mouth = t.mouthSwap ? swapped : preset.mouth
  let scarSide: Side = -1
  const skin = hex(t.skin.h, t.skin.s, t.skin.l)

  // A peon's red eyes on a gentle face look possessed: they soften to amber.
  if (t.build === 'peon' && t.eyeColour === 'red' && GENTLE.includes(t.expression)) t.eyeColour = 'amber'
  // Fel eyes too near the skin's own green (a light peon's) go ice, the other uncanny glow.
  if (t.eyeColour === 'fel' && distance(EYE_HEX.fel, skin) < FEL_APART) t.eyeColour = 'ice'
  // Fel-green eyes glow.
  if (t.eyeColour === 'fel') {
    for (const side of ['p', 'm'] as const) {
      if (eye[side] === 'round' || eye[side] === 'glare') eye[side] = 'glowing'
    }
  }

  // Bat or droopy ears on rust's mud brown read as a bat or a dog, not an orc: they grow long.
  if (t.skin.family === 'rust' && (t.ears === 'bat' || t.ears === 'droopy')) t.ears = 'long'
  // Goggles can't rest on a forehead the hat covers: they go over the eyes.
  if (t.eyewear === 'brow-goggles' && info.coversForehead) t.eyewear = 'goggles'

  // The monocle (side +1): its eye open, its brow clamped onto the rim, the other brow raised.
  if (t.eyewear === 'monocle') {
    eye.p = opened(eye.p)
    brow.p = ontoRim(brow.p)
    if (brow.m.inner > -2) brow.m = { inner: -3, outer: -3 }
  }
  // The eyepatch (side +1) hides its eye; a wink moves to the other eye as a squint.
  if (t.eyewear === 'eyepatch' || t.eyewear === 'patch-monocle') {
    eye.p = null
    if (eye.m === 'closed') eye.m = 'slit'
  }
  // Patch and monocle: the monocle takes the other eye (side −1).
  if (t.eyewear === 'patch-monocle') {
    eye.m = opened(eye.m)
    brow.m = ontoRim(brow.m)
  }

  // The eye slash goes on side −1, unless that's under the monocle: under a patch it moves to +1
  // and peeks out round it; with patch and monocle there's no free eye, so it's dropped. It's
  // dropped too where nothing of it would show: goggles, shades or a patch below a hat's brim.
  if (t.scar === 'eye-slash') {
    if (t.eyewear === 'eyepatch') scarSide = 1
    const covered = BIG_EYEWEAR.includes(t.eyewear) || t.eyewear === 'eyepatch'
    if (t.eyewear === 'patch-monocle' || (covered && info.coversForehead)) t.scar = 'none'
  }

  // A full beard swallows a drooper into a walrus. (What it does to neckwear and paint waits for
  // the cap.)
  if (t.beard === 'full' && t.mustache === 'drooper') t.mustache = 'walrus'
  // A braids mustache over a braided beard hangs three banded plaits from the mouth: a grille at
  // 48 px. The beard goes.
  if (t.mustache === 'braids' && t.beard === 'braided') t.beard = 'none'
  // Chops beside a mustache that hangs past the mouth make four bars down the lower face, the
  // tusks between them: a cage over the mouth. The chops go.
  if (t.beard === 'chops' && HANGING_MUSTACHES.includes(t.mustache)) t.beard = 'none'
  // A gentleman keeps his neckwear, his kit, and shaves a tuft or braid that would hang over it
  // (`neckwearUnder` takes the neckwear from anyone else).
  if (t.gent && HANGING_BEARDS.includes(t.beard) && t.neckwear !== 'none' && t.neckwear !== 'scarf') t.beard = 'none'
  // A walrus covers the mouth: no roar under it, and no nose ring over it.
  if (t.mustache === 'walrus') {
    if (mouth === 'roar') mouth = 'snarl'
    t.noseRing = false
  }
  // Tusks behind a wide mustache hide their bands and caps: they go, and spare the busyness cap.
  if (WIDE_MUSTACHES.includes(t.mustache)) {
    t.tuskBands = false
    t.tuskCaps = false
  }
  // Something in the mouth needs a closed mouth.
  if (MOUTH_PROPS.includes(t.prop) && OPEN_MOUTHS.includes(mouth)) t.prop = 'none'
  // A split lip shows only through a bare, shut mouth: a mustache leaves just its lower stitch, a
  // dark mark on the chin, and an open mouth covers its middle, leaving two blobs. It becomes the
  // stitched cut by the eye, clear of the mouth.
  if (t.scar === 'split-lip' && (t.mustache !== 'none' || OPEN_MOUTHS.includes(mouth))) t.scar = 'stitches'

  // Metal near the skin's colour (bronze on olive or rust, iron on ash or slate) loses the monocle's
  // rim, the hoops and the chain at 48 px. It brightens within its kind (warm bronze to gold, grey
  // iron to silver), else takes the other bright metal; silver clashes with no skin.
  if (clashes(METAL_HEX[t.metal][0], skin)) {
    const brighter = t.metal === 'iron' || t.metal === 'silver' ? (['silver', 'gold'] as const) : (['gold', 'silver'] as const)
    t.metal = brighter.find(metal => !clashes(METAL_HEX[metal][0], skin)) ?? 'silver'
  }

  // Hair under hats: most hats hide front hair, some let it poke through, and a small perched hat
  // leaves low hair showing round it (hats.ts `hairShows`); back hair always shows.
  const hasFront = t.hair !== 'bald' && !BACK_HAIR.includes(t.hair)
  const frontHair = hasFront && hairShows(t.hat, t.hair)
  const crest = t.hair === 'mohawk' && (t.hat === 'horned-helm' || t.hat === 'spiked-helm')
  const shine = t.hat === 'none' && (t.hair === 'bald' || t.hair === 'tuft' || BACK_HAIR.includes(t.hair))

  // Hair near the skin's colour (ash on ash, slate, olive or a dull green; chestnut or rust on rust)
  // fades into the face at 48 px, as metal does. Grey goes white; any other colour black, else
  // brown (black on the darkest grunt green), else white, which clashes with no skin.
  const clearOfSkin = (colour: HairColour): HairColour => {
    if (!clashes(HAIR_HEX[colour], skin)) return colour
    const near = colour === 'ash' ? (['white', 'black'] as const) : (['black', 'brown', 'white'] as const)
    return near.find(other => !clashes(HAIR_HEX[other], skin)) ?? 'white'
  }
  if (t.grey) t.hairColour = greyOf(t.hairColour)
  t.hairColour = clearOfSkin(t.hairColour)
  let facial = t.facialMatch ? t.hairColour : t.facialColour
  if (t.grey) facial = greyOf(facial)
  facial = clearOfSkin(facial)

  const tilt = Math.max(-info.maxTilt, Math.min(info.maxTilt, t.hatTilt))
  // A droopy ear already hangs below the brim: tipped the hat's whole way, it ran straight down the
  // cheek like a bob or a dog's flap, and lost its point. It tips half as far.
  const earDroop = t.ears === 'droopy' ? info.earDroop / 2 : info.earDroop
  // The look as the rules leave it so far: what `paintUnder` fits the paint to.
  const look = (): Look => ({ ...t, eye, brow, mouth, frontHair, crest, shine, tilt, earDroop, scarSide, facial })

  // A curly's coils need room beside the eyes: under rims, or on a bean with a high bow under the
  // nose, one or both won't fit (hair.ts `curlyFits`), and a coil on one side only reads as a
  // half-drawn mustache. It curls as a handlebar instead, whose slim hook clears them. Head, nose and
  // eyewear are final by here; both are wide mustaches, so the rules above read them alike.
  if (t.mustache === 'curly' && !curlyFits(look())) t.mustache = 'handlebar'

  // The busyness cap. Every extra counts 1 (the hat and hair poking through it too), and what
  // covers much of the face (a full beard, goggles or shades, a band, chevron or skull of paint)
  // counts 2. Over the limit, drop the small extras, then a beard under a mustache, then a mouth
  // prop and neckwear (but a gentleman's, which are his kit), then the scar, then a gentleman
  // grunt's pipe or cigar, and the war paint last: it's the grunt's own, and without it a grunt in
  // a top hat is a peon in pauldrons. The hat, eyewear and mustache always stay. Neckwear and paint
  // count as they'll be drawn (`neckwearUnder`, `paintUnder`).
  const mass = () => {
    const painted = paintUnder(look())
    return [
      t.hat !== 'none',
      (frontHair && t.hat !== 'none') || crest,
      t.eyewear !== 'none',
      BIG_EYEWEAR.includes(t.eyewear),
      t.mustache !== 'none',
      t.beard !== 'none',
      t.beard === 'full',
      painted !== 'none',
      BIG_PAINT.includes(painted),
      t.scar !== 'none',
      neckwearUnder(t) !== 'none',
      MOUTH_PROPS.includes(t.prop),
      t.hoops > 0,
      t.noseRing,
      t.tuskBands,
      t.tuskCaps,
    ].filter(Boolean).length
  }
  const drops: (() => void)[] = [
    () => (t.tuskBands = false),
    () => (t.tuskCaps = false),
    () => (t.noseRing = false),
    () => (t.hoops = 0),
    () => {
      if (t.mustache !== 'none') t.beard = 'none'
    },
    () => {
      if (!t.gent && MOUTH_PROPS.includes(t.prop)) t.prop = 'none'
    },
    () => {
      if (!t.gent) t.neckwear = 'none'
    },
    () => (t.scar = 'none'),
    () => {
      if (t.build === 'grunt' && MOUTH_PROPS.includes(t.prop)) t.prop = 'none'
    },
    () => (t.paint = 'none'),
  ]
  for (const drop of drops) {
    if (mass() <= BUSY_LIMIT) break
    drop()
  }

  // Now the cap has had its say, the beard settles the neckwear and the cheek's scar, and the paint
  // settles round them (`paintUnder`). The cheek cross, half buried under a full beard's band or the
  // chops and the tusk beside them, becomes the stitches by the eye.
  t.neckwear = neckwearUnder(t)
  if ((t.beard === 'full' || t.beard === 'chops') && t.scar === 'cheek-x') t.scar = 'stitches'
  t.paint = paintUnder(look())

  // The paint's colour, for the paint that shows. Thin black paint vanishes into dark skin at 48 px:
  // it goes bone.
  const sinks = (colour: PaintColour) => colour === 'black' && t.skin.l < DARK_SKIN && THIN_PAINT.includes(t.paint)
  if (sinks(t.paintColour)) t.paintColour = 'bone'
  // Paint near the skin's colour, as drawn (ochre on olive, woad on slate), fades as well, and the
  // grunt's mark with it: it takes red, else bone, else black where black doesn't sink. (Only the
  // chin, whose red is ochre, gets past red: its bone is woad, and black there read as a frown line.)
  const shown = (colour: PaintColour) => PAINT_HEX[t.paint === 'chin-stripes' ? (CHIN_STAND_IN[colour] ?? colour) : colour]
  const fades = (colour: PaintColour) => sinks(colour) || clashes(shown(colour), skin)
  if (fades(t.paintColour)) t.paintColour = (['red', 'bone', 'black'] as const).find(colour => !fades(colour)) ?? 'bone'
  // An eye-band must show the eyes inside it and stand apart from a cloth hat just above it. Shut
  // eyes are dark lines only bone shows. Otherwise the band keeps its colour if the hat leaves it
  // (else bone, else black), and open eyes near that colour (red eyes in red paint) change instead,
  // so the red band across glowing eyes stays the common one.
  if (t.paint === 'eye-band') {
    const shut = eye.p === 'happy' || eye.p === 'closed' || eye.m === 'happy' || eye.m === 'closed'
    const hat = t.hat === 'bandana' || t.hat === 'beanie' ? at(TEAM_HEX, t.team) : null
    const clearOfHat = (colour: PaintColour) => hat === null || !clashes(PAINT_HEX[colour], hat)
    const band = shut ? 'bone' : (([t.paintColour, 'bone', 'black'] as const).find(clearOfHat) ?? 'bone')
    t.paintColour = band
    if (!shut && !eyesShowIn(band, t.eyeColour)) t.eyeColour = BAND_EYES.find(colour => eyesShowIn(band, colour)) ?? t.eyeColour
  }
  return look()
}

/** Layers 16-17: the mustache and the tusks, the tusks behind a wide mustache. */
const lip: Draw = ctx =>
  WIDE_MUSTACHES.includes(ctx.look.mustache) ? tusks(ctx) + mustache(ctx) : mustache(ctx) + tusks(ctx)

/** The layers, bottom to top. */
const LAYERS: readonly Draw[] = [
  backProp, backHair, torso, shoulders, neckwear, ears, hoops, head, jaw, paint, scars, eyes, brows, nose, beard,
  mouth, lip, mouthProp, noseRing, frontHair, eyewear,
]

/**
 * Stacks every part into the SVG body, then bakes the rotations (hat tilt, ear droop, braids,
 * props) into coordinates, since ImageMagick's own renderer turns them the wrong way.
 */
export function draw(look: Look): string {
  const ctx: Ctx = { look, a: anchorsFor(look), p: paletteFor(look) }
  const tilt = look.tilt === 0 ? {} : { transform: `rotate(${n(look.tilt)} 50 ${n(ctx.a.SEAT)})` }
  const body = LAYERS.map(layer => layer(ctx)).join('') + g(hat(ctx), tilt)
  return flatten(g(body, { fill: 'none', stroke: O, sw: W.feature, cap: 'round', join: 'round' }))
}

/** The orc for a seed, drawn from the style's own well-mixed prng (see `seeded` in svg.ts). */
export function traitsFor(seed: string): Traits {
  return choose(seeded(seed))
}

export const create: Style['create'] = ({ prng }) => ({
  attributes: { viewBox: '0 0 100 100' },
  body: draw(resolve(traitsFor(prng.seed))),
})

/** Each choosable trait's names, for tests and previews that force a part. */
export const SLOTS = {
  build: BUILDS, head: HEADS, ears: EARS, eyeColour: EYE_COLOURS, expression: EXPRESSIONS, mouthAlt: MOUTHS,
  nose: NOSES, tusks: TUSKS, tuskColour: TUSK_COLOURS, hair: HAIRS, hairColour: HAIR_COLOURS, hat: HATS,
  eyewear: EYEWEAR, metal: METALS, mustache: MUSTACHES, beard: BEARDS, paint: PAINTS, paintColour: PAINT_COLOURS,
  scar: SCARS, clothing: CLOTHES, shoulders: SHOULDERS, neckwear: NECKWEAR, prop: PROPS,
} as const
