# Term At Target

A macOS Finder Quick Action that opens Terminal where you point it: at a
selected file's folder, inside a selected folder or at its parent, or where a
Finder alias or symbolic link leads. It is one paste-ready JavaScript for
Automation script; nothing is installed, and nothing is written to disk.

Source, releases and build attestation: https://github.com/resoltico/TermAtTarget

## Requirements

macOS 12.3 or later, and Apple's Terminal. The script's syntax and built-ins
are checked against the JavaScript engine of macOS 12.3; it has been run on
macOS 27, on Apple Silicon, including through Shortcuts itself.
[QA.md](QA.md) says what is measured and what is not.

## Install

Download `Term-At-Target.jxa` and `INSTALL.txt` from the
[latest release](https://github.com/resoltico/TermAtTarget/releases/latest)
and follow INSTALL.txt. In short: paste the whole script into Shortcuts'
**Run JavaScript for Mac Automation** action, in a shortcut used as a Quick
Action that receives **Files** from Finder. Do not use **Run JavaScript on Web
Page**, and do not paste it into **Run AppleScript**.

The same script is `dist/Term-At-Target.jxa` in this repository. Every release
file carries a build attestation; INSTALL.txt shows how to verify it.

## What it does

| Input | Behaviour |
| --- | --- |
| No input | Choose a folder; open inside it. No fallback to Finder selection. |
| One file | Open its containing folder. |
| One folder or package | Ask for inside or parent, unless configured otherwise. The root opens without asking. |
| Finder alias | Ask for its target or its own containing folder. |
| Symbolic link | Same target-versus-link-location choice. |
| Target is a folder | Apply the folder policy to that target. |
| Target is a file | Open that target's containing folder. |
| Multiple items | Report the single-selection requirement; open nothing. |
| A typed path ending in `/` that names a file | Refused: a name ending in `/` cannot be a file. |
| A typed path ending in `/` that names a link | The link is followed to check it leads to a folder, as the filesystem would; refused if it leads to a file or nowhere. |
| Cancel | Open nothing, and return no output. |

Folders are not treated as collections of work. There is one open request per
completed invocation, made to Terminal by its bundle identifier: success means
the request was handed over, not that a shell has finished starting. If
`/usr/bin/open` has not finished after 10 seconds it is told to stop and the
run says the window may still appear; nothing is retried. If open fails, the run
says so with its exit status.

Each question asks what it needs and shows each path once -- the item's
name, and the folder it is in -- with a button for each answer:

```
Where should Terminal open?

Folder: Projects
In: /Users/you/Downloads

            Cancel   Open in Parent   Open Inside
```

For a Finder alias or a symbolic link the question is "Follow this Finder
alias, or open Terminal where it is?", answered with "Open Where It Is" or
"Follow Alias". Return takes the default, on the right; Esc cancels. A name
holding something invisible -- a line break, a direction mark, a soft hyphen,
a space at either end -- is shown in quotes, with each such character written
as `\u{XXXX}`; emoji and the joiners scripts like Devanagari are written with
are shown as they are.

Packages are folders here: you may open inside them.

Alias location works even when the alias's target is unavailable. Target
resolution does not ask to mount a missing alias volume or show a resolution
prompt. Symbolic-link traversal preserves filesystem component order rather
than simplifying `link/../folder` before following `link`.

## Configuration

The source-controlled settings live in **config.json**:

```json
{
  "defaultFolderAction": "ASK",
  "defaultLinkAction": "ASK"
}
```

`defaultFolderAction` is `ASK`, `INSIDE` or `LEVEL` (its parent folder).
`defaultLinkAction`, for a Finder alias or a symbolic link, is `ASK`, `TARGET`
(where it points) or `LINK` (the folder the link itself is in).
Unrecognized values or extra keys are errors, not silent fallbacks. No settings
are remembered outside the script.

Change config.json and run `npm run build` for a reproducible configured build.
For a personal pasted copy without a development setup, the same two settings
are exposed as `TERM_AT_TARGET_CONFIG` near the top of the generated script.
Such an edit is a local customization: it changes its checksum, is not a source
edit, and will be overwritten when a new generated version is pasted.

## Path and selection integrity

Names are not trimmed, split on newlines, interpreted by a shell or expanded as
variables. Absolute POSIX paths and local `file:///` URLs are accepted; file
URLs are decoded once. Native JXA Path, NSString and NSURL inputs are supported.
Relative paths, `~`, remote URLs, URL queries/fragments, encoded `/`, malformed
Unicode and direct `.`/`..` components are rejected. Relative components inside
a symbolic-link target are resolved with filesystem semantics.

The action operates on the path Shortcuts actually supplies. A preceding action
that copies a file into a temporary `input_...` location or resolves an alias
has already lost the original selection's identity. This script deliberately
does not guess that identity from a filename or from Finder's later selection.
[INSTALL.txt](INSTALL.txt) says how to feed the selection in unchanged.

## Runs are independent

Each run makes its own request and shares nothing with any other: the action
writes nothing to disk, keeps no lock and remembers nothing. Two runs at once
open two windows. Terminal's own window, tab and startup preferences decide
how a request is presented; this action does not reuse, type into or close an
existing shell.

## Development

The Shortcut needs nothing installed. Development needs Node (the version in
`.node-version`) and, for the workflow linter, Homebrew:

```sh
brew install actionlint
npm ci --ignore-scripts
npm run quality
```

`quality` verifies the committed `dist/` **before** any rebuild, so a stale
artifact fails instead of shipping. After editing sources, run `npm run build`
and review the artifact diff. What the gate checks and why is in
[QA.md](QA.md); how to work on the code is in
[CONTRIBUTING.md](CONTRIBUTING.md).

On a Mac:

```sh
npm run test:integration:macos
node tests/integration/macos.mjs --dialogs --terminal --shortcuts
```

`--dialogs` shows each question for a second. `--terminal` opens one real
Terminal window at a disposable folder, checks that its shell is there
exactly, and closes it. `--shortcuts` runs the artifact through Shortcuts
itself, after a one-time import of two harness shortcuts
(`node tests/integration/shortcuts/build.mjs`); it opens and closes six
Terminal windows. `npm run package` writes a deterministic source archive to
`artifacts/`.

## Repository map

```
config.json              Source settings
src/core/                Path rules, link resolution, policy and the run
src/runtime/             Foundation, dialogs, and the bounded launch
tools/                   Build, verification, release notes and packaging
tools/lint/              The source gate's rule families
tools/unicode/           Unicode data files, and the table generator
tests/unit/              Core, runtime and tool tests, each given its world
tests/repo/              Checks of the real repository and workflows
tests/integration/       The native macOS suite
dist/                    Single-file JXA and its SHA-256 manifest
.github/workflows/       Quality and release workflows
```

## Scope and maintenance

Opening Terminal is a path-based handoff, not an atomic operation with directory
lookup: another process can rename or replace a path after validation. Selected
items are never written, but commands later entered in Terminal naturally can
modify their working directory. There is no performance or universal host
compatibility claim.

[CONTRIBUTING.md](CONTRIBUTING.md) describes changes and releases.
[SECURITY.md](SECURITY.md) describes boundaries. [QA.md](QA.md) records what is
known to hold, how it was measured, and what has not been established.

MIT licensed. Copyright (c) 2026 Ervins Strauhmanis.
