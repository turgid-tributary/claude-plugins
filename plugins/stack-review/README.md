# stack-review

Reviews a stack of pull requests the way the stack is meant to be read: one layer at a time.

`/stack-review` enumerates the `gh stack` that is checked out, runs a reviewer agent against each
layer's own `base...head` diff, shows you every agent's findings untouched, and then hands all of
it to one adjudicator that rates the findings against the whole change.

## Why the two passes

A per-layer reviewer is blind on purpose. It sees what the reviewer of that one pull request sees,
so it cannot excuse a defect by pointing at code three branches up. That blindness also means some
of what it reports is scaffolding the stack resolves later: a function added before its caller, a
table nothing reads yet.

The adjudicator holds the whole diff and sorts that out. It marks each finding confirmed, resolved
further up the stack, duplicate, pre-existing, or a false positive, with the evidence it checked.
For anything resolved further up, it says whether merging the originating layer on its own would
still break trunk, which is the call no single-layer reviewer can make. It also reports defects
that only appear across layers, such as a contract changed at the bottom whose callers are updated
in some upper layers but not all.

## Requirements

- `gh` with the `gh-stack` extension: `gh extension install github/gh-stack`
- `jq`
- A stack checked out. The plugin never changes branches; run `gh stack checkout <pr>` yourself.

## Usage

```
/stack-review
/stack-review --layers 3,527,feat/thing-6
/stack-review --focus "row-level security and tenant isolation"
/stack-review --include-merged
/stack-review --no-rate
/stack-review --dir .git/stack-review/20260910-233702
```

| Flag | Effect |
|---|---|
| `--layers <spec>` | Review only these layers, by layer number, PR number, or branch name |
| `--focus "<text>"` | Extra instruction passed to every layer reviewer |
| `--include-merged` | Include layers whose PR has already merged (skipped by default) |
| `--no-rate` | Stop after the per-layer findings |
| `--dir <run>` | Re-run adjudication over an existing run directory |

Layers with no PR yet, and layers whose branch was never pushed, are always skipped. The rest are
diffed at their pushed tips, which is what each pull request shows, so `git fetch` first if the
stack was pushed from another machine. Merged layers, when included, are diffed at the base and
head their PR recorded when it merged.

## What it writes

Everything lands in `.git/stack-review/<timestamp>/`, with a `latest` symlink:

```
manifest.json        the stack, layer by layer, with SHAs and paths
stack.diff           trunk base to top head
layer-NN.diff        one layer's isolated diff
findings/layer-NN.json   one reviewer's structured findings
findings/all.json    merged and validated
adjudication.json    the rated findings
```

Nothing outside that directory is touched. Both agents are barred from `checkout`, `switch`,
`stash`, `rebase`, `merge`, and every `gh stack` subcommand, and they read source with
`git show <rev>:<path>` rather than from the working tree, which sits at one branch and would
otherwise have them reviewing the wrong revision. Your uncommitted work is safe and irrelevant to
the review, since every diff comes from commit SHAs.

Delete old runs with `rm -rf .git/stack-review`.

## Components

- `commands/stack-review.md` — the orchestrator
- `agents/stack-layer-reviewer.md` — one instance per layer, isolated
- `agents/stack-finding-rater.md` — one instance per run, adjudicates
- `scripts/stack-layers.sh` — enumerates the stack and materialises the diffs
- `scripts/merge-findings.sh` — validates and merges the layer reports

Both scripts run standalone if you want the diffs without the review:

```bash
scripts/stack-layers.sh --layers 3,4
```

## Cost

One agent per layer plus one adjudicator. A nine-layer stack is ten agents, so scope large stacks
with `--layers` when you only need part of it.
