# deslop

Skills that clean the slop out of a change before a person reviews it. Run one in a fresh session
after an agent has finished its work.

```
/plugin install deslop --marketplace turgid-tributary/claude-plugins
```

| Skill | What it does |
|---|---|
| `/cut-comments` | Removes the comments the change added that say nothing the code does not. |

## /cut-comments

Agents comment almost everything they write. `/cut-comments` goes back over the change and keeps a
comment only when deleting it would lose something a reader cannot recover from the code, the names
and the types: why a decision was made, why the obvious alternative is wrong, or a constraint that
comes from outside the code.

```
/cut-comments
/cut-comments packages/medications/lib
/cut-comments main..HEAD
/cut-comments packages/medications/lib/cda --all
/cut-comments --dry-run
```

| Argument | Effect |
|---|---|
| none | Judges the comments added or reworded on this branch, uncommitted work included. |
| paths | Limits the work to those files or directories. |
| a git range | Replaces the default range. |
| `--all` | Also judges comments that predate the change, in the given paths only. |
| `--dry-run` | Reports what would be cut and edits nothing. |

What it cuts:

- restatements of a name, type or signature;
- example or expected values written in prose rather than in a type;
- comments on a type or interface describing logic implemented elsewhere;
- narration of the change ("now handles nulls") or of the code, step by step;
- commented-out code.

What it leaves alone: comments that predate the change, tool directives such as `eslint-disable`
and `@ts-expect-error`, licence headers, tags that tooling reads, TODOs that name a ticket, and
doc comments the repo's linter requires.

It edits comments only. When a comment holds something that belongs in code, such as a list of
allowed values that should be a union type, it cuts the comment and lists it under "should be
code" in its report, and leaves the change to you. The report also lists every comment it kept and
why, so you can overrule it. It does not commit.
