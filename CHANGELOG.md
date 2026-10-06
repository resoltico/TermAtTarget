# Changelog

Notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
