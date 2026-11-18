---
name: cut-comments
description: Removes superfluous comments that were added during a change, keeping only the ones that record a decision or constraint the code cannot express. Use after an agent has made changes, when asked to cut, prune, trim or clean up comments, or to remove comment slop from a branch or pull request.
argument-hint: "[paths or git range] [--all] [--dry-run]"
---

# Cut comments

Agents comment almost everything they write: a JSDoc line on each field of a type, a note over
each step of a function, a sentence about what the change did. Nearly all of it repeats what the
names and types already say, and it buries the few comments that matter. Your job is to remove the
comments this change added that do not earn their place, and to leave the code itself exactly as
it is.

Arguments given: $ARGUMENTS

- Paths limit the work to those files or directories.
- A git range (`main..HEAD`, `HEAD~3`) replaces the default range.
- `--all` also judges comments that were already there before the change, in the given paths
  only. Without paths, ask which paths before going further.
- `--dry-run` reports what you would cut and edits nothing.

## Which comments are in scope

Only comments that this change added or reworded. A comment that was there before is someone
else's decision and stays, even if it would fail the test below.

With no range given, the change is everything on this branch that the default branch does not
have, plus uncommitted work:

```bash
base=$(git merge-base HEAD "$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)")
git diff "$base" --stat              # committed and uncommitted changes to tracked files
git ls-files --others --exclude-standard   # new files not yet tracked: every comment in them is in scope
```

If the branch is the default branch, use the uncommitted changes alone. Read the added lines of
`git diff "$base"` to find the comments; read the file around each one before judging it, because
whether a comment is redundant depends on the code beside it.

Skip generated and vendored files, lock files, and anything the repo marks as not to be edited by
hand.

## The test

Delete the comment in your head and ask what a reader of the code has lost.

A comment stays only when the answer is something the reader could not recover from the code, the
names and the types:

- why a decision was made, especially a business decision;
- why the obvious alternative is wrong, so that nobody "fixes" it later;
- a constraint that comes from outside the code, such as a quirk of an upstream system or a rule
  in a specification, when getting it wrong would cause a bug.

Everything else goes. A comment being true, or well written, or having taken effort, is not a
reason to keep it.

### Cut

- **Restatements.** The comment says what the name, type or signature already says. This covers
  `@param` and `@returns` lines that repeat the parameter name and type in words.
- **Example or expected values in prose.** ``As sent, for example `active` or `completed`.`` The
  set of values belongs in a type. A comment listing them is unchecked and goes stale.
- **Behaviour described on a type.** A comment on a field of a type or interface that explains
  what some other part of the application does with it. That logic is in the code that implements
  it, and the comment is a second copy that nothing keeps in step.
- **Narration of the change.** "Now handles nulls", "previously this threw", "added for the
  grouping page". That is the commit message's job.
- **Narration of the code.** A line over each step of a function saying what the step does,
  section banners, and arrange / act / assert markers in tests.
- **Commented-out code** that the change added.

### Trim

When one comment holds a reason and a restatement together, keep the reason and cut the rest.
Reword only as far as needed for what is left to read as a sentence. Do not write new content.

### Never touch

- Tool directives: `eslint-disable`, `@ts-expect-error`, `@ts-ignore`, `prettier-ignore`,
  `# type: ignore`, `# noqa`, coverage pragmas, and the reason written beside one.
- Licence and copyright headers.
- Tags that tooling reads: `@deprecated`, `@internal`, API-documentation decorators and the like.
- A TODO or FIXME that names a ticket or an owner.
- Comments the repo's linter requires. Check the lint config for a rule such as
  `jsdoc/require-jsdoc` before deleting doc comments on exported symbols. Where one applies, shrink
  the comment to the least that passes.

## Worked example

Before:

```ts
export type CdaMedication = {
  /**
   * The entry's identifiers. The same entry keeps them across documents from
   * one sender, which `document.id` does not guarantee.
   */
  readonly ids: readonly CdaId[];
  readonly document: CdaDocumentContext;
  /** The free-text instructions, such as "Take 1 tablet by mouth daily". */
  readonly sig: string | null;
  /** As sent, for example `active` or `completed`. */
  readonly statusCode: string | null;
  /** As sent. `EVN` records what happened, `INT` what is intended. */
  readonly moodCode: string | null;
  /** When true the entry states that the medication was NOT given. */
  readonly negated: boolean;
  /**
   * The amount per administration, which is not the product's strength. No unit
   * means that many units of the product, such as tablets.
   */
  readonly dose: CdaQuantityRange | null;
  /** Not empty when the medication is to be taken only as needed. */
  readonly preconditions: readonly CdaMedicationPrecondition[];
};
```

After:

```ts
export type CdaMedication = {
  readonly ids: readonly CdaId[];
  readonly document: CdaDocumentContext;
  readonly sig: string | null;
  readonly statusCode: string | null;
  readonly moodCode: string | null;
  readonly negated: boolean;
  /** Per administration, not the product's strength. */
  readonly dose: CdaQuantityRange | null;
  readonly preconditions: readonly CdaMedicationPrecondition[];
};
```

- `sig`, `negated`, `preconditions`: the name and type already say it.
- `statusCode`, `moodCode`: expected values written in prose. Cut, and reported as "should be
  code", since a union type would say the same thing and be checked.
- `ids`: an observation about how senders behave, not a decision. Whatever relies on it is the
  place for that note.
- `dose`: trimmed. Reading the field as the product's strength is a real mistake that the type
  cannot prevent, so that clause stays and the rest goes.

And a comment that stays whole:

```ts
/**
 * Build the equivalence key for an RxNorm concept. We consider concepts
 * equivalent if they share the same strengths, dose form and ingredient list.
 * That lets us collapse two branded drugs like Advil and Motrin.
 *
 * Nothing is sorted here, on purpose. For a combination drug the strength is a
 * single string such as `10 MG / 20 MG`, in the order the drug's name lists its
 * components. Sorting the parts would make "nitrogen 80 % / oxygen 20 %" the
 * same drug as "nitrogen 20 % / oxygen 80 %".
 */
function equivalenceKey(rxNorm: RxNormConcept): string | null {
```

It records why these values define equivalence, and why the sort that a tidy-minded reader would
add is a bug. Neither can be read off the function body.

## Comments only

Change no code. Do not rename anything, add types, or move logic, even when a comment you are
cutting points at a better design. When a comment holds knowledge that belongs in code, cut it and
list it under "should be code" in the report, with the file and line and what the code change
would be. The user decides whether to make it.

If cutting a comment leaves an empty block, a doubled blank line or a dangling `/** */`, remove
that too.

## Finish

1. Check your own diff: `git diff` for the files you edited must show changes to comment lines and
   blank lines only. Revert anything else.
2. Run the repo's formatter and linter on the files you edited, using the commands its
   documentation gives, and fix what your edits caused.
3. Do not commit.

Then report, briefly:

- how many comments you cut and how many you trimmed, by file;
- each in-scope comment you kept, with its location and one line on what it records, so the user
  can overrule you;
- the "should be code" list.

With `--dry-run`, give the same report in the future tense and list the comments to be cut by
file and line.
