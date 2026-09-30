#!/usr/bin/env bash
# Enumerate the checked-out gh-stack and materialise one isolated diff per layer.
#
# Writes a manifest plus per-layer diffs under .git/stack-review/<timestamp>/ and
# prints the manifest path on the last line of stdout. Each layer is diffed at its
# pushed tip; layers that have merged, have no PR, or were never pushed are skipped.
#
# Usage: stack-layers.sh [--include-merged] [--layers <branch|pr,...>] [--out <dir>]

set -euo pipefail

include_merged=0
layers_filter=""
out_dir=""

while [ $# -gt 0 ]; do
  case "$1" in
    --include-merged) include_merged=1; shift ;;
    --layers) layers_filter="${2:-}"; shift 2 ;;
    --out) out_dir="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "stack-layers.sh: unknown argument '$1'" >&2; exit 2 ;;
  esac
done

for bin in git gh jq; do
  command -v "$bin" >/dev/null 2>&1 || { echo "stack-layers.sh: '$bin' is required but not installed" >&2; exit 127; }
done

gh stack --help >/dev/null 2>&1 || {
  echo "stack-layers.sh: the gh-stack extension is not installed. Run: gh extension install github/gh-stack" >&2
  exit 127
}

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "stack-layers.sh: not inside a git repository" >&2; exit 1
}
git_dir=$(git rev-parse --absolute-git-dir)

if [ -z "$out_dir" ]; then
  out_dir="$git_dir/stack-review/$(date +%Y%m%d-%H%M%S)"
fi
mkdir -p "$out_dir/findings"

raw="$out_dir/stack.json"
if ! gh stack view --json >"$raw" 2>"$out_dir/stack.err"; then
  echo "stack-layers.sh: 'gh stack view --json' failed:" >&2
  sed 's/^/  /' "$out_dir/stack.err" >&2
  echo "Check out a stack first, e.g. 'gh stack checkout <pr-number>'." >&2
  exit 1
fi

count=$(jq '.branches | length' "$raw")
if [ "$count" -eq 0 ]; then
  echo "stack-layers.sh: the current stack has no branches" >&2; exit 1
fi

trunk=$(jq -r '.trunk // ""' "$raw")
current_branch=$(jq -r '.currentBranch // ""' "$raw")
if [ -z "$trunk" ]; then
  echo "stack-layers.sh: 'gh stack view --json' reported no trunk branch" >&2; exit 1
fi

# `gh stack view` omits base/head for merged layers and can report SHAs from before the last
# rebase, so every SHA below comes from the branch refs instead. A layer's head is its pushed
# tip, which is what its pull request shows.
ref_sha() { git -C "$repo_root" rev-parse -q --verify "$1^{commit}" 2>/dev/null || true; }
pushed_sha() {
  local sha
  sha=$(ref_sha "$1@{upstream}")
  [ -n "$sha" ] || sha=$(ref_sha "refs/remotes/origin/$1")
  echo "$sha"
}

trunk_sha=$(pushed_sha "$trunk")
[ -n "$trunk_sha" ] || trunk_sha=$(ref_sha "refs/heads/$trunk")
if [ -z "$trunk_sha" ]; then
  echo "stack-layers.sh: trunk '$trunk' is missing locally. Run 'git fetch' and retry." >&2; exit 1
fi

# Per-layer records, emitted as JSON lines and assembled at the end.
: >"$out_dir/layers.jsonl"
skipped=""
stack_base=""
stack_head=""
prev_head=""
prev_merged=false

i=0
while [ "$i" -lt "$count" ]; do
  idx=$((i + 1))
  branch=$(jq -r ".branches[$i].name" "$raw")
  merged=$(jq -r ".branches[$i].isMerged // false" "$raw")
  needs_rebase=$(jq -r ".branches[$i].needsRebase // false" "$raw")
  is_current=$(jq -r ".branches[$i].isCurrent // false" "$raw")
  pr=$(jq -r ".branches[$i].pr.number // empty" "$raw")
  pr_url=$(jq -r ".branches[$i].pr.url // empty" "$raw")
  pr_state=$(jq -r ".branches[$i].pr.state // empty" "$raw")
  i=$((i + 1))
  [ "$pr_state" = "MERGED" ] && merged=true

  pushed=""
  local_head=""
  base=""
  head=""
  if [ "$merged" = "true" ]; then
    # A merged branch ref may have moved since the merge; the PR records what actually merged.
    if [ "$include_merged" -eq 1 ] && [ -n "$pr" ]; then
      shas=$(gh pr view "$pr" --json baseRefOid,headRefOid -q '"\(.baseRefOid) \(.headRefOid)"' 2>/dev/null || true)
      base=$(ref_sha "${shas% *}")
      head=$(ref_sha "${shas#* }")
    fi
  else
    pushed=$(pushed_sha "$branch")
    local_head=$(ref_sha "refs/heads/$branch")
    head=${pushed:-$local_head}
    # An open layer whose parent has merged sits directly on trunk.
    if [ "$prev_merged" = "true" ]; then base=$trunk_sha; else base=${prev_head:-$trunk_sha}; fi
    [ -z "$head" ] || prev_head=$head
  fi
  prev_merged=$merged

  reason=""
  if [ "$merged" = "true" ] && [ "$include_merged" -eq 0 ]; then reason=merged
  elif [ -z "$pr" ]; then reason=no-pr
  elif [ "$merged" = "true" ] && { [ -z "$base" ] || [ -z "$head" ]; }; then reason=merged-commits-missing
  elif [ "$merged" != "true" ] && [ -z "$pushed" ]; then reason=unpushed
  fi
  if [ -n "$reason" ]; then
    skipped="$skipped $branch($reason)"
    continue
  fi

  # The whole-stack range spans every reviewable layer, whatever --layers selects.
  [ -n "$stack_base" ] || stack_base=$base
  stack_head=$head

  local_differs=false
  if [ "$merged" != "true" ]; then
    git -C "$repo_root" merge-base --is-ancestor "$base" "$head" || needs_rebase=true
    [ -n "$local_head" ] && [ "$local_head" != "$head" ] && local_differs=true
  fi

  if [ -n "$layers_filter" ]; then
    keep=0
    IFS=',' read -r -a wanted <<<"$layers_filter"
    for w in "${wanted[@]}"; do
      w=$(echo "$w" | tr -d '[:space:]' | sed 's/^#//')
      [ -z "$w" ] && continue
      if [ "$w" = "$branch" ] || [ "$w" = "$pr" ] || [ "$w" = "$idx" ]; then keep=1; fi
    done
    if [ "$keep" -eq 0 ]; then skipped="$skipped $branch(filtered)"; continue; fi
  fi

  padded=$(printf '%02d' "$idx")
  diff_file="$out_dir/layer-$padded.diff"
  stat_file="$out_dir/layer-$padded.stat"
  findings_file="$out_dir/findings/layer-$padded.json"

  git -C "$repo_root" diff --no-color "$base...$head" >"$diff_file"
  git -C "$repo_root" diff --stat --no-color "$base...$head" >"$stat_file"
  diff_bytes=$(wc -c <"$diff_file" | tr -d ' ')

  jq -nc \
    --argjson index "$idx" \
    --arg branch "$branch" \
    --arg base "$base" \
    --arg head "$head" \
    --argjson is_merged "$merged" \
    --argjson needs_rebase "$needs_rebase" \
    --argjson is_current "$is_current" \
    --argjson local_differs "$local_differs" \
    --arg pr "$pr" \
    --arg pr_url "$pr_url" \
    --arg pr_state "$pr_state" \
    --argjson diff_bytes "$diff_bytes" \
    --arg diff_file "$diff_file" \
    --arg stat_file "$stat_file" \
    --arg findings_file "$findings_file" \
    --arg shortstat "$(git -C "$repo_root" diff --shortstat --no-color "$base...$head" | sed 's/^ *//')" \
    --rawfile files <(git -C "$repo_root" diff --name-only "$base...$head") \
    --rawfile commits <(git -C "$repo_root" log --no-color --format='%h %s' "$base..$head") \
    '{
       index: $index, branch: $branch, base: $base, head: $head,
       is_merged: $is_merged, needs_rebase: $needs_rebase, is_current: $is_current,
       local_differs: $local_differs,
       pr: (if $pr == "" then null else ($pr | tonumber) end),
       pr_url: (if $pr_url == "" then null else $pr_url end),
       pr_state: (if $pr_state == "" then null else $pr_state end),
       shortstat: $shortstat,
       diff_bytes: $diff_bytes, diff_is_large: ($diff_bytes > 300000),
       files: ($files | split("\n") | map(select(length > 0))),
       commits: ($commits | split("\n") | map(select(length > 0))),
       diff_file: $diff_file, stat_file: $stat_file, findings_file: $findings_file
     }' >>"$out_dir/layers.jsonl"
done

reviewed=$(wc -l <"$out_dir/layers.jsonl" | tr -d ' ')
if [ "$reviewed" -eq 0 ]; then
  echo "stack-layers.sh: no layers left to review (skipped:${skipped:- none})" >&2
  exit 1
fi

git -C "$repo_root" diff --no-color "$stack_base...$stack_head" >"$out_dir/stack.diff"
git -C "$repo_root" diff --stat --no-color "$stack_base...$stack_head" >"$out_dir/stack.stat"

manifest="$out_dir/manifest.json"
jq -s \
  --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg repo_root "$repo_root" \
  --arg trunk "$trunk" \
  --arg current_branch "$current_branch" \
  --arg stack_base "$stack_base" \
  --arg stack_head "$stack_head" \
  --arg out_dir "$out_dir" \
  --arg skipped "${skipped# }" \
  --arg dirty "$(git -C "$repo_root" status --porcelain | head -20)" \
  '{
     generated_at: $generated_at, repo_root: $repo_root, trunk: $trunk,
     current_branch: $current_branch, stack_base: $stack_base, stack_head: $stack_head,
     out_dir: $out_dir,
     stack_diff: ($out_dir + "/stack.diff"),
     stack_stat: ($out_dir + "/stack.stat"),
     findings_dir: ($out_dir + "/findings"),
     skipped: (if $skipped == "" then [] else ($skipped | split(" ")) end),
     working_tree_dirty: ($dirty | length > 0),
     layer_count: length,
     layers: .
   }' "$out_dir/layers.jsonl" >"$manifest"

ln -sfn "$out_dir" "$git_dir/stack-review/latest"

echo "Stack: trunk '$trunk' -> $(jq -r '.layers[-1].branch' "$manifest")  ($reviewed layer(s) to review)"
[ -n "$skipped" ] && echo "Skipped:${skipped}"
jq -r '.layers[] | "  L\(.index) \(.branch)  PR \(.pr // "-")  \(.shortstat // "no changes")\(if .needs_rebase then "  [NEEDS REBASE]" else "" end)\(if .local_differs then "  [LOCAL DIFFERS FROM PUSHED]" else "" end)\(if .diff_is_large then "  [LARGE DIFF]" else "" end)"' "$manifest"
jq -r 'if .working_tree_dirty then "Note: working tree is dirty; layer diffs come from commits and are unaffected." else empty end' "$manifest"
echo "$manifest"
