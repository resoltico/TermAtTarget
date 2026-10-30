# Contributing

## Working on this

```sh
brew install actionlint
npm ci --ignore-scripts
npm run quality
```

`npm run quality` runs the whole portable gate without rebuilding, which is
what CI does, so that a stale committed artifact fails instead of shipping.
After changing `src/`, run `npm run build`, review the artifact diff, and run
the gate again.

The native suite needs a Mac and is run separately:

```sh
npm run test:integration:macos
```

Add `--dialogs` when a change touches a question: each is shown for a second
by the real Standard Additions, with the options the artifact passes. The
settings lists cannot be dismissed on a timer, so a change to them is checked
by hand (QA.md, Interactive acceptance). Add `--terminal` when a change
touches the launch or the terminal apps: it opens one real window in each
supported app that is installed, checks where its shell is, and closes it. Add `--shortcuts` when a
change touches what the action is given or how it runs: it runs the artifact
through Shortcuts itself, by both input routes. That needs the two harness
shortcuts, built once with `node tests/integration/shortcuts/build.mjs` and
added by opening each file it prints, and the app running the suite allowed
under Privacy & Security > Accessibility: a refused run shows an alert, which
the suite reads and dismisses as a person would. Nothing else in the gate opens a window.

The action writes no file, and the gate refuses a filesystem-writing call
anywhere under `src/`. Its settings are the one thing it writes, through
NSUserDefaults, which the gate allows only in `src/runtime/preferences.js`.
Keep it that way: INSTALL.txt tells people that domain is all there is to
remove. The native suite and the Shortcuts harness save settings only in
domains of their own, so running them never touches a person's settings.

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

`src/core/` decides: the shared vocabulary (`src/core/vocabulary.js` -- the
answers, the settings' values and the terminal apps), the settings, path rules,
link resolution, the destination policy, and the run itself. It names nothing
native and is tested in Node with nothing standing in for it. Wording shown to
a person lives with the questions in `src/runtime/`; the meaning of each answer
lives in the core, and a test fails if a value has no words.

`src/runtime/` touches macOS: Foundation's answers about files, the saved
preferences, the questions and settings lists, and the launch, which a deadline
bounds. The core asks through ports -- `files`, `preferences`, `terminals`,
`questions` and `settingsScreen`, assembled in `src/runtime/host.js`. Each
adapter takes the bridge (`ns`, `objc` and an out-parameter maker) as a value,
so its tests hand it a fake. Every program the action runs, every terminal
app's bundle identifier and the preferences domain are named in
`src/runtime/executables.js` and nowhere else.

To support another terminal app, add it to `src/core/vocabulary.js` and its
bundle identifier to `src/runtime/executables.js`, then run the native suite
with `--terminal` with the app installed: it must find the app's shell at the
folder it was asked to open before the app can be listed. Measure it with
`$NAME`, `$(...)`, backticks and `~` in folder names too: an app that expands
any of them must say so in the vocabulary, as kitty's `readsVariables` does,
and the core must refuse what it would misread.

A new module needs no list: the build finds every module under `src/`, and
refuses one the bundle does not reach from `src/runtime/entry.js`, a require
that is not a literal relative path to a module there, a cycle, and any
require from the core into the runtime. The core may not use anything JXA
puts in scope to reach macOS (`ObjC`, `$`, `Application`, `Path` and the
rest); the gate parses each core module to check, so naming them in a comment
or a string is fine.

## Unicode data

How names are shown depends on Unicode's own data, vendored unmodified in
`tools/unicode/data/`. To move to a newer Unicode version, replace those files
with the new version's, change the version in `tools/unicode/tables.mjs`,
and run `node tools/unicode/generate.mjs`; the gate refuses tables that are
not what the data generates.

## The released artifact

Do not edit it. `dist/Term-At-Target.jxa` is generated from `src/` by
`tools/bundle.mjs`, which bundles it with esbuild for macOS 12.3's engine
(`safari15.4`): whitespace and comments stripped, names kept, as
ImageFilesToPDF does. Its header is MPL's per-file notice, the version's
source address and the macOS floor; the full licence ships as the release's
`LICENSE`. The one comment kept is the Unicode data notice, which
`tools/unicode/tables.mjs` writes as a `/*! ... */` comment so that it travels
with the tables, at the end of the file. Nothing in it is meant to be edited,
so an installed copy is the released file byte for byte.

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

## Bumping Node and npm

The Node version appears in `.node-version`, `mise.toml` and `engines`; the
npm version, which writes the lockfile, in `packageManager` (what CI
installs) and `engines.npm` (what `engine-strict` holds a local install to).
The gate asserts each set agrees, but nothing watches for newer releases:
Dependabot does not track version files, so bumping is a deliberate manual
step.

actionlint is installed from Homebrew unpinned, and GitHub's macOS image moves
on its own, so the Quality workflow also runs every Monday: a change in either
surfaces as a failing job rather than as silent drift.
