# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Claude Code plugin marketplace (`turgid-plugins`, defined in `.claude-plugin/marketplace.json`).
Each plugin lives under `plugins/<name>/` with its own `.claude-plugin/plugin.json`, `README.md`
and `CHANGELOG.md`. There is no build step. Plugins come in two kinds:
- Prompt plugins (`stack-review`): Markdown commands and agents plus Bash scripts that depend on
  `git`, `gh` and `jq`.
- Mods (`review-queue`): a TypeScript function-hooks module listed in `hooks/hooks.json`, run by
  Claude Code itself in a sandbox with no Node or DOM; it reaches the host only through `$`
  (`$.process.run`, `$.ui.status`, `$.clock`, ...). Load the `plugin-authoring` skill before
  writing or changing one. Claude Code writes the API typings into `.claude-plugin/types/` when it
  loads a mod from disk; that folder is gitignored, and the mod's `tsconfig.json` extends it.

## Validation (what CI runs)

```bash
claude plugin validate --strict .                      # marketplace
claude plugin validate --strict plugins/stack-review   # one plugin
claude plugin test plugins/review-queue                # a plugin's *.test.ts / *.test.tsx files
.github/scripts/check-versions.sh <base-sha>           # version-bump check against a base commit
```

CI runs `claude plugin test` for every plugin that has test files, and fails on any failing test.

`check-versions.sh` fails if any file in a plugin changed (other than its `README.md` or
`CHANGELOG.md`) without bumping `version` in that plugin's `plugin.json`, or if the new version
has no `## <version>` heading in its `CHANGELOG.md`. So any edit to a command, agent or script
needs a version bump and a changelog entry in the same change. Installed copies only update when
the version changes.

Releasing: push to `main`, wait for CI, then
`gh release create <plugin>-v<version> --target main --title "<plugin> <version>" --notes "<the changelog entry>"`.
Tags carry the plugin name because several plugins share the repo; `v1.1.0` (stack-review)
predates this and is the only bare tag.

## review-queue architecture

`hooks/register.ts` hooks `session.start`: it runs
`gh api search/issues` for `is:pr is:open review-requested:@me archived:false`, reads
`total_count`, and sets the status line to `"<PREFIX> N reviews"` (or `"<PREFIX> reviews: ?"` when
`gh` fails), then repeats every `REFRESH_MS` via `$.clock.every`. `hooks/register.test.ts` imports
`PREFIX` and mocks `process.run`, `ui.status` and the clock beneath the plugin. In those test
hooks, `process.run` and `ui.status` answers are wrapped as `{ value: ... }`, while the
`session.start` answer is the bare `{ cwd }`.

## stack-review architecture

`/stack-review` (`commands/stack-review.md`) is an orchestrator prompt that runs a pipeline across
two scripts and two agents, connected by files under `.git/stack-review/<timestamp>/` (with a
`latest` symlink):

1. `scripts/stack-layers.sh` reads `gh stack view --json`, resolves each layer's SHAs from branch
   refs (pushed tip via `@{upstream}`/`origin/<branch>`, not the SHAs `gh stack view` reports,
   which go stale after rebase or are missing for merged layers), skips merged / no-PR / unpushed
   layers, writes `layer-NN.diff`, `stack.diff` and `manifest.json`, and prints the manifest path
   as its **last line of stdout**.
2. The command spawns one `stack-layer-reviewer` agent per layer, all in one message. Each agent
   is deliberately blind to other layers and writes `findings/layer-NN.json`.
3. The command prints every layer's findings verbatim, with no cross-layer commentary.
4. `scripts/merge-findings.sh <manifest>` validates each findings file (must be an object with a
   `findings` array) and writes `findings/all.json`, again printing its path last.
5. One `stack-finding-rater` agent adjudicates all findings against the whole-stack diff and
   writes `adjudication.json`.

Contracts that span files, so change them together:
- Manifest field names produced by `stack-layers.sh` are referenced by name in the command's
  agent prompt templates and by `merge-findings.sh` (`findings_dir`, `layers[].findings_file`, ...).
- The findings JSON shape is defined in `agents/stack-layer-reviewer.md` ("Output"), consumed by
  `merge-findings.sh`, and read by `agents/stack-finding-rater.md`.
- Both scripts' "path on the last stdout line" convention is relied on by the command.

Invariants the prompts enforce and edits must preserve: nothing mutates the user's repo (no
`checkout`/`switch`/`stash`/`rebase`/`merge`/`gh stack` subcommands, no writes outside the run
directory), and agents read code via `git show <rev>:<path>`, never from the working tree.

The scripts run standalone for testing against a checked-out stack, e.g.
`plugins/stack-review/scripts/stack-layers.sh --layers 3,4`.
