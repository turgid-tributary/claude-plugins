import { expect, test } from 'claude-code/testing'

import { svgFor } from '../register'
import type { Prng } from '../vendor/dicebear.js'
import { SLOTS, choose, draw, resolve, traitsFor } from './orc'
import { MOUTH_PROPS } from './orc-parts/body'
import { curlyFits } from './orc-parts/hair'
import { anchorsFor, ears } from './orc-parts/heads'
import { paint } from './orc-parts/marks'
import { HAIR_HEX, METAL_HEX, PAINT_HEX, clashes, eyesShowIn, paletteFor, skinFrom } from './orc-parts/palette'
import { flatten, hex, seeded } from './orc-parts/svg'
import { BUILDS, EXPRESSIONS, HEADS, SKIN_FAMILIES } from './orc-parts/types'
import type { MouthName, Traits } from './orc-parts/types'

const ROOTS = Array.from({ length: 300 }, (_, i) => `/work/repo-${i}`)
/** Text that means a part computed garbage. */
const BROKEN = /NaN|undefined|Infinity|null|hsl\(/

/** What's wrong with a drawing: garbage text, or a number far off the canvas (transforms included). */
function problems(svg: string): string[] {
  const found: string[] = []
  const broken = svg.match(BROKEN)
  if (broken !== null) found.push(broken[0])
  for (const match of svg.replace(/#[0-9a-f]{6}/gi, '').matchAll(/-?\d+(\.\d+)?/g)) {
    const value = Number(match[0])
    if (!(value > -200 && value < 200)) found.push(match[0])
  }
  return found
}

/**
 * Traits that wear `mouth`. A swap only gives a mouth the expression fits (orc.ts, MOUTH_FITS), so
 * this also picks an expression that does; with no mustache or prop to change it, resolve is asked.
 */
function withMouth(traits: Traits, mouth: MouthName): Traits {
  const wears = (expression: Traits['expression']) =>
    resolve({ ...traits, expression, mustache: 'none', prop: 'none', mouthSwap: true, mouthAlt: mouth }).mouth === mouth
  return { ...traits, expression: EXPRESSIONS.find(wears) ?? traits.expression, mouthSwap: true, mouthAlt: mouth }
}

/**
 * What ImageMagick's own SVG renderer (MSVG) would draw wrong (svg.ts): a rotation, or a stroke
 * colour with no stroke-opacity after it.
 */
function magickTraps(svg: string): string[] {
  const found: string[] = []
  for (const [, transform] of svg.matchAll(/transform="([^"]*)"/g)) {
    const rotates = /rotate\((?!0\))/.test(transform ?? '')
    const turns = [...(transform ?? '').matchAll(/matrix\(\S+ (\S+) (\S+)/g)].some(([, b, c]) => Number(b) !== 0 || Number(c) !== 0)
    if (rotates || turns) found.push(transform ?? '')
  }
  found.push(...(svg.match(/ stroke="#[0-9a-f]{6}"(?! stroke-opacity=)/g) ?? []))
  return found
}

/** Draws each variant and collects every problem, labelled, so one check reports them all. */
function check(variants: Iterable<[label: string, traits: Traits]>): string[] {
  const bad: string[] = []
  for (const [label, traits] of variants) {
    const svg = draw(resolve(traits))
    const found = [...problems(svg), ...magickTraps(svg)]
    if (found.length > 0) bad.push(`${label}: ${found.slice(0, 3).join(', ')}`)
  }
  return bad
}

/** The x of every point along an absolute M L C Z path, its curves sampled. */
function xsAlong(data: string): number[] {
  const tokens = data.match(/[MLCZ]|-?[\d.]+/g) ?? []
  const xs: number[] = []
  for (let i = 0; i < tokens.length; ) {
    const op = tokens[i++]
    const x = (j: number) => Number(tokens[i + j])
    if (op === 'M' || op === 'L') {
      xs.push(x(0))
      i += 2
    } else if (op === 'C') {
      const [p0 = 0, p1, p2, p3] = [xs.at(-1), x(0), x(2), x(4)]
      for (let k = 0; k <= 16; k++) {
        const [t, u] = [k / 16, 1 - k / 16]
        xs.push(u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3)
      }
      i += 6
    }
  }
  return xs
}

/**
 * How far each ear reaches from the centre line, stroke included, read from the ears' flattened
 * markup: each is a group placed by translate and scale (or the matrix that flatten folds a droop
 * into), and its first path is the outline.
 */
function earReaches(markup: string): number[] {
  const group = /<g transform="([^"]*)"><path d="([^"]*)"[^>]* stroke-width="([^"]*)"/g
  return [...markup.matchAll(group)].map(([, transform = '', data = '', sw = '']) => {
    const matrix = /matrix\((\S+) \S+ \S+ \S+ (\S+) \S+\)/.exec(transform)
    const placed = /translate\((\S+) \S+\) scale\((\S+)/.exec(transform)
    const [k = NaN, x0 = NaN] = (matrix ? [matrix[1], matrix[2]] : [placed?.[2], placed?.[1]]).map(Number)
    return Math.max(...xsAlong(data).map(x => Math.abs(x0 + k * x - 50) + (Math.abs(k) * Number(sw)) / 2))
  })
}

test('300 repos get 300 different, well-formed orcs', () => {
  const svgs = ROOTS.map(root => svgFor('orc', root))
  expect(new Set(svgs).size).toBe(ROOTS.length)
  for (const svg of svgs) {
    expect(svg).toContain('viewBox="0 0 100 100"')
    expect(svg).not.toMatch(BROKEN)
    // No ids: the style uses none, and its schema turns off DiceBear's clip mask (orc.ts).
    expect(svg).not.toContain(' id="')
    expect(magickTraps(svg)).toEqual([])
    // The desktop Svg element takes at most 131072 characters.
    expect(svg.length).toBeLessThan(131072)
  }
})

// The prng contract (orc.ts): every seed makes the same draws, so a rule change never reshuffles faces.
test('choose makes the same number of draws for every seed', () => {
  const counts = new Set<number>()
  for (const root of ROOTS) {
    const prng = seeded(root)
    let calls = 0
    const counted: Prng = {
      ...prng,
      bool: (likelihood?: number) => (calls++, prng.bool(likelihood)),
      integer: (min: number, max: number) => (calls++, prng.integer(min, max)),
    }
    choose(counted)
    counts.add(calls)
  }
  expect(counts.size).toBe(1)
})

// DiceBear's own prng gave every seed from /work/repo-0 to /work/repo-39 the same first draw.
test('neighbouring repo paths get both builds', () => {
  const builds = Array.from({ length: 12 }, (_, i) => traitsFor(`/work/repo-${i}`).build)
  expect(new Set(builds).size).toBe(2)
})

// DiceBear's prng.integer(min, max) returns max + 1 when its xorshift yields 2^31 − 1.
test('a prng at the top of its range still gives valid traits', () => {
  const top: Prng = {
    seed: 'top',
    next() {},
    bool: () => true,
    integer: (_min: number, max: number) => max + 1,
    pick: <T,>(items: T[], fallback?: T) => items.at(-1) ?? (fallback as T),
    shuffle: <T,>(items: T[]) => items,
    string: (length: number) => 'z'.repeat(length),
  }
  const traits = choose(top)
  for (const [slot, names] of Object.entries(SLOTS)) {
    expect(names as readonly unknown[]).toContain(traits[slot as keyof typeof SLOTS])
  }
  expect(check([['top', traits]])).toEqual([])
})

test('every part draws on every head, for both builds', { timeoutMs: 60_000 }, () => {
  const base = traitsFor('/work/claude-plugins')
  function* variants(): Generator<[string, Traits]> {
    for (const [slot, names] of Object.entries(SLOTS)) {
      for (const name of names) {
        for (const head of HEADS) {
          for (const build of ['peon', 'grunt'] as const) {
            const forced = { ...base, [slot]: name, head, build, mouthSwap: false }
            const traits = slot === 'mouthAlt' ? withMouth(forced, name as MouthName) : forced
            yield [`${slot}=${name} head=${head} build=${build}`, traits]
          }
        }
      }
    }
  }
  expect(check(variants())).toEqual([])
})

test('the parts that meet each other compose: hats, ears, hair, eyewear, mustaches, tusks', { timeoutMs: 60_000 }, () => {
  const base = traitsFor('/work/api')
  function* variants(): Generator<[string, Traits]> {
    for (const hat of SLOTS.hat) {
      for (const head of SLOTS.head) {
        for (const ears of SLOTS.ears) yield [`hat=${hat} head=${head} ears=${ears}`, { ...base, hat, head, ears }]
        for (const hair of SLOTS.hair) yield [`hat=${hat} head=${head} hair=${hair}`, { ...base, hat, head, hair }]
      }
    }
    for (const eyewear of SLOTS.eyewear) {
      for (const expression of SLOTS.expression) {
        for (const scar of SLOTS.scar) {
          yield [`eyewear=${eyewear} expression=${expression} scar=${scar}`, { ...base, eyewear, expression, scar }]
        }
      }
    }
    for (const mustache of SLOTS.mustache) {
      for (const tusks of SLOTS.tusks) {
        for (const mouthAlt of SLOTS.mouthAlt) {
          const traits = { ...withMouth(base, mouthAlt), mustache, tusks }
          yield [`mustache=${mustache} tusks=${tusks} mouth=${mouthAlt}`, traits]
        }
      }
    }
  }
  expect(check(variants())).toEqual([])
})

// An ear's outline stops 3 short of the frame and its stroke reaches 1.75 past that (heads.ts
// earScale), plus the stroke width's rounding: 48.8 from the centre line. Its scale once went
// through n(), which drew a 0.96 ear at 1 and cut its tip flat at the frame.
test('every ear stays on the canvas, under every hat, on every head', () => {
  const base = traitsFor('/work/api')
  const over: string[] = []
  for (const hat of SLOTS.hat) {
    for (const head of SLOTS.head) {
      for (const ear of SLOTS.ears) {
        for (const earLength of [0, 1, 2, 3]) {
          const look = resolve({ ...base, hat, head, ears: ear, earLength })
          const reaches = earReaches(flatten(ears({ look, a: anchorsFor(look), p: paletteFor(look) })))
          if (reaches.length !== 2 || !reaches.every(reach => reach <= 48.8)) {
            over.push(`${hat} ${head} ${ear} ${earLength}: ${reaches.map(reach => reach.toFixed(2)).join(' ')}`)
          }
        }
      }
    }
  }
  expect(over).toEqual([])
})

test('300 repos cover both builds, most hats, monocles and handlebars', () => {
  const looks = ROOTS.map(root => resolve(traitsFor(root)))
  expect(new Set(looks.map(look => look.build)).size).toBe(2)
  expect(new Set(looks.map(look => look.hat)).size).toBeGreaterThanOrEqual(15)
  expect(looks.some(look => look.eyewear === 'monocle')).toBe(true)
  expect(looks.some(look => look.mustache === 'handlebar')).toBe(true)
})

// flatten (svg.ts) bakes rotations into the points for MSVG: (60, 50) turned a quarter about
// (50, 50) lands on (50, 60), as (−50, 60) under the group's leftover translate(100 0).
test('flatten turns the points and keeps only translate and scale', () => {
  expect(flatten('<g transform="rotate(90 50 50)"><circle cx="60" cy="50" r="2"/></g>')).toBe(
    '<g transform="matrix(1 0 0 1 100 0)"><circle cx="-50" cy="60" r="2"/></g>',
  )
  expect(flatten('<g transform="rotate(90)"><rect x="0" y="0" width="4" height="2" fill="#fff"/></g>')).toBe(
    '<g><path d="M0 0 L0 4 L-2 4 L-2 0 Z" fill="#fff"/></g>',
  )
  // Upright transforms (translate, scale, mirrors) pass through untouched.
  const upright = '<g transform="translate(3 4) scale(-1 1)"><path d="M0 0 L1 1"/></g>'
  expect(flatten(upright)).toBe(upright)
})

// At 48 px a metal near the skin's colour loses the monocle's rim, the hoops and the chain, and hair
// or paint near it fades into the face: resolve swaps them (bronze on olive, iron or ash on ash or
// slate, chestnut on rust, ochre on olive, woad on slate) for every skin a family can draw. (The
// chin's stripes are left out: marks.ts draws them in stand-ins for red and bone.)
test('the metal, the hair and the paint always stand apart from the skin', () => {
  const base = traitsFor('/work/api')
  const corners = [0, 50, 100]
  const lost: string[] = []
  for (const family of SKIN_FAMILIES) {
    for (const build of BUILDS) {
      for (const h of corners) {
        for (const s of corners) {
          for (const l of corners) {
            const skin = skinFrom(family, build, { h, s, l })
            const skinHex = hex(skin.h, skin.s, skin.l)
            for (const metal of SLOTS.metal) {
              const look = resolve({ ...base, build, skin, metal })
              if (clashes(METAL_HEX[look.metal][0], skinHex)) lost.push(`${family} ${build} ${metal}`)
            }
            for (const colour of SLOTS.hairColour) {
              for (const grey of [false, true]) {
                const look = resolve({ ...base, build, skin, hairColour: colour, facialColour: colour, facialMatch: false, grey })
                for (const shown of [look.hairColour, look.facial]) {
                  if (clashes(HAIR_HEX[shown], skinHex)) lost.push(`${family} ${build} ${colour} grey=${grey}`)
                }
              }
            }
            for (const paint of ['eye-band', 'claws', 'jaw-bars', 'chevron'] as const) {
              for (const paintColour of SLOTS.paintColour) {
                const look = resolve({ ...base, build, skin, paint, paintColour })
                if (clashes(PAINT_HEX[look.paintColour], skinHex)) lost.push(`${family} ${build} ${paint} ${paintColour}`)
              }
            }
          }
        }
      }
    }
  }
  expect(lost).toEqual([])
})

// A tuft or braid hangs over the middle of any neckwear but the scarf: a gentleman keeps his and
// shaves, anyone else keeps the beard and loses the neckwear.
test('no tuft or braid hangs over neckwear, and a gentleman keeps his', () => {
  const base = traitsFor('/work/api')
  const wrong: string[] = []
  for (const beard of ['tuft', 'braided'] as const) {
    for (const neckwear of SLOTS.neckwear) {
      for (const gent of [false, true]) {
        const look = resolve({ ...base, beard, neckwear, gent, mustache: 'none' })
        const label = `${beard} ${neckwear} gent=${gent}`
        if (look.beard !== 'none' && look.neckwear !== 'none' && look.neckwear !== 'scarf') wrong.push(`${label}: hangs over`)
        if (gent && look.neckwear !== neckwear) wrong.push(`${label}: lost his ${neckwear}`)
      }
    }
  }
  expect(wrong).toEqual([])
})

// Paint and the cheek cross lie under the beard, which would leave only scraps of them; a mustache
// hanging past the mouth frames the chin's daubs and cages the bars beside it, and the chops beside
// it cage the mouth: resolve moves or drops what would show that way.
test('a beard or a hanging mustache leaves no scraps of paint or of the cheek cross, and nothing cages the mouth', () => {
  const base = traitsFor('/work/api')
  const hidden: Record<string, readonly string[]> = {
    full: ['chin-stripes', 'jaw-bars', 'claws'],
    chops: ['jaw-bars', 'claws'],
    tuft: ['chin-stripes'],
    braided: ['chin-stripes'],
  }
  const hanging = ['drooper', 'horseshoe', 'braids']
  const wrong: string[] = []
  for (const beard of SLOTS.beard) {
    for (const mustache of SLOTS.mustache) {
      for (const paint of SLOTS.paint) {
        const look = resolve({ ...base, beard, mustache, paint, scar: 'cheek-x' })
        const label = `${beard} ${mustache} ${paint}`
        if (hidden[look.beard]?.includes(look.paint)) wrong.push(`${label}: paint`)
        if (hanging.includes(look.mustache) && ['chin-stripes', 'jaw-bars'].includes(look.paint)) wrong.push(`${label}: framed`)
        if (['full', 'chops'].includes(look.beard) && look.scar === 'cheek-x') wrong.push(`${label}: cross`)
        if (look.beard === 'chops' && hanging.includes(look.mustache)) wrong.push(`${label}: cage`)
      }
    }
  }
  expect(wrong).toEqual([])
})

// Claws, bars and the chin's daubs give way to the mustache, the mouth, the tusks, the eyewear, a
// mouth prop and the cheek's scar, and may find no room (marks.ts `paintShows`). Resolve moves such
// paint up the face instead (orc.ts `paintUnder`), so paint it keeps always shows, and the busyness
// cap never makes room for paint that isn't there.
test('paint always draws something', { timeoutMs: 60_000 }, () => {
  const base = { ...traitsFor('/work/api'), build: 'grunt' } as const
  function* variants(): Generator<[string, Traits]> {
    for (const root of ROOTS) yield [root, traitsFor(root)]
    for (const name of SLOTS.paint) {
      for (const head of SLOTS.head) {
        for (const mustache of SLOTS.mustache) {
          for (const mouthAlt of SLOTS.mouthAlt) {
            yield [`${name} ${head} ${mustache} ${mouthAlt}`, { ...withMouth(base, mouthAlt), paint: name, head, mustache }]
          }
        }
        // Eyewear moves where the claws start on each side, and a mouth prop or the eye slash which
        // side they take.
        for (const eyewear of SLOTS.eyewear) {
          for (const prop of SLOTS.prop) yield [`${name} ${head} ${eyewear} ${prop}`, { ...base, paint: name, head, eyewear, prop, scar: 'none' }]
          for (const scar of SLOTS.scar) yield [`${name} ${head} ${eyewear} ${scar}`, { ...base, paint: name, head, eyewear, prop: 'none', scar }]
        }
      }
    }
  }
  const empty: string[] = []
  for (const [label, traits] of variants()) {
    const look = resolve(traits)
    if (look.paint !== 'none' && paint({ look, a: anchorsFor(look), p: paletteFor(look) }) === '') empty.push(`${label}: ${look.paint}`)
  }
  expect(empty).toEqual([])
})

// A curly's coils find no room under rims or over a high nose bow, and one coil alone reads as a
// half-drawn mustache: resolve makes it a handlebar there (hair.ts `curlyFits`).
test('a curly mustache always has room for both its coils', () => {
  const base = { ...traitsFor('/work/api'), mustache: 'curly' } as const
  const wrong: string[] = []
  for (const head of SLOTS.head) {
    for (const nose of SLOTS.nose) {
      for (const eyewear of SLOTS.eyewear) {
        for (const jw of [-1, 2]) {
          const look = resolve({ ...base, head, nose, eyewear, jitter: { jw, j: 0, c: 0 } })
          if (look.mustache === 'curly' && !curlyFits(look)) wrong.push(`${head} ${nose} ${eyewear} ${jw}`)
          if (look.mustache !== 'curly' && look.mustache !== 'handlebar') wrong.push(`${head} ${nose} ${eyewear} ${jw}: ${look.mustache}`)
        }
      }
    }
  }
  expect(wrong).toEqual([])
  // Bare eyes over a plain snout keep the curly.
  expect(resolve({ ...base, head: 'brute', nose: 'snout', eyewear: 'none' }).mustache).toBe('curly')
})

// An eye-band keeps its colour (without a cloth hat to clash with) and changes open eyes that would
// vanish in it; shut eyes, dark lines, show only in bone.
test('an eye-band shows the eyes inside it and keeps its colour', () => {
  const base = { ...traitsFor('/work/api'), paint: 'eye-band', hat: 'none', eyewear: 'none' } as const
  const wrong: string[] = []
  for (const paintColour of SLOTS.paintColour) {
    for (const eyeColour of SLOTS.eyeColour) {
      for (const expression of EXPRESSIONS) {
        const look = resolve({ ...base, paintColour, eyeColour, expression })
        const open = [look.eye.p, look.eye.m].every(shape => shape !== 'happy' && shape !== 'closed')
        const label = `${paintColour} ${eyeColour} ${expression}`
        if (open && (look.paintColour !== paintColour || !eyesShowIn(look.paintColour, look.eyeColour))) wrong.push(label)
        if (!open && look.paintColour !== 'bone') wrong.push(`${label} (shut)`)
      }
    }
  }
  expect(wrong).toEqual([])
})

// At 48 px a face with five of the big items reads as noise; the cap (orc.ts) keeps that rare.
test('few faces carry five of hat, eyewear, mustache, beard, mouth prop and neckwear', () => {
  const roots = Array.from({ length: 2000 }, (_, i) => `/work/repo-${i}`)
  const busy = roots.filter(root => {
    const look = resolve(traitsFor(root))
    const big = [look.hat, look.eyewear, look.mustache, look.beard, look.neckwear].filter(name => name !== 'none')
    return big.length + (MOUTH_PROPS.includes(look.prop) ? 1 : 0) >= 5
  })
  expect(busy.length / roots.length).toBeLessThan(0.06)
})
