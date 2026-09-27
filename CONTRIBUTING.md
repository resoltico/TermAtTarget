# Contributing

## Working on this

```sh
brew install actionlint
npm ci --ignore-scripts
npm run quality
```

`npm run quality` runs the whole portable gate without rebuilding, which is
what CI does, so that a stale committed artifact fails instead of shipping.
After changing `src/` or `config.json`, run `npm run build`, review the
artifact diff, and run the gate again.

The native suite needs a Mac and is run separately:

```sh
npm run test:integration:macos
```

Add `--dialogs` when a change touches a question: each is shown for a second
by the real Standard Additions, with the options the artifact passes. Add
`--terminal` when a change touches the launch: it opens one real Terminal
window, checks where its shell is, and closes it. Add `--shortcuts` when a
change touches what the action is given or how it runs: it runs the artifact
through Shortcuts itself, by both input routes. That needs the two harness
shortcuts, built once with `node tests/integration/shortcuts/build.mjs` and
added by opening each file it prints. Nothing else in the gate opens a window.

The action writes nothing to disk, and the gate refuses a filesystem-writing
call anywhere under `src/`. Keep it that way: INSTALL.txt tells people there
is nothing to remove.

A unit test can only be handed the input a host was measured to give. When a
host behaves in a way nobody measured -- Shortcuts wrapping its input, or
overwriting errno -- only a run through that host finds it.

## What the gate enforces

`QA.md` is the contract. It specifies every check, its threshold, and why the
guard exists -- file size, coverage, ESLint mode, the language target,
mutation score, the native checks, and the facts that must agree across files.
This file does not restate those rules, so that there is one place to change
when they move.

Three things worth knowing before you write code, because they shape where
things go rather than merely passing or failing:

- **A test belongs in `tests/unit/` if it takes its world by parameter, and in
  `tests/repo/` if it inspects the real repository.** Only the former is
  meaningful under mutation, where the tree is deliberately altered.
- **A surviving mutant is a missing test or redundant code.** Neither is
  accepted as equivalent and left; write the test, or rewrite the code until
  every check in it carries meaning.
- **Rules that are switched off are listed with their reasons** in
  `tools/eslint/rules.mjs`. Add to that list only with a reason, never in bulk.

## Source layout

`src/core/` decides: path rules, link resolution, the destination policy, and
the run itself. It names nothing native and is tested in Node with nothing
standing in for it.

`src/runtime/` touches macOS: Foundation's answers about files, the dialogs,
and the launch, which a deadline bounds. Each adapter takes the bridge (`ns`, `objc` and an
out-parameter maker) as a value, so its tests hand it a fake. Every program the
action runs is named in `src/runtime/executables.js` and nowhere else.

A new module must be listed in `tools/module-order.mjs`. The build refuses a
module the list does not name, a require it cannot resolve, a cycle, and any
require from the core into the runtime.

## Unicode data

How names are shown depends on Unicode's own data, vendored unmodified in
`tools/unicode/data/`. To move to a newer Unicode version, replace those files
with the new version's, change the version in `tools/unicode/tables.mjs`,
and run `node tools/unicode/generate.mjs`; the gate refuses tables that are
not what the data generates.

## The released artifact

Do not edit it. `dist/Term-At-Target.jxa` is generated from `src/` by
`tools/bundle.mjs`: each module a scoped factory, the requires a declared
graph, and a loader that serves only what the graph declares. The header
quotes the name, version and licence, and `config.json` is inlined where a
personal pasted copy can edit it.

`INSTALL.txt` ships with it, and is deliberately plain text rather than
Markdown. It is a release asset, opened in a text editor, where `##` and
backticks would be clutter. Do not convert it.

## Releasing

Update the version in `package.json`, refresh the lockfile with
`npm install --package-lock-only --ignore-scripts`, change the version in the
`INSTALL.txt` heading, and add one dated section to `CHANGELOG.md`. The gate
requires all of these to agree.

A release is a tag. Pushing `v<version>` runs the release workflow, which
qualifies the tagged source on macOS, rebuilds the artifact, and publishes it
with a build attestation. It checks what a local build cannot:

- **The tag names the version the repository declares**, and that version has
  exactly one dated section in `CHANGELOG.md`.
- **The build is reproducible.** The committed artifact is checked against the
  source while it is untouched, then rebuilt, and the rebuild must leave
  `dist/` unchanged.
- **The tag still points at the commit being built** when the publishing job
  runs, and every asset's attestation verifies before it is published.

Release notes come from `CHANGELOG.md` rather than a per-tag file, because a
second copy of the same prose is a second thing to keep in agreement. The
publishing job installs nothing, so `tools/release-notes.mjs` must reach no
installed package; `tests/repo/entry-points.test.cjs` holds it to that.

`npm run package` makes the same deterministic source archive locally. It is
a snapshot, not a signed release.

## Bumping Node

The Node version appears in `.node-version`, `mise.toml` and `engines`. The
gate asserts they agree, but nothing watches for newer releases: Dependabot
does not track version files, so bumping is a deliberate manual step.

actionlint is installed from Homebrew unpinned, so a change in it surfaces as
a failing macOS job rather than as silent drift.
