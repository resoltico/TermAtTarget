# Contributing

## Build from a checkout

Use the Node version in `.node-version` and the npm version declared by
`packageManager` in `package.json`.

```sh
npm ci --ignore-scripts
npm run build
```

Find the paste-ready script and its SHA-256 manifest in `dist`.
[Installation guide](INSTALL.txt)

## Run checks

Run `npm run quality` for portable lint, coverage and mutation tests.
Install actionlint to include workflow lint locally. On macOS, use
`brew install actionlint`. The hosted jobs require the checksum-pinned
tool. [Quality gates](QA.md#portable-gate)

Run the native suite on a Mac that can run the pinned Node binary.

```sh
npm run test:integration:macos
```

Use `--dialogs`, `--terminal` or `--shortcuts` to exercise the relevant
interactive paths. [Native scope and setup](QA.md#native-macos-suite)

- Put isolated tests with supplied inputs in `tests/unit/` and tests of
  repository contents in `tests/repo/`. Mutation testing runs the isolated
  tests against altered source.
- Investigate survivors in the mutation report and add a test or remove
  redundant code. Review timeouts and runtime errors separately from the score.
- Keep reasons for ESLint exceptions in `tools/eslint/rules.mjs`.
- Review native calls when changing how the action accesses the filesystem or
  preferences. [Data boundaries](SECURITY.md)

## Source layout

The Shortcuts adapter counts items before reading the single selection. The
portable core decides what to open. `src/core/paths.js` takes path text
at the input boundary and preserves the directory requirement of a trailing
slash. `src/core/resolve.js` validates the physical directory through filesystem
facts supplied by the runtime. The launch port takes the decided terminal and
path as one request. `src/core/outcomes.js` declares
refusals, faults and remedies. `src/core/messages.js` supplies English
wording with named parameters. Its renderer takes an explicit locale and
falls back to English. `src/core/questions.js` declares each question and
offered answer. `src/core/settings.js` declares stored values and which
ones require an installed app.

The runtime implements Foundation access, preferences, terminal launching
and Standard Additions dialogs. `src/runtime/shortcuts-input.js` owns the
Shortcuts input envelope. `src/runtime/entry.js` exports `run` and returns
an empty list to Shortcuts. `src/core/failure-report.js` supplies refusal and
fault wording for the runtime to show. The native suite uses a separate entry in
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

Name rendering uses Unicode data vendored unmodified in
`tools/unicode/data/`. To refresh it, replace the vendor files, set the
version in `tools/unicode/tables.mjs` and run
`node tools/unicode/generate.mjs`. The gate regenerates the tables to check
that they match.

## The released artifact

`tools/bundle.mjs` builds `Term-At-Target.jxa` for the JavaScriptCore
engine in macOS 12.3. The generated script carries the AGPL version 3 only
notice, matching source address, macOS floor and Unicode data notice.
The release includes the paste-ready script, its checksum, plain-text
`INSTALL.txt`, [LICENSE](LICENSE), and a source archive from the same commit.

## Releasing

Update the version in `package.json`, refresh the lockfile with
`npm install --package-lock-only --ignore-scripts`, and update the heading
and version-specific source link in `INSTALL.txt`. Move the release's bullets
from Unreleased into one dated section in `CHANGELOG.md`. The gate checks that
the declared versions agree.

Pushing `v<version>` for the release commit starts the release workflow.
The workflow qualifies the tagged source, reproduces the build, and
publishes the attested files. Its prerequisites are:

- **The tag names the version the repository declares**, and that version has
  exactly one dated section in `CHANGELOG.md`.
- **Portable and native results are required.** Linux runs the portable gate
  with the pinned actionlint binary. macOS builds, runs the native suite and
  records its OS build, architecture, scope, source commit and artifact hash.
  The publishing job verifies that evidence again.
- **The build is reproducible.** The macOS job builds and qualifies the
  artifact. A separate Ubuntu job with read-only contents permissions
  rebuilds the same commit and compares the script and manifest byte for byte.
- **The tag still points at the commit being built** when the publishing job
  runs, and every asset's attestation verifies before it is published.

The workflow reads release notes from `CHANGELOG.md`. Its publishing job
runs scripts that use only Node's built-ins and modules in the checkout.
`tests/repo/entry-points.test.cjs` checks that dependency boundary.

`npm run package` archives the last commit with `git archive` and writes a
SHA-256 checksum. Git uses the commit time for archive entries. Commit any
source changes before packaging them. The release workflow runs the same
command on the tagged commit.

## Bumping Node and npm

The Node pin in `.node-version` also sets the minimum in `engines.node`. The
npm version, which writes the lockfile, appears in `packageManager` (what CI
installs) and `engines.npm` (what `engine-strict` holds a local install to).
The gate asserts each set agrees, but nothing watches for newer releases:
Dependabot does not track version files, so bumping is a deliberate manual
step.

## Dependency upkeep

The Quality schedule checks the hosted macOS image and audits the entire npm
lockfile. The audit report records the affected packages and dependency paths.
Review direct and transitive tools against their registries and upstream
releases. Review Node, npm, GitHub Actions, actionlint, and Unicode inputs
with their vendors when refreshing pins.

`tools/install-actionlint.sh` declares the release and the Linux amd64 tarball
digest used by the portable jobs. Update the version and digest together.
The Stryker overrides in `package.json` address the
[minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249),
[glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) and
[qs](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw) advisories.
Remove an override when its parent naturally resolves a patched version.
Verify the resolved tree, a clean restore, `npm audit --audit`, and the full
gate for each removal. Inspect timeouts and runtime errors in the mutation
report separately from its score.

## Contribution terms

By submitting a contribution (code, documentation, tests or other material) to
this repository, you:

- confirm that you wrote it or otherwise have the right to submit it on these
  terms;
- license it to everyone under this repository's public license,
  `AGPL-3.0-only`; and
- also grant Ervins Strauhmanis a perpetual, worldwide, non-exclusive,
  royalty-free, irrevocable license to use, reproduce, modify, distribute and
  sublicense it, and to license it under other terms, including the commercial
  terms described in [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md).

You keep the copyright in your contribution. Do not submit material you cannot
license on these terms; third-party components keep their own licenses. Each
pull request confirms these terms with the checkbox in its template.
