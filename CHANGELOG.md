# Changelog

## [Unreleased]

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
