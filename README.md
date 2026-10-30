# Term At Target

A macOS Finder Quick Action that opens a terminal app -- Terminal, Ghostty,
iTerm2 or kitty -- where you point it: at a selected file's folder, inside a
selected folder or at its parent, or where a Finder alias leads. It is one
paste-ready JavaScript for Automation script; nothing is installed, and the
only thing it writes is its own settings.

Source, releases and build attestation: https://github.com/resoltico/TermAtTarget

## Requirements

macOS 12.3 or later. Apple's Terminal is used unless you choose
[Ghostty](https://ghostty.org/), [iTerm2](https://iterm2.com/) or
[kitty](https://sw.kovidgoyal.net/kitty/) in the settings. The script's syntax and
built-ins are checked against the JavaScript engine of macOS 12.3; it has been
run on macOS 27, including through Shortcuts itself, and on macOS 15 by CI, both
on Apple Silicon.
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
| No input | Ask: Choose Folder… (opens inside it) or Settings…. If a saved setting isn't recognised or the chosen app isn't installed, say so and offer only Settings…. No fallback to Finder selection. |
| One file | Open its containing folder. |
| One folder or package | Ask for inside or parent, unless configured otherwise. The root opens without asking. |
| Finder alias | Ask for its target or its own containing folder. |
| Symbolic link | Shortcuts hands over where it leads, so it opens as that item would. A broken one arrives as nothing selected. |
| Target is a folder | Apply the folder policy to that target. |
| Target is a file | Open that target's containing folder. |
| Multiple items | Report the single-selection requirement; open nothing. |
| A typed path ending in `/` that names a file | Refused: a name ending in `/` cannot be a file. |
| A typed path ending in `/` that names a link | The link is followed to check it leads to a folder, as the filesystem would; refused if it leads to a file or nowhere. |
| Cancel | Open nothing, and return no output. |

Folders are not treated as collections of work. There is one open request per
completed invocation, made to the terminal app by its bundle identifier: success
means the request was handed over, not that a shell has finished starting. If
`/usr/bin/open` has not finished after 10 seconds it is told to stop and the
run says the window may still appear; nothing is retried. If open fails, the run
says so with its exit status.

A run that is refused or fails says so in Term At Target's own alert -- a
heading such as "Select one item at a time" or "Ghostty isn't installed", and
below it what happened and what to do -- and then ends, rather than leaving
Shortcuts to show the error. A failure without a heading of its own is headed
"Term At Target couldn't finish".

Each question asks what it needs and shows each path once -- the item's
name, and the folder it is in, written from `~` inside your home folder --
with a button for each answer:

```
Where should Ghostty open?

Folder: Projects
In: ~/Downloads

            Cancel   Open in Parent   Open Inside
```

For a Finder alias the question is "Follow this Finder alias, or open Ghostty
where it is?", answered with "Open Where It Is" or "Follow Alias". Shortcuts
resolves a selected symbolic link before the action sees it (measured, both
from the Quick Action's input and from Get Selected Files in Finder), so a
symbolic link is never asked about; the same choice exists for one that
reaches the action some other way. Each question names the terminal app chosen in the settings.
Return takes the default, on the right; Esc cancels. A name
holding something invisible -- a line break, a direction mark, a soft hyphen,
a space at either end -- is shown in quotes, with each such character written
as `\u{XXXX}`; emoji and the joiners scripts like Devanagari are written with
are shown as they are.

Packages are folders here: you may open inside them.

Alias location works even when the alias's target is unavailable. Target
resolution does not ask to mount a missing alias volume or show a resolution
prompt. Symbolic-link traversal preserves filesystem component order rather
than simplifying `link/../folder` before following `link`.

## Settings

Run Term At Target with nothing selected -- from the Shortcuts app, the menu
bar, or its keyboard shortcut -- and choose **Settings…**:

```
Choose a folder to open in Ghostty.

                 Cancel   Settings…   Choose Folder…
```

The settings are a list; pick one, choose its new value, and pick **Done**
when finished. Each change is saved as soon as it is made.

| Setting | Values | Until changed |
| --- | --- | --- |
| Terminal app | Terminal, and Ghostty, iTerm2 or kitty when installed | Terminal |
| When a folder is selected | Ask each time, Open inside, Open in parent | Ask each time |
| When a Finder alias is selected | Ask each time, Follow the alias, Open where it is | Ask each time |

They are saved in macOS preferences, in the domain `com.resoltico.TermAtTarget`,
as `terminal` (`terminal`, `ghostty`, `iterm2` or `kitty`), `folder` (`ask`, `inside` or `parent`)
and `link` (`ask`, `follow` or `stay`). `defaults read com.resoltico.TermAtTarget`
shows them, and only that domain is read: the same names in another app's
preferences or your global ones are ignored. A value that is not one of these
-- written by hand with `defaults`, say -- is an error that names the setting,
not a silent fallback; the settings list shows it as not recognised so it can
be replaced.

A terminal app is found by its bundle identifier, so it does not matter how or
where it was installed: from the vendor, or with a Homebrew cask (which installs
the vendor's own app), in `/Applications`, `~/Applications` or elsewhere, as
long as macOS knows it. If the chosen app is later removed, a run says so
before asking anything, and the settings list marks it "(not installed)".
macOS may take a moment to know an app you have just installed, and asks
before an app downloaded from the Internet opens for the first time; until you
answer, nothing appears, and then the folder opens. Opening a new app once
from Applications takes care of both. Each app's own preferences decide whether a request
opens a window or a tab: Ghostty and iTerm2 open a tab when they already have
a window.

kitty expands environment variables in the folder it is given, so a folder
named `$HOME notes` would open in your home folder instead. Term At Target
never hands kitty a folder whose path contains `$`: such a run is refused with
a message saying why, and the other apps open it as named.

Supporting another terminal app takes one entry in `src/core/vocabulary.js`,
its bundle identifier in `src/runtime/executables.js`, and a measurement that
the shell it starts is at the folder it was asked to open, which the native
suite's `--terminal` check makes for every supported app that is installed.

The script itself holds no settings, so every installed copy is byte for byte
the released file and its checksum always verifies.

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

Each run makes its own request and shares nothing with any other except the
saved settings, which it reads once at the start: the action writes no file,
keeps no lock and remembers nothing else. Two runs at once make two requests.
The terminal app's own window, tab and startup preferences decide how a request
is presented; this action does not reuse, type into or close an existing shell.

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
window in each supported terminal app that is installed, at a disposable
folder, checks that its shell is there exactly, and closes it. `--shortcuts`
runs the artifact through Shortcuts itself, after a one-time import of two
harness shortcuts (`node tests/integration/shortcuts/build.mjs`); it opens and
closes six Terminal windows, and reads and dismisses the alert a refused run
shows, which needs the app running the suite allowed under Privacy & Security
> Accessibility. The suite saves settings only in domains of its own, never in
yours. `npm run package` writes a deterministic source archive to
`artifacts/`.

## Repository map

```
src/core/                Vocabulary, settings, path rules, link resolution, the run
src/runtime/             Foundation, preferences, questions, and the bounded launch
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

Opening a terminal app is a path-based handoff, not an atomic operation with
directory lookup: another process can rename or replace a path after
validation. Selected items are never written, but commands later entered in the
terminal naturally can modify their working directory. There is no performance or universal host
compatibility claim.

[CONTRIBUTING.md](CONTRIBUTING.md) describes changes and releases.
[SECURITY.md](SECURITY.md) describes boundaries. [QA.md](QA.md) records what is
known to hold, how it was measured, and what has not been established.

Licensed under the Mozilla Public License 2.0; see [LICENSE](LICENSE). Copyright (c) 2026 Ervins Strauhmanis.
