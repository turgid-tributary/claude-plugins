# review-queue

Puts the number of open pull requests waiting on your review in the Claude Code status line:

```
You're a slacker, McFly: 9 reviews
```

It counts open PRs where you are a requested reviewer, skipping archived repositories, the same
set as GitHub's `review-requested:@me` search. The count is fetched when the session starts and
every five minutes after. If `gh` fails (not logged in, offline), the line reads
`You're a slacker, McFly: reviews: ?`.

## Requirements

- `gh`, logged in (`gh auth login`)

## How it works

This is a mod: a plugin of function hooks (`hooks/register.ts`) rather than commands or agents.
On `session.start` it runs `gh api search/issues` for `is:pr is:open review-requested:@me
archived:false`, reads `total_count`, and sets the line with `$.ui.status`. A `$.clock.every`
timer repeats that every five minutes.

To change the wording, edit `PREFIX` in `hooks/register.ts`; to change how often it refreshes,
edit `REFRESH_MS`.

## Developing

```bash
claude plugin validate --strict plugins/review-queue
claude plugin test plugins/review-queue
claude --plugin-dir plugins/review-queue    # load it from disk; edits hot-reload
```

Once Claude Code has loaded the mod from disk, `.claude-plugin/types/` holds the API typings and
`tsc -p plugins/review-queue` type-checks it.
