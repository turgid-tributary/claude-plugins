# claude-plugins

Claude Code plugins.

## Install

```
/plugin marketplace add turgid-tributary/claude-plugins
/plugin install stack-review@turgid-plugins
```

To stay on one release instead of following `main`, add the marketplace at its tag, for example
`turgid-tributary/claude-plugins#v1.1.0`.

## Plugins

| Plugin | What it does |
|---|---|
| [stack-review](plugins/stack-review) | Reviews a `gh stack` one layer at a time with an agent per layer, shows each layer's findings in isolation, then rates them all against the whole change. |

## Releasing

1. Bump `version` in the plugin's `.claude-plugin/plugin.json` and add a matching `## <version>`
   heading to its `CHANGELOG.md`. CI fails any change to a plugin's files that is missing either.
   Installed copies only update when the version changes.
2. Push to `main`, and once CI passes, tag the release:
   `gh release create v<version> --target main --notes "<the changelog entry>"`.
