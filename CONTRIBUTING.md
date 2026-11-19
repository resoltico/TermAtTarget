# Contributing

## Working on this

```sh
brew install actionlint
npm ci --ignore-scripts
npm run quality
```

`npm run quality` runs the portable gate. Run `npm run build` to write the
paste-ready script and its SHA-256 manifest to the ignored dist directory.

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

[QA.md](QA.md) lists the quality gates, their rejecting cases, and the native
evidence. The implementation owns the relevant behavior and declarations.

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

The portable core decides what to open. `src/core/outcomes.js` declares
refusals, faults and remedies. `src/core/messages.js` supplies English
wording with named parameters. Its renderer takes an explicit locale and
falls back to English. `src/core/questions.js` declares each question and
offered answer. `src/core/settings.js` declares stored values and which
ones require an installed app.

The runtime implements Foundation access, preferences, terminal launching
and Standard Additions dialogs. `src/runtime/shortcuts-input.js` owns the
Shortcuts input envelope. `src/runtime/entry.js` exports `run` and returns
an empty list to Shortcuts. `src/runtime/failure-report.js` renders refusal
and fault alerts. The native suite uses a separate entry in
`tests/integration/entry.cjs` with the production bundler settings.

The module graph is discovered from `src/`. It requires literal relative
imports, forbids core dependencies on the runtime and rejects cycles. The
bundle must reach every source module.

To add a terminal app, add its identifier and proper name to
`src/core/vocabulary.js` and its bundle identifier to
`src/runtime/executables.js`. Add catalog entries only when the app needs
specific wording. Run the native suite with `--terminal` and the app installed.
Verify the exact working directory, including paths containing `$NAME`,
`$(...)`, backticks and `~`. Record expansions the app performs and express
the applicable path restrictions in the core.

## Unicode data

How names are shown depends on Unicode's own data, vendored unmodified in
`tools/unicode/data/`. To move to a newer Unicode version, replace those files
with the new version's, change the version in `tools/unicode/tables.mjs`,
and run `node tools/unicode/generate.mjs`; the gate refuses tables that are
not what the data generates.

## The released artifact

`npm run build` generates `Term-At-Target.jxa` from `src/` through
`tools/bundle.mjs`. esbuild targets the engine in macOS 12.3, removes
whitespace and ordinary comments, and keeps function names. The header gives
the MPL per-file notice, the version's source address and the macOS floor.
The full licence ships as the release's
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
- **The build is reproducible.** The macOS job builds and qualifies the
  artifact. A separate Ubuntu job with read-only contents permissions
  rebuilds the same commit and compares the script and manifest byte for byte.
- **The tag still points at the commit being built** when the publishing job
  runs, and every asset's attestation verifies before it is published.

Release notes come from `CHANGELOG.md` rather than a per-tag file, because a
second copy of the same prose is a second thing to keep in agreement. The
publishing job installs nothing, so `tools/release-notes.mjs` must reach no
installed package; `tests/repo/entry-points.test.cjs` holds it to that.

`npm run package` archives the last commit with `git archive` and writes a
SHA-256 checksum. Git uses the commit time for archive entries. Commit any
source changes before packaging them. The release workflow runs the same
command on the tagged commit.

## Bumping Node and npm

The Node pin in `.node-version` also sets the minimum in `engines.node`. The
npm version, which writes the lockfile, in `packageManager` (what CI
installs) and `engines.npm` (what `engine-strict` holds a local install to).
The gate asserts each set agrees, but nothing watches for newer releases:
Dependabot does not track version files, so bumping is a deliberate manual
step.

actionlint is installed from Homebrew unpinned, and GitHub's macOS image moves
on its own, so the Quality workflow also runs every Monday: a change in either
surfaces as a failing job rather than as silent drift.
