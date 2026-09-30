#!/usr/bin/env bash
# Fail when a plugin's files changed since <base> without a new version in its plugin.json, or
# when that version has no heading in the plugin's CHANGELOG.md. README and CHANGELOG edits alone
# do not need a bump.
#
# Usage: check-versions.sh <base-sha>

set -euo pipefail

base="${1:-}"
if [ -z "$base" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  echo "No base commit to compare against; skipping the version check."
  exit 0
fi

status=0
for dir in plugins/*/; do
  dir=${dir%/}
  name=$(basename "$dir")
  if git diff --quiet "$base" HEAD -- "$dir" ":(exclude)$dir/README.md" ":(exclude)$dir/CHANGELOG.md"; then
    continue
  fi

  manifest="$dir/.claude-plugin/plugin.json"
  new=$(jq -r '.version // empty' "$manifest")
  old=$(git show "$base:$manifest" 2>/dev/null | jq -r '.version // empty' 2>/dev/null || true)

  if [ -z "$new" ]; then
    echo "::error file=$manifest::$name changed but plugin.json has no version"
    status=1
  elif [ "$new" = "$old" ]; then
    echo "::error file=$manifest::$name changed but its version is still $new; bump it"
    status=1
  elif ! grep -qE "^## ${new//./\\.}( |$)" "$dir/CHANGELOG.md" 2>/dev/null; then
    echo "::error file=$dir/CHANGELOG.md::$name $new has no '## $new' heading in CHANGELOG.md"
    status=1
  else
    echo "$name: ${old:-new} -> $new"
  fi
done
exit "$status"
