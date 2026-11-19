# Quality gates

Run the portable gate with the toolchain in [CONTRIBUTING.md](CONTRIBUTING.md).

```sh
npm ci --ignore-scripts
npm run quality
```

## Portable gate

| Check | Property | Rejecting case |
| --- | --- | --- |
| Source discovery and syntax | The gate finds JavaScript under the source, test and tool trees and parses it with Node, including JXA. | A new JXA file has a syntax error. |
| Source text | Literal controls and invisible characters use escapes. Files have a final newline and carry no trailing whitespace or CR characters. | A literal bidi override appears in a string, or a file ends without a newline. |
| Runtime boundary | The core runs without JXA globals. Only the preferences adapter writes settings, and shipped code has no filesystem-writing calls. | A core module reads `ObjC`, or a runtime module calls a Foundation file-writing method. |
| Executables | The published external executable surface comes from `src/runtime/executables.js`. | A second module names an absolute executable path. |
| Module graph and bundle | Production reaches every source module via literal local requires. The graph is acyclic and the core imports no runtime adapter. | A core import points at a runtime file, or a source module is absent from the bundle. |
| Language target | The artifact parses as ES2022 and uses built-ins available at the macOS 12.3 floor. | Shipped code calls `Array.prototype.toSorted`. |
| Settings documentation | README and INSTALL.txt use the core catalog's setting and value labels. | A README settings row omits one of its values. |
| Repository consistency | Version, package name, Node and npm pins, language year and repository URL agree where declared. Release notes have a real date. | The Node pin and minimum disagree, or a release date is February 30. |
| Workflow tooling and actions | The macOS workflow linter installation agrees with CONTRIBUTING. Actions are pinned to full SHAs and actionlint checks both workflows when installed. | One workflow installs a different Brew formula, or an action uses a version tag. |
| Release separation | Qualification and a read-only Ubuntu rebuild are prerequisites for publication. Both the JXA and manifest must match. The publishing job installs no dependencies. | Reproduction gets write permissions, or publish runs npm ci. |
| Ignored outputs | Ignore rules cover generated directories, including the build output. | A later ignore rule re-includes the dist directory. |
| Unicode data | The checked-in Unicode tables are reproduced from the vendored inputs. | A generated range differs from its source data. |
| Document structure | Markdown has a title and no repeated heading path. | The document's opening section appears a second time. |
| Document hygiene | Documents contain no literal controls or invisible formatting characters. | A literal zero-width space appears in a paragraph. |
| Document references and links | Repository paths in backticks and local links resolve. The shared AGENTS.md examples are exempt from the path check. | A document names a deleted source module. |
| ESLint | JavaScript is checked with the all-rules preset and the documented adjustments in `tools/eslint/rules.mjs`. | A source statement calls a function using an undeclared identifier. |
| Coverage and mutation | Unit and repository tests require 100% lines, branches and functions. Stryker mutates the shipped source except generated Unicode data, with a break threshold of 98 and a target of zero survivors. | A branch has no exercising test, or reversing a rule leaves tests passing. |

The portable tests also load the production bundle in a bare Node VM and
exercise its `run` export with stand-in JXA globals. Their simulated bridge
uses the arguments and return shapes recorded by native tests.

## Native macOS suite

`npm run test:integration:macos` compiles the production rendering with
osacompile and uses a separate bundle from `tests/integration/entry.cjs` to
drive the actual adapters. The test entry checks Foundation input types,
package metadata, Finder aliases, component-ordered symbolic-link traversal,
file and folder destinations, and refusal and fault kinds. A missing item and
an inaccessible item exercise distinct native error codes. A folder renamed
while its question is open exercises destination validation. The suite verifies that
resolving an alias to an ejected volume leaves the volume detached. It also
checks the helper deadline and cleanup on real processes, compares name
presentation in Node and osascript, and reads a saved preference from a
later process.

Measured host behavior is documented where it affects the code. See
`src/runtime/shortcuts-input.js` for the Shortcuts envelope,
`src/runtime/bridge.js` for Objective-C out-parameters and NSError codes,
`src/runtime/preferences.js` for named domains, and
`src/runtime/supervise.js` for the process supervision choices.

- `--dialogs` shows the start, folder and link questions and the failure alert for one second using Standard Additions. An unanswered question must report the invalid-answer fault.
- `--terminal` checks the exact working directory of a real shell in each installed supported app. It uses a disposable directory with characters a shell could misread.
- `--shortcuts` drives both input routes through the installed harness shortcuts. It stages the production rendering with its preferences domain replaced and uses Accessibility to read and dismiss the multi-selection alert.

The interactive modes need a logged-in session. The harness prerequisites
are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Latest released verification

The published 2.0.2 asset records 49 native checks on macOS 15.8.2
(24H232), Apple Silicon, along with supervisor, presentation and preferences
results. [Native macOS report](https://github.com/resoltico/TermAtTarget/releases/download/v2.0.2/native-macos.json)

The release verification on macOS 27.2 (26B123), Apple Silicon, also
recorded the interactive flags passing with Terminal, Ghostty, iTerm2 and
kitty. The portable gate recorded 550 tests and 100% coverage and mutation.
Git history retains the detailed record for that release.

## Interactive acceptance

- Invoke the installed Quick Action from Finder and its assigned keyboard shortcut. Check each selection from the README input table against the shell's physical working directory.
- Check Return, Esc, Full Keyboard Access, VoiceOver, larger text, and light and dark appearance. Cancel each question in turn and confirm that the next run opens normally.
- Open Settings from a run with nothing selected. Check that each change saves immediately, Back leaves the current setting alone, and Done closes the list. Use a test preferences domain for unfamiliar saved values.

## Remaining evidence gaps

The artifact targets macOS 12.3. Release evidence covers macOS 15 and 27
on Apple Silicon. macOS 12.3 through 14 and Intel remain unverified.
Hosted automation exercises the harness routes, while direct Finder
triggers, settings lists and accessibility behavior require a person's
session. Terminal app profiles and startup commands can independently change
the directory. A rename or replacement between validation and the handoff
remains possible. The engine's emoji data affects what it displays as an
emoji sequence. Older engines can escape more characters. The full
Ideographic Variation Database is outside the bundled data.

## Rejected approaches

- A run lock would add shared state to independent invocations. The Shortcuts bridge cannot reliably disambiguate lock errors through errno.
- Capturing open's output with a pipe could delay the run after its deadline. The supervisor keeps its exit status and observes the task directly.
- Sending SIGKILL by PID risks signalling a reused process identifier. Retrying an unconfirmed handoff could open a second window.
- A second path check would still leave a race after that check. The terminal app receives a path.
- A result object could be handed back to Finder. The Shortcuts adapter returns an empty list.
- Editing settings into the script would invalidate its checksum and lose changes when replacing it. A named preferences domain survives replacement.
- A Settings button on the folder question would displace Cancel and disappear when a saved policy skipped the question. The start question provides a consistent route.
- A modifier-only settings shortcut is hard to find. An AppKit settings window was measured to block inside Shortcuts without appearing. Standard Additions supplies visible dialogs and lists.
- Supporting a terminal app by display name or bundle identifier alone cannot establish where its shell starts. Each listed app needs a native working-directory measurement.
