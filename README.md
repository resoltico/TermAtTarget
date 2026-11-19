# Term At Target

Term At Target is a macOS Finder Quick Action that opens Terminal, Ghostty,
iTerm2 or kitty at a location you choose. Select a file to open its containing
folder, select a folder to open inside it or at its parent, or follow a Finder
alias to its target.

Source and releases at https://github.com/resoltico/TermAtTarget

## Install

On macOS 12.3 or later, download `Term-At-Target.jxa` and `INSTALL.txt` from
the [latest release](https://github.com/resoltico/TermAtTarget/releases/latest).
Follow [INSTALL.txt](INSTALL.txt) to verify the download and paste the script
into **Run JavaScript for Mac Automation** in a Shortcuts Quick Action.
Set the Quick Action to receive **Files** from Finder and give the action
**Shortcut Input** directly. You can also build the script from a development
checkout. [Building from source](CONTRIBUTING.md)

## Comparison

| Option | Finder setup | Apps and destination choices |
| --- | --- | --- |
| Term At Target | Paste a script into a Shortcuts Quick Action | Terminal, Ghostty, iTerm2 or kitty. Open inside a folder or at its parent, open a file's containing folder, or decide how to handle an alias. |
| [Apple's Terminal commands](https://support.apple.com/en-qa/guide/terminal/trmlb20c7888/2.15/mac/27) | Use Finder's built-in path bar menu | Apple Terminal. Open a window or tab at a folder in Finder's path bar. |
| [OpenInTerminal](https://github.com/Ji4n1ng/OpenInTerminal) | Install the app and configure Finder integration | Open selected folders or files in supported terminals, editors or other configured apps. Terminal choices include iTerm, Ghostty, kitty, WezTerm, Warp and others. |
| [cdto](https://github.com/jbtule/cdto) | Install the app and add it to the Finder toolbar | Open a Terminal window at a Finder directory. |

## What opens where

| Input | Behaviour |
| --- | --- |
| No input | **Choose Folder…** opens inside the folder you choose. **Settings…** changes the saved choices. If a setting is unrecognised or the selected terminal app is missing, the start prompt offers Settings and Cancel. |
| One file | Opens the directory containing the file. |
| One folder or package | Asks whether to open inside or at its parent unless the folder policy supplies the answer. The filesystem root opens directly. |
| One Finder alias | Asks whether to follow the alias or open its containing folder unless the alias policy supplies the answer. Its own folder can open even if the target is unavailable. |
| One symbolic link | When Shortcuts supplies its target, the target follows the file or folder rule. When the action receives the link's own path, the link and folder policies determine where to open. |
| Followed target is a folder | Applies the folder policy to the target. |
| Followed target is a file | Opens the directory containing the target. |
| Multiple items | Shows the single-selection requirement and opens nothing. |
| Typed path ending in `/` | Requires the path to name a folder. A symbolic link with that spelling must lead to a folder even when the configured choice is to open the link's containing folder. |
| Cancel | Opens nothing. |

The questions show the item's name, the folder it is in and the chosen
terminal app. Parent locations inside your home folder appear with a
leading `~`. Return takes the default button and Esc cancels.

```
Where should Ghostty open?

Folder: Projects
In: ~/Downloads

            Cancel   Open in Parent   Open Inside
```

Alerts show full paths and give recovery guidance for a missing selection,
a missing link target or a destination that disappears. Questions and alerts
escape invisible controls such as line breaks and direction marks using
forms like `\u{202E}`. Edge spaces remain visible inside quotes, and supported
emoji and writing-system joiners stay as written.

The action makes one open request for a successful handoff. If the helper's
deadline passes before the result is known, the alert says the window may
still appear. Each terminal app controls its own window and tab behaviour.
[Launch and path guarantees](SECURITY.md)

## Settings

Run the shortcut with no input and choose **Settings…**. Choose a setting to
change, select its value, and choose **Done** to close the list. Each change
saves immediately. **Get Selected Files in Finder** can supply Finder's
selection even when you run the shortcut elsewhere, bypassing the start
prompt. Use **Shortcut Input** as described in the installation instructions.

| Setting | Values | Default |
| --- | --- | --- |
| Terminal app | Terminal, or Ghostty, iTerm2 or kitty when installed | Terminal |
| When a folder is selected | Ask each time, Open inside, Open in parent | Ask each time |
| When a Finder alias is selected | Ask each time, Follow the alias, Open where it is | Ask each time |

macOS locates each terminal app by its bundle identifier. If a saved app
is unavailable, the settings list marks it "(not installed)". Open a newly
downloaded app once from Applications before choosing it here. Term At Target
refuses to hand kitty a path containing `$` because kitty may expand it.

The settings live in the `com.resoltico.TermAtTarget` macOS preferences domain.
Run `defaults read com.resoltico.TermAtTarget` to inspect the saved values.
Unrecognised values are identified so you can replace them in Settings.
The action reads settings from that domain independently of the script.

## Path input

The action accepts absolute POSIX paths, local file URLs, and native JXA
Path, NSString and NSURL values. It decodes file URLs once. It rejects
relative paths, leading `~`, remote URLs, URL queries or fragments, encoded
separators, malformed Unicode, and direct `.` or `..` components. Relative
components inside a symbolic-link target follow filesystem semantics.

Shortcuts can supply a link's target, copy an item to a temporary path, or
discard an unavailable input. The action works with what reaches it. To
preserve Finder selection identity as far as Shortcuts allows, feed
**Shortcut Input** directly into the JavaScript action. [Installation and removal](INSTALL.txt)

## License

Term At Target is licensed under the [GNU Affero General Public License,
version 3 only](LICENSE) (`AGPL-3.0-only`). You may use it, including
commercially, and copy, modify and share it under those terms. It comes
without warranty. If you distribute the script or a modified version, keep
its notices and make the corresponding source available as the license
requires. The generated JXA names the source for its version.
Dependencies keep their own licenses. No separate commercial license is
currently offered through this repository. [Commercial licensing](LICENSE-COMMERCIAL.md)

## Project documentation

- [Contributing](CONTRIBUTING.md) covers source layout, development and builds.
- [Quality assurance](QA.md) describes verification and its limits.
- [Security](SECURITY.md) describes data boundaries and private reporting.
