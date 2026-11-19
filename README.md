# Term At Target

A macOS Finder Quick Action that opens a terminal app -- Terminal, Ghostty,
iTerm2 or kitty -- where you point it: at a selected file's folder, inside a
selected folder or at its parent, or where a Finder alias leads. It is one
paste-ready JavaScript for Automation script; nothing is installed, and the
only thing it writes is its own settings.

Source, releases and build attestation: https://github.com/resoltico/TermAtTarget

## Requirements

macOS 12.3 or later. Apple's Terminal is used unless you choose Ghostty,
iTerm2 or kitty in the settings. See [QA.md](QA.md) for tested platforms.

## Install

Download `Term-At-Target.jxa` and `INSTALL.txt` from the
[latest release](https://github.com/resoltico/TermAtTarget/releases/latest)
and follow INSTALL.txt. In short: paste the whole script into Shortcuts'
**Run JavaScript for Mac Automation** action, in a shortcut used as a Quick
Action that receives **Files** from Finder. Do not use **Run JavaScript on Web
Page**, and do not paste it into **Run AppleScript**.

Every release file carries a build attestation. INSTALL.txt shows how to
verify it. To build from source, run `npm run build` after installing the
development tools. The script and checksum manifest appear in the ignored
dist directory.

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

A completed run makes one open request. If the request passes its deadline,
the alert says the window may still appear.

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
where it is?", answered with "Open Where It Is" or "Follow Alias". A selected
symbolic link arrives from Shortcuts as its target. A symbolic link supplied
as a typed path can open at its own location or at its target.

Each question names the terminal app chosen in the settings. Return takes the
default, on the right. Esc cancels. A name
holding something invisible -- a line break, a direction mark, a soft hyphen,
a space at either end -- is shown in quotes, with each such character written
as `\u{XXXX}`; emoji and the joiners scripts like Devanagari are written with
are shown as they are. Failure alerts use the same escaping and show the
full path.

Packages are folders here: you may open inside them.

An alias can open its own folder even when its target is unavailable.
[SECURITY.md](SECURITY.md) describes the limits of filesystem validation
and alias resolution.

## Settings

Run Term At Target with nothing selected -- from the Shortcuts app, the menu
bar, or its keyboard shortcut -- and choose **Settings…**. This needs the
action fed from Shortcut Input, as INSTALL.txt sets it up: fed from Get
Selected Files in Finder, it is handed whatever Finder has selected, even in a
window behind others, so Settings… is never offered.

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

## Further reading

[SECURITY.md](SECURITY.md) covers the action's data boundaries.
[CONTRIBUTING.md](CONTRIBUTING.md) covers building and changing the source.
[QA.md](QA.md) describes the checks and verified platforms.
