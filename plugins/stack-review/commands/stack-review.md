---
description: Review every layer of the checked-out gh stack, then rate the findings
argument-hint: [--layers 1,510,branch] [--focus "what to look for"] [--include-merged] [--no-rate] [--dir <run>]
---

Review the stacked pull requests that are currently checked out. Each layer gets its own reviewer
agent that sees only that layer, you show me every agent's findings untouched, and then one
adjudicator rates all of it against the whole change.

Arguments given: $ARGUMENTS

- `--layers <spec>` limits the review to some layers, by layer number, PR number, or branch name.
- `--focus "<text>"` is an extra instruction passed to every layer reviewer.
- `--include-merged` reviews layers whose PR has already merged, which are skipped by default.
- `--no-rate` stops after the per-layer findings and skips the adjudication pass.
- `--dir <run>` re-runs adjudication over an existing run directory instead of reviewing again.

## Ground rules

Never change the repository state. No `git checkout`, `switch`, `stash`, `rebase`, `merge`, or
`gh stack` subcommand at any point, and no edits to any file outside the run directory. The user
has a stack checked out and likely has uncommitted work; every diff here comes from commit SHAs,
so nothing needs to be checked out to review it.

This command reviews the stack that is already checked out. If the user names a stack that is not
current, tell them to run `gh stack checkout <pr-number>` first rather than doing it for them.

## Step 1: Enumerate the stack

Run the enumeration script, forwarding `--layers` and `--include-merged` if given:

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/stack-layers.sh [--layers <spec>] [--include-merged]
```

It prints a summary and, on its last line, the path to `manifest.json`. If it fails, report the
error verbatim and stop; the usual causes are a stack that is not checked out, a missing
`gh-stack` extension, a trunk branch that needs a `git fetch`, or a stack with no layer left to
review.

The script skips layers whose PR has merged (unless `--include-merged`), layers with no PR yet,
and layers whose branch was never pushed, and lists each on its `Skipped:` line with the reason.
Every other layer is diffed at its pushed tip, the commit its pull request shows, not at the SHAs
`gh stack view` reports, which go stale after a rebase.

Read the manifest. It gives you `stack_base`, `stack_head`, `trunk`, and for each layer: `index`,
`branch`, `pr`, `base`, `head`, `files`, `commits`, `shortstat`, `diff_file`, `stat_file`,
`findings_file`, `needs_rebase` and `diff_is_large`.

Show the user the stack summary the script printed, then say how many reviewer agents you are
about to start. With `--dir <run>`, skip to step 4 using that run's manifest.

## Step 2: One reviewer per layer, all at once

Launch one `stack-layer-reviewer` agent per layer **in a single message** so they run
concurrently. Give each agent only its own layer. Do not summarize the other layers for it, do
not tell it what the stack is building toward beyond its own commits, and do not pass it another
layer's diff. Its blindness is the point: it is standing in for the reviewer who opens that one
pull request.

Use this prompt for each, filling in the values from the manifest:

```
Review layer <index> of a <layer_count>-layer stack, in isolation.

Branch: <branch>
Pull request: <pr> (<pr_url>)
Base commit: <base>
Head commit: <head>
Diff: <diff_file>          (also <stat_file> for the file-level summary)
Changed files: <files, joined>
Commits in this layer:
<commits, one per line>
Repository root: <repo_root>
Write your findings JSON to: <findings_file>

Read the diff from the path above. Inspect code with `git show <head>:<path>` and
`git show <base>:<path>`; never read source files from the working tree, which is checked out at
a different branch. Do not look at any other layer's diff, and do not run any command that
changes repository state.
<when --focus was given: "Pay particular attention to: <focus text>">
<when the layer needs_rebase: "This branch is flagged as needing a rebase against its base, so
some of the diff may be stale. Note anything that looks like a rebase artifact.">
<when diff_is_large: "The diff is large. Work file by file with
`git diff <base>...<head> -- <path>` rather than reading it whole.">
```

If a reviewer agent fails or returns nothing, say so for that layer and carry on with the rest.
Never invent findings for a layer that did not report.

## Step 3: Show every layer's findings in isolation

This is the part the user asked for, so follow it exactly.

Print each agent's report as its own section, in stack order from bottom to top, exactly as the
agent returned it. Between the sections, add nothing: no comparisons, no deduplication, no
"layer 6 fixes this", no severity adjustments, no running totals, no commentary of any kind.
Separate sections with a horizontal rule. A layer that reported nothing gets a section saying so.

Preserve every finding, including ones you can already tell are wrong or are resolved higher in
the stack. Step 4 exists to make those calls, with evidence. Making them here, from memory,
is what this command is built to avoid.

Close the step with one line and nothing more: the number of findings and the number of layers
they came from.

## Step 4: Rate the findings against the whole change

Skip this step if `--no-rate` was given.

Merge the reports:

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/merge-findings.sh <manifest_path>
```

It validates each layer's JSON and prints the combined path on its last line. If it reports
missing or malformed reports, tell the user which layers those were before continuing.

Then launch exactly one `stack-finding-rater` agent:

```
Adjudicate the findings from a <layer_count>-layer stack review against the whole change.

Manifest: <manifest_path>
Combined findings: <combined_path>
Per-layer findings files are listed in the manifest.
Whole-stack diff: <stack_diff>   (file-level summary: <stack_stat>)
Stack base: <stack_base>
Stack head: <stack_head>
Trunk: <trunk>
Repository root: <repo_root>
Write your adjudication JSON to: <out_dir>/adjudication.json

Verify each finding at the revisions in the manifest. Read code with `git show <rev>:<path>`, not
from the working tree. Run no command that changes repository state.
<when --focus was given: "The reviewers were told to focus on: <focus text>">
```

Print its report exactly as returned.

## Step 5: Close out

Two or three sentences, no more: whether the stack is mergeable as it stands, which layer is the
one to fix first, and the path to the run directory so the user can reread the diffs and the
findings files. Do not offer to fix anything unless the user asks.
