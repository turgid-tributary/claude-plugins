# Changelog

## 1.1.0 — 2026-09-30

- Skip layers that have no pull request yet or whose branch was never pushed, as well as merged
  layers, and list each skipped layer with its reason.
- Diff each layer at its pushed tip rather than at the SHAs `gh stack view` reports, which are
  missing for merged layers and go stale after a rebase.
- With `--include-merged`, diff merged layers at the base and head their PR recorded when it
  merged.
- Flag a layer as needing a rebase when its base is not an ancestor of its head, and mark layers
  whose local branch differs from what was pushed.

## 1.0.0 — 2026-09-10

- First release.
