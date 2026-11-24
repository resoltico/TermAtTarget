# Term At Target

Term At Target is a macOS Finder Quick Action that opens Terminal, Ghostty,
iTerm2 or kitty at a location you choose. Select a file to open its containing
folder, select a folder to open inside it or at its parent, or follow a Finder
alias to its target.

Source and releases at https://github.com/resoltico/TermAtTarget

## Install

Term At Target targets macOS 12.3 or later. Download `Term-At-Target.jxa`,
`SHA256SUMS` and `INSTALL.txt` from the
[latest release](https://github.com/resoltico/TermAtTarget/releases/latest).
The installation guide covers verification, Finder integration and
shortcut input. [Installation guide](INSTALL.txt)

You can also build the script from a development checkout.
[Building from source](CONTRIBUTING.md) · [Verification scope](QA.md#verification-limits)

## Comparison

| Option | Finder setup | Supported apps | How it chooses the location |
| --- | --- | --- | --- |
| Term At Target | Paste the script into a Shortcuts Quick Action | Terminal, Ghostty, iTerm2 and kitty | Open inside a folder or at its parent, use a file's containing folder, or choose how to handle a Finder alias. With no input, choose a folder or open Settings. |
| [Apple's Terminal commands](https://support.apple.com/en-ca/guide/terminal/trmlb20c7888/mac) | Use Finder's built-in path bar menu | Terminal | Control-click a folder in the path bar to open a window or tab at that folder. |
| [OpenInTerminal](https://github.com/Ji4n1ng/OpenInTerminal) | Install the app and configure its [Finder integration](https://github.com/Ji4n1ng/OpenInTerminal/blob/master/Resources/README-Config.md) | Terminal apps including iTerm2, Ghostty, kitty, WezTerm, Warp and cmux, plus editors and compatible custom apps | Open the current Finder directory in a terminal or send selected files or folders to a supported app. |
| [cdto](https://github.com/jbtule/cdto/releases/latest) | Add the app to the Finder toolbar | Terminal | Click the toolbar button to open a Terminal window at a Finder directory. |

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
| Path ending in `/` | Requires a directory. A symbolic link with that spelling must lead to a directory even when the configured choice is to open the link's containing folder. |
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

Path alerts show full paths and give recovery guidance for a missing selection,
a missing link target or a destination that disappears. Questions and alerts
escape invisible controls such as line breaks and direction marks using
forms like `\u{202E}`. Edge spaces remain visible inside quotes, and supported
emoji and writing-system joiners stay as written.

The action makes one open request for a successful handoff. If the helper's
deadline passes before the result is known, the alert says the window may
still appear. Each terminal app controls its own window and tab behaviour.
[Launch and path guarantees](SECURITY.md)

## Settings

Run the shortcut with no input and choose **Settings…**. Choose a setting,
select its value, and choose **Use** to save it or **Back** to return without
saving. Choose **Done** to close Settings. [Input setup](INSTALL.txt)

| Setting | Values | Default |
| --- | --- | --- |
| Terminal app | Terminal, or Ghostty, iTerm2 or kitty when installed | Terminal |
| When a folder is selected | Ask each time, Open inside, Open in parent | Ask each time |
| When a Finder alias is selected | Ask each time, Follow the alias, Open where it is | Ask each time |

macOS locates each terminal app by its bundle identifier. If a saved app
is unavailable, the settings list marks it "(not installed)". Open a newly
downloaded app once from Applications before choosing it here. Term At Target
refuses to hand kitty a path containing `$` because kitty may expand it.

Settings identifies unrecognised saved values so you can replace them.
Run `defaults read com.resoltico.TermAtTarget` to inspect the preference
domain from Terminal.

## Path input

The action accepts absolute POSIX paths, local file URLs, and native JXA
Path, NSString and NSURL values. It decodes file URLs once. It rejects
relative paths, leading `~`, remote URLs, URL queries or fragments, encoded
separators, malformed Unicode, and direct `.` or `..` components. Relative
components inside a symbolic-link target follow filesystem semantics.

Shortcuts can supply a link's target, copy an item to a temporary path, or
discard an unavailable input. The action applies its rules to the item it
receives. Pass **Shortcut Input** directly into the JavaScript action to
avoid further conversion. [Installation and removal](INSTALL.txt)

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
