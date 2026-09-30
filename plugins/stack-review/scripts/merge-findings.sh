#!/usr/bin/env bash
# Validate and merge the per-layer findings files named in a stack-review manifest.
#
# Usage: merge-findings.sh <manifest.json>
# Writes <findings_dir>/all.json and prints its path on the last line.

set -euo pipefail

manifest="${1:-}"
[ -n "$manifest" ] && [ -f "$manifest" ] || { echo "merge-findings.sh: pass the path to manifest.json" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "merge-findings.sh: 'jq' is required" >&2; exit 127; }

findings_dir=$(jq -r '.findings_dir' "$manifest")
combined="$findings_dir/all.json"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

missing=""
invalid=""
: >"$tmp"

while IFS=$'\t' read -r index branch file; do
  if [ ! -s "$file" ]; then
    missing="$missing $index:$branch"
    continue
  fi
  if ! jq -e 'type == "object" and has("findings") and (.findings | type == "array")' "$file" >/dev/null 2>&1; then
    invalid="$invalid $index:$branch"
    continue
  fi
  jq -c --argjson index "$index" --arg branch "$branch" \
    '{layer: $index, branch: $branch, summary: (.summary // ""), layer_verdict: (.layer_verdict // null),
      findings: (.findings | map(. + {layer: $index, branch: $branch}))}' "$file" >>"$tmp"
done < <(jq -r '.layers[] | [.index, .branch, .findings_file] | @tsv' "$manifest")

jq -s \
  --arg missing "${missing# }" \
  --arg invalid "${invalid# }" \
  '{
     layer_count: length,
     finding_count: (map(.findings | length) | add // 0),
     missing_reports: (if $missing == "" then [] else ($missing | split(" ")) end),
     invalid_reports: (if $invalid == "" then [] else ($invalid | split(" ")) end),
     layers: .
   }' "$tmp" >"$combined"

jq -r '"Merged \(.finding_count) finding(s) from \(.layer_count) layer report(s)."' "$combined"
[ -n "$missing" ] && echo "Missing reports:${missing}" >&2
[ -n "$invalid" ] && echo "Malformed reports (not valid findings JSON):${invalid}" >&2
echo "$combined"
