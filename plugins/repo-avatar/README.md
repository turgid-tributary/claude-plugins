# repo-avatar

Draws an avatar in the band above the Claude Code prompt, with the repo's name beside it. By
default it's an orc; any [DiceBear](https://www.dicebear.com) style works too:

```
│ ...transcript...                              │
│                                    ┌──────┐   │
│                                    │ (o_o)│   │
│                     claude-plugins └──────┘   │
│ > _                                           │
```

The avatar is seeded by the session's project root (`$.session.root()`: where the session started,
or where `/cd` or a worktree move took it; a shell `cd` does not move it). Every session in the same
directory gets the same face, and a different directory or worktree gets a different one.

Every avatar is mirrored left to right, so it faces the other way from DiceBear's own drawing. The
exception is `initials`, whose letters would read backwards. To turn this off, set `FLIP` to `false`
in `hooks/register.tsx`.

## Install

```
/plugin marketplace add turgid-tributary/claude-plugins
/plugin install repo-avatar@turgid-plugins
```

## Choosing a style

Pick a style in `/config` under **repo-avatar → Avatar style**. The default is `orc`, and the avatar
redraws when you change it. The plugin's own styles come first in the list:
- `orc`, described below;
- `blob`, a tiny example.

All 31 DiceBear styles follow. Gallery: https://www.dicebear.com/styles

## The orc style

`orc` draws a bold cartoon bust of a fantasy orc. The seed picks the build:
- **Peon:** a worker in a burlap tunic, with big ears and a dopey or worried look.
- **Grunt:** a warrior with war paint, pauldrons and a scowl.

Everything else is drawn from the seed too: four head shapes, skin, ears, eyes, an expression (brow,
eyes and mouth), nose, tusks, hair, mustache, beard, more than 20 hats, eyewear (yes, monocles),
scars, earrings, clothing, neckwear and the odd pipe. That makes billions of combinations. A top hat
or bowler makes the orc a gentleman: a monocle, a waxed mustache and a bow tie become more likely.

It's an original drawing of the generic fantasy orc, not artwork from any game.

## Making your own style

A style is a TypeScript file in `hooks/styles/`, named in kebab case (`my-robot.ts` becomes the
`my-robot` style). It exports `create`, and optionally `meta`. DiceBear calls `create` with a
random-number generator seeded by the project root, and `create` returns an SVG body:

```ts
import type { Style } from '../vendor/dicebear.js'

export const meta: Style['meta'] = { title: 'My robot', creator: 'You' }

export const create: Style['create'] = ({ prng }) => {
  const hue = prng.integer(0, 359)
  return {
    attributes: { viewBox: '0 0 100 100' },
    body: `<rect x="15" y="20" width="70" height="60" rx="12" fill="hsl(${hue} 60% 70%)"/>`,
  }
}
```

`hooks/styles/blob.ts` is a complete example in 40 lines. `hooks/styles/orc.ts` is a big one: it
keeps its parts in `hooks/styles/orc-parts/`. `sync-styles.sh` skips folders and `*.test.ts` files, so
a style can split its code that way.

The `prng` has these methods:
- `integer(min, max)`;
- `bool(percent)`;
- `pick(items, fallback)`;
- `shuffle(items)`;
- `string(length)`.

Draw every choice from `prng`, so each repo keeps its face. Keep the main features on wide ranges:
with only a few choices, different repos end up looking alike, and a test fails when six sample
repos don't get six different faces. DiceBear's own options still apply to your style: it is
mirrored like the others.

Then:

1. Run `scripts/sync-styles.sh`. A mod can't list or load files at run time, so this writes
   `hooks/styles/index.ts`, which imports each style, and adds the name to the `/config` picker in
   `plugin.json`. Claude Code treats a style that isn't in the picker as unset and draws `orc`.
   CI runs `scripts/sync-styles.sh --check`, which fails when you forget.
2. Run `claude plugin test plugins/repo-avatar`. Every style must render, and differ between repos.
3. Bump the version in `plugin.json` and add a `CHANGELOG.md` entry.

While `claude --plugin-dir plugins/repo-avatar` runs, saving a style file reloads the mod and
redraws the avatar. If a newly added style isn't in `/config` yet, restart the session.

A style runs in the mod's sandbox, so it has these limits:
- it is plain code that builds a string: no DOM, no Node and no `import()`;
- the file must stay under 1 MiB;
- its name can't be one of the bundled styles.

## Requirements

- **Terminal pictures:** a terminal with an image protocol: Ghostty or kitty (kitty graphics), or
  iTerm2 3.5+ under fullscreen rendering, and tmux with `allow-passthrough` and `focus-events` on.
  Other terminals show the repo name with the style in place of the picture.
- **An SVG-to-PNG converter on `PATH`:** the mod's sandbox has no WebAssembly, so the terminal's PNG
  is made on the host. It tries `rsvg-convert` (`brew install librsvg`), then `resvg`, then
  ImageMagick's `magick`. With none installed the band shows only the repo name. ImageMagick's own
  SVG reader gets six styles wrong (bottts, croodles, glass, rings, shapes and thumbs), so install
  one of the other two for those.
- Claude Code Desktop draws the SVG itself and needs neither.

PNGs are cached in `~/.cache/repo-avatar/`, keyed by a hash of the SVG, so an edited style is never
served from the cache. Deleting the folder is safe.

## How it works

This is a mod: a plugin of function hooks (`hooks/register.tsx`) rather than commands or agents.

- **`session.start`:** reads the project root, draws the avatar with DiceBear's `createAvatar`, turns
  it into a PNG, and keeps both in `$.state`.
- **`classic.CwdChanged`:** does the same when the root moves.
- **`ui.render` on `AbovePrompt`:** draws whatever else is in the band on the left, and the repo name
  and avatar on the right. The terminal gets an `Image` of the PNG, desktop an `Svg`. The band is left
  alone while a survey holds it, or when it is too short or narrow.

DiceBear is vendored as plain ES modules under `hooks/vendor/`, because a mod cannot resolve npm
packages and the engine reads no module file over 1 MiB:
- `dicebear/core.js`
- one file per style in `dicebear/styles/`
- the `dicebear.js` index

`scripts/vendor-dicebear.sh` regenerates all of it from pinned versions of `@dicebear/core` and
`@dicebear/collection`. It also rewrites `THIRD_PARTY_LICENSES.md`, then runs `sync-styles.sh` so
the picker lists the bundled and custom styles. Running it changes the plugin, so bump the version.

To resize the avatar, edit `ROWS` and `COLUMNS` in `hooks/register.tsx`. Keep `COLUMNS` at about
twice `ROWS` so it stays square.

## Licenses

DiceBear's code is MIT. Some styles' artwork has its own license, several of them CC BY 4.0 (for
example `adventurer`, `micah`, `personas`, `fun-emoji`), which asks for attribution. See
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## Developing

```bash
plugins/repo-avatar/scripts/vendor-dicebear.sh   # regenerate hooks/vendor/ (needs node, npm, jq)
plugins/repo-avatar/scripts/sync-styles.sh       # after adding or removing a style in hooks/styles/
claude plugin validate --strict plugins/repo-avatar
claude plugin test plugins/repo-avatar
claude --plugin-dir plugins/repo-avatar          # load it from disk; edits hot-reload
```

Once Claude Code has loaded the mod from disk, `.claude-plugin/types/` holds the API typings and
`tsc -p plugins/repo-avatar` type-checks it.
