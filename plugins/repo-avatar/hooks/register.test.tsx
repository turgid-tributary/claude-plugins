import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { COLUMNS, DEFAULT_STYLE, ROWS, resolveStyle, svgFor } from './register'
import { customStyles } from './styles/index'
import { styles } from './vendor/dicebear.js'

const ROOT = '/work/claude-plugins'
// A real 1x1 PNG: the Image element checks its signature and header.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const PLUGIN = 'repo-avatar'
const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 12,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 12 },
  view: {},
} as const

const kebab = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
const BUNDLED = Object.keys(styles).map(kebab)
const CUSTOM = Object.keys(customStyles)

/**
 * The host beneath the plugin: a session rooted at `root`, a HOME, an in-memory file system, and
 * converters that either write the PNG they are asked for or are not installed.
 */
function host(on: On, { converters = 'installed' }: { converters?: 'installed' | 'missing' } = {}) {
  const at = { root: ROOT }
  const files = new Map<string, string>()
  const runs: string[][] = []

  mock.env(on, { HOME: '/home/me' })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('classic.CwdChanged', () => ({}))
  // Stands for what the engine (or another plugin) draws in the band.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('session.root', () => ({ value: at.root }))
  on('fs.exists', ($, e) => ({ value: files.has(e.path) }))
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.read', ($, e) => {
    const content = files.get(e.path)
    if (content === undefined) throw new Error(`ENOENT: ${e.path}`)
    return { value: e.as === 'bytes' ? { base64: content } : content }
  })
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    if (converters === 'missing') throw new Error(`spawn ${e.argv[0]} ENOENT`)
    const output = e.argv[e.argv.indexOf('-o') + 1]
    if (output !== undefined) files.set(output, PNG)
    return {
      value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }
  })

  return { at, files, runs, clock: mock.clock(on) }
}

test('every bundled and custom style draws an SVG and is reachable by its name', () => {
  expect(BUNDLED.length).toBe(31)
  expect(CUSTOM).toContain('blob')
  expect(CUSTOM).toContain('orc')
  expect(DEFAULT_STYLE).toBe('orc')
  for (const name of [...BUNDLED, ...CUSTOM]) {
    expect(resolveStyle(name)).toBe(name)
    expect(svgFor(name, ROOT).startsWith('<svg')).toBe(true)
  }
  expect(resolveStyle('to-string')).toBe(DEFAULT_STYLE)
})

test('every style faces the other way, mirrored left to right, except initials', () => {
  const MIRROR = /<g transform="scale\(-1 1\) translate\(-\d+ 0\)">/
  for (const name of [...BUNDLED, ...CUSTOM]) {
    expect(MIRROR.test(svgFor(name, ROOT))).toBe(name !== 'initials')
  }
})

// ImageMagick's own SVG reader paints DiceBear's clip mask as an opaque square over the avatar.
test('no style wraps its avatar in a clip mask', () => {
  for (const name of [...BUNDLED, ...CUSTOM]) {
    expect(svgFor(name, ROOT)).not.toContain('viewboxMask')
  }
})

// A custom style with too few choices gives different repos the same face; this catches it.
test('each custom style gives six sample repos six different faces', () => {
  const roots = ['claude-plugins', 'api', 'web', 'infra', 'docs', 'mobile'].map(repo => `/work/${repo}`)
  for (const name of CUSTOM) {
    expect(new Set(roots.map(root => svgFor(name, root))).size).toBe(roots.length)
  }
})

test('the project root is the seed: the same root draws the same face, another root another', () => {
  expect(svgFor('bottts', ROOT)).toBe(svgFor('bottts', ROOT))
  expect(svgFor('bottts', ROOT)).not.toBe(svgFor('bottts', '/work/other-repo'))
  expect(resolveStyle('no-such-style')).toBe(DEFAULT_STYLE)
})

test('the terminal band draws the PNG beside the repo name, after what else is there', async ($, on) => {
  const { runs, clock } = host(on)
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.advance(0)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
  const image = await ui.find({ type: 'Image' })
  expect(image?.props).toMatchObject({ source: { png: PNG }, columns: COLUMNS, rows: ROWS })
  expect(await ui.find({ type: 'Text', text: /^claude-plugins$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  expect(runs.map(argv => argv[0])).toEqual(['rsvg-convert'])
  await ui.unmount()
})

test('without a converter the terminal band still names the repo', async ($, on) => {
  const { runs, clock } = host(on, { converters: 'missing' })
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.advance(0)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^claude-plugins$/ })).toBeDefined()
  expect(runs.map(argv => argv[0])).toEqual(['rsvg-convert', 'resvg', 'magick'])
  // The orc's viewBox is 100 wide, so magick draws it at 256 px (245.76 dpi), not 100 px upscaled.
  expect(runs.at(-1)?.slice(1, 3)).toEqual(['-density', '246'])
  expect(runs.at(-1)?.at(-1)).toMatch(/^png32:/)
  await ui.unmount()
})

test('desktop draws the SVG itself', async ($, on) => {
  const { clock } = host(on)
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })
  await clock.advance(0)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND })
  const svg = await ui.find({ type: 'Svg' })
  expect(svg?.props.source).toBe(svgFor(DEFAULT_STYLE, ROOT))
  await ui.unmount()
})

test('the style option picks the style', { options: { style: 'pixel-art' } }, async ($, on) => {
  const { clock } = host(on)
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })
  await clock.advance(0)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND })
  const svg = await ui.find({ type: 'Svg' })
  expect(svg?.props.source).toBe(svgFor('pixel-art', ROOT))
  expect(svg?.props.alt).toBe('pixel-art avatar for claude-plugins')
  await ui.unmount()
})

// The kit holds options to the manifest's list, as Claude Code does, so this fails when the
// picker in plugin.json does not list the custom style (run scripts/sync-styles.sh).
test('a custom style can be picked in /config', { options: { style: 'blob' } }, async ($, on) => {
  const { clock } = host(on)
  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true })
  await clock.advance(0)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND })
  const svg = await ui.find({ type: 'Svg' })
  expect(svg?.props.source).toBe(svgFor('blob', ROOT))
  expect(svg?.props.alt).toBe('blob avatar for claude-plugins')
  await ui.unmount()
})

test('moving the project root with /cd redraws the avatar for the new root', async ($, on) => {
  const { at, clock } = host(on)
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.advance(0)

  at.root = '/work/other-repo'
  await $.classic.CwdChanged({ old_cwd: ROOT, new_cwd: at.root })
  await clock.advance(0)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ type: 'Text', text: /^other-repo$/ })).toBeDefined()
  await ui.unmount()
})

test('the band is left alone under a survey or when it is too narrow', async ($, on) => {
  const { clock } = host(on)
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await clock.advance(0)

  for (const props of [{ ...BAND, hasSurvey: true }, { ...BAND, bodyColumns: COLUMNS + 4 }]) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props })
    expect(await ui.find({ type: 'Image' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /claude-plugins/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
    await ui.unmount()
  }
})
