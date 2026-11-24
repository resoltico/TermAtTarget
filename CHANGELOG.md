# Changelog

## [Unreleased]

## [3.0.1] - 2026-11-24

- Rebuild and import the Term At Target QA shortcuts for isolated runs. The harness matches the current refusal before dismissing an alert and holds its staging lease after an unconfirmed run.
- Settings refuse to save a terminal app that becomes unavailable while its choice is open.
- Use Unicode 18.0 data to decide which joiners and variation selectors to preserve when displaying filenames and paths.
- Release publication requires passing Linux checks and complete native case and presentation evidence tied to the macOS build and source commit.
- Scheduled Quality runs audit the npm lockfile and retain the report.
- Refresh development dependencies, including fast-check 4.11.0 and patched minimatch, glob and qs releases for the mutation-test tools.

## [3.0.0] - 2026-11-19

- Project code is licensed under AGPL-3.0-only. Contributors also grant the maintainer rights to license their contributions under separate terms.
- Download Term-At-Target.jxa from Releases or use `npm run build`. The generated script and checksum manifest are no longer tracked in Git.
- Use Node 26.13.1 and npm 12.2.3 for development. The repository no longer ships mise.toml or its task aliases.
- Replace the script in your existing shortcut to upgrade. Saved settings carry over.
- Failure alerts show full paths with invisible and direction-changing characters escaped the same way as in questions.
- Failure alerts give specific headings for invalid inputs, link and destination problems, unavailable apps and failed or unconfirmed launches.
- Alerts clarify how to replace relative paths, describe link traversal and missing native metadata, and escape direction controls in quoted saved text.
- An unconfirmed launch alert now distinguishes a missed deadline, a lost observation and cleanup failures. It reports that the window may still appear.
- Alias and kitty alerts suggest a rerun with a different button only when the run offered that choice. Saved policies get the applicable Settings route.
- Missing selections, dangling followed links and vanished destinations get separate recovery instructions and keep the native error details.
- Settings and alerts distinguish quoted saved text from numbers and show empty text as two quotes.
- Source archives use Git and commit timestamps. `npm run package` archives HEAD and excludes uncommitted work. `SOURCE_DATE_EPOCH` no longer changes archive times.
- Release publication waits for a read-only Ubuntu build to match both files from the qualified macOS build byte for byte.
- Contributors find wording in `src/core/messages.js`, outcome declarations in `src/core/outcomes.js` and questions in `src/core/questions.js`.
- The production bundle exports only run. The native suite bundles its own test entry and checks refusal and fault kinds.
- Example tests live together by module, with property tests kept separate. The source gate no longer imposes a 150-line limit.
- Update the development gate to ESLint 10.15.0 and fast-check 4.10.3.

## [2.0.2] - 2026-10-31

- Feed the action from Shortcut Input, not Get Selected Files in Finder, which passes Finder's selection even with nothing chosen, so Settings… was never offered.

## [2.0.1] - 2026-10-30

- The released script is minified with comments stripped, about 49 KB instead of 107 KB; behaviour is unchanged, and the sources are at the address in its header.
- The script's header is MPL's per-file notice with its source address instead of the full licence, which ships as the release's `LICENSE`; the Unicode data notice is kept at its end.
- Contributors build with esbuild (pinned 0.28.2) and need no module list: every module under `src/` must be reached from the entry, and the graph rules are checked first.
- npm is pinned to 12.2.1 (`packageManager`, `engines.npm`), and CI installs that npm; the Quality workflow also runs weekly to surface runner and actionlint drift.
- The gate parses the core for macOS globals instead of matching words, and requires README and INSTALL.txt to list every setting and value in the settings screen's words.

## [2.0.0] - 2026-10-30

- `config.json` and `TERM_AT_TARGET_CONFIG` are removed and 1.x choices are not carried over; set them once in the new settings, as [README.md](README.md#settings) describes.
- Settings live in the macOS preferences domain `com.resoltico.TermAtTarget` and nowhere else; removing the action now also takes `defaults delete com.resoltico.TermAtTarget`.
- Saved values are lowercase `ask`/`inside`/`parent` for folders and `ask`/`follow`/`stay` for aliases, replacing 1.x's `LEVEL`, `TARGET` and `LINK`; others stop the run, named.
- Running with nothing selected now asks first, Choose Folder… or Settings…, one more click before choosing a folder; each setting is saved as soon as it is changed.
- Ghostty, iTerm2 or kitty can be chosen instead of Terminal, found by bundle identifier however installed; a missing app is named before any question and marked in the settings.
- kitty expands variables in folder paths, so a folder whose path contains `$` is refused for kitty rather than opened somewhere else.
- Refusals and failures appear in Term At Target's own alert with a heading and what to do, and the run ends without a Shortcuts error.
- Questions name the chosen app, as in "Where should Ghostty open?", and show folders inside your home folder from `~`.
- The alias setting reads "When a Finder alias is selected": Shortcuts hands over where a symbolic link leads, so a selected symbolic link opens as its target would.
- The script holds no settings, so an installed copy is the released file byte for byte and its checksum and attestation verify.
- Contributors find shared words in `src/core/vocabulary.js`, and the macOS adapters behind the `files`, `preferences`, `terminals`, `questions` and `settingsScreen` ports.
- Development needs Node 26.13.0; the native `--terminal` check opens every installed supported app, and `--shortcuts` needs Accessibility permission to read its alerts.

## [1.0.1] - 2026-10-06

### Changed

- Project code is now licensed under MPL 2.0, replacing MIT for this release.
  The standalone script carries the license and matching source location;
  vendored Unicode data retains its Unicode License.

### Fixed

- File-reference URLs are checked before Foundation resolves them. Malformed
  percent escapes in text and encoded slashes in text or native NSURL inputs
  are refused instead of being rewritten into different filenames.

### Internal

- Native Terminal and Shortcuts checks preserve literal emoji in `lsof`
  output as well as escaped UTF-8, avoiding false working-directory failures.

## [1.0.0] - 2026-09-28

- First release.
