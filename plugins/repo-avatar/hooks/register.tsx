import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Avatar } from '../types'
import { customStyles } from './styles/index'
import { createAvatar, styles } from './vendor/dicebear.js'
import type { Style } from './vendor/dicebear.js'

/** The avatar's box on the terminal: 8 columns by 4 rows is about square in a 1:2 cell. */
export const ROWS = 4
export const COLUMNS = 8
/** The band needs this many columns beside the avatar, or it leaves the band alone. */
const MIN_SPARE_COLUMNS = 20
/** Pixels per side of the PNG the terminal draws. */
const PX = 256
/** Desktop's avatar, CSS pixels per side. */
const SVG_PX = 48
export const DEFAULT_STYLE = 'orc'
const CONVERT_TIMEOUT_MS = 15_000
/** Mirror every avatar left to right, so it faces the other way. */
const FLIP = true

// Change the tag when Avatar's fields change: it declines what an earlier version stored, which
// outlives a reload. A change to the drawing needs no new tag: refresh compares the SVG.
const avatar = atom({ plugin: 'repo-avatar', key: 'avatar' } as const, null, { shape: 'avatar-2' })

/**
 * The SVG-to-PNG converters tried in order; the first that exits 0 and writes the PNG wins. Each
 * gets the SVG's viewBox width too.
 */
const CONVERTERS: readonly ((svg: string, png: string, width: number) => string[])[] = [
  (svg, png) => ['rsvg-convert', '-w', `${PX}`, '-h', `${PX}`, '-o', png, svg],
  (svg, png) => ['resvg', '-w', `${PX}`, '-h', `${PX}`, svg, png],
  // ImageMagick draws an SVG at its own size, which with DiceBear's bare viewBox is that width at
  // 96 dpi, then resizes the bitmap; the density makes it draw at PX instead. png32 keeps it 8-bit.
  (svg, png, width) => [
    'magick', '-density', `${Math.ceil((PX * 96) / width)}`, '-background', 'none', svg,
    '-resize', `${PX}x${PX}`, `png32:${png}`,
  ],
]

/** The SVG's viewBox width, the size a converter draws it at by default; 100 when unreadable. */
function viewBoxWidth(svg: string): number {
  const width = Number(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)/.exec(svg)?.[1])
  return width > 0 ? width : 100
}

export function basename(path: string): string {
  return path.split(/[\\/]+/).filter(Boolean).at(-1) ?? path
}

function camel(style: string): string {
  return style.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase())
}

/**
 * The style under a kebab-case name: a custom one from hooks/styles/ by its file's name, else a
 * bundled one by its camelCase export. Own keys only, so `to-string` finds nothing.
 */
function lookup(name: string): Style | undefined {
  if (Object.hasOwn(customStyles, name)) return customStyles[name]
  const key = camel(name)
  return Object.hasOwn(styles, key) ? styles[key] : undefined
}

/** The style name to use: the one asked for when there is such a style, else the default. */
export function resolveStyle(style: unknown): string {
  return typeof style === 'string' && lookup(style) !== undefined ? style : DEFAULT_STYLE
}

/**
 * The avatar for a project root, mirrored left to right. `initials` reads its seed as words, so it
 * gets the root's name, and is not mirrored, since mirrored letters read backwards.
 *
 * No clip: the SVG's own viewport already clips to the viewBox, and ImageMagick's built-in SVG
 * reader paints DiceBear's clip mask as an opaque square over the avatar.
 */
export function svgFor(style: string, root: string): string {
  const name = resolveStyle(style)
  const definition = lookup(name) ?? lookup(DEFAULT_STYLE)!
  const isInitials = name === 'initials'
  const seed = isInitials ? basename(root) : root
  return createAvatar(definition, { seed, flip: FLIP && !isInitials, clip: false }).toString()
}

async function cacheKey(...parts: (string | number)[]): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('\0')))
  return [...new Uint8Array(digest)].slice(0, 8).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * The avatar as a base64 PNG, converted on the host (the mod's sandbox has no WebAssembly) and
 * cached under ~/.cache/repo-avatar by a hash of the SVG itself, so any change to a style, the
 * seed, the flip or DiceBear draws anew. Undefined when no converter is installed or every one
 * failed.
 */
export async function rasterize($: EngineInterface, svg: string, key: string): Promise<string | undefined> {
  const home = await $.env.get('HOME')
  if (home === undefined || home === '') return undefined
  const dir = `${home}/.cache/repo-avatar`
  const png = `${dir}/${key}.png`
  if (await $.fs.exists(png)) return (await $.fs.read(png, { as: 'bytes' })).base64

  const source = `${dir}/${key}.svg`
  await $.fs.write(source, svg)
  const width = viewBoxWidth(svg)
  for (const argv of CONVERTERS) {
    try {
      const { exitCode } = await $.process.run(argv(source, png, width), { timeoutMs: CONVERT_TIMEOUT_MS })
      if (exitCode === 0 && (await $.fs.exists(png))) {
        return (await $.fs.read(png, { as: 'bytes' })).base64
      }
    } catch {
      // Not installed, or it timed out: try the next one.
    }
  }
  return undefined
}

/**
 * Draws the avatar for the session's project root, unless the one shown already is that drawing.
 * Comparing the SVG, not the style's name, means an edited custom style redraws on reload.
 */
export async function refresh($: EngineInterface, style: string): Promise<void> {
  const root = await $.session.root()
  const svg = svgFor(style, root)
  const shown = await read($, avatar)
  if (shown !== null && shown.svg === svg && shown.png !== undefined) return

  const png = await rasterize($, svg, await cacheKey(svg, PX)).catch(() => undefined)
  const next: Avatar = { seed: root, name: basename(root), style, svg, ...(png === undefined ? {} : { png }) }
  await update($, avatar, () => next)
}

export const register: Register = (on, options) => {
  const style = resolveStyle(options.style)

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    void refresh($, style).catch(() => undefined)
    return started
  })

  // `/cd` and worktree moves change the root; a plain cwd change leaves it, and refresh stops early.
  on('classic.CwdChanged', async ($, e, next) => {
    const result = await next(e)
    void refresh($, style).catch(() => undefined)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const isRoomy = e.props.maxRows >= ROWS && e.props.bodyColumns >= COLUMNS + MIN_SPARE_COLUMNS
    if (e.props.hasSurvey || !isRoomy || (e.surface !== 'terminal' && e.surface !== 'desktop')) {
      return next(e)
    }
    const shown = await read($, avatar)
    if (shown === null) return next(e)

    const rest = await next(e)
    const alt = `${shown.style} avatar for ${shown.name}`

    if (e.surface === 'terminal') {
      const { Box, Text, Image } = $.ui.resolve(e)
      return (
        <Box flexDirection="row">
          <Box flexGrow={1}>{rest}</Box>
          <Box flexDirection="row" alignItems="flex-end" gap={1}>
            <Text dimColor>{shown.name}</Text>
            {shown.png !== undefined && (
              <Image source={{ png: shown.png }} columns={COLUMNS} rows={ROWS} alt={alt} />
            )}
          </Box>
        </Box>
      )
    }

    const { Box, Text, Svg } = $.ui.resolve(e)
    return (
      <Box flexDirection="row">
        <Box flexGrow={1}>{rest}</Box>
        <Box flexDirection="row" alignItems="flex-end" gap={1}>
          <Text dimColor>{shown.name}</Text>
          <Svg source={shown.svg} width={SVG_PX} height={SVG_PX} alt={alt} />
        </Box>
      </Box>
    )
  })
}
