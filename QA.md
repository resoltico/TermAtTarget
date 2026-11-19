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

- `--dialogs` shows the start, folder and link questions and the failure alert for one second using Standard Additions. The check expects the invalid-answer fault after a question times out.
- `--terminal` checks the exact working directory of a real shell in each installed supported app. It uses a disposable directory with characters a shell could misread.
- `--shortcuts` drives both input routes through the installed harness shortcuts. It stages the production rendering with its preferences domain replaced and uses Accessibility to read and dismiss the multi-selection alert.

The interactive modes need a logged-in session. The harness prerequisites
are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Interactive acceptance

- Invoke the installed Quick Action from Finder and its assigned keyboard shortcut. Check each selection from the [README input table](README.md#what-opens-where) against the shell's physical working directory.
- Check Return, Esc, Full Keyboard Access, VoiceOver, larger text, and light and dark appearance. Cancel each question in turn and confirm that the next run opens normally.
- Open Settings from a run with nothing selected. Check that each change saves immediately, Back leaves the current setting alone, and Done closes the list. Use a test preferences domain for unfamiliar saved values.

## Verification limits

The script targets macOS 12.3. The workflow declares its hosted macOS runner,
and release assets include the native evidence for that build. Use the native
suite on the macOS build and hardware you need to verify.
[Quality workflow](.github/workflows/quality.yml) · [Release assets](https://github.com/resoltico/TermAtTarget/releases/latest)

Hosted automation checks the action through JXA. The Finder harness and
dialog, terminal and Accessibility modes require an interactive macOS session.
The acceptance steps above cover the installed Quick Action, settings and
accessibility behaviour that a hosted run leaves open. Terminal app profiles
and startup commands can independently change the directory. Older JavaScript
engines can escape more characters because their emoji data differs. The full
Ideographic Variation Database is outside the bundled data.

[Security and data boundaries](SECURITY.md) explains the time between
filesystem validation and application handoff.
