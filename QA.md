# Quality gates

Use the [contributor setup](CONTRIBUTING.md#build-from-a-checkout), then run
`npm run quality` for the portable checks.

## Portable gate

| Check | Property | Rejecting case |
| --- | --- | --- |
| Source discovery and syntax | The gate finds JavaScript under the source, test and tool trees and parses it with Node, including JXA. | A new JXA file has a syntax error. |
| Source text | Literal controls and invisible characters use escapes. Files have a final newline and carry no trailing whitespace or CR characters. | A literal bidi override appears in a string, or a file ends without a newline. |
| Runtime boundary | The core runs without JXA globals. The lint checks direct preference access and known filesystem-writing names. | A core module reads `ObjC`, or a runtime module calls a Foundation file-writing method. |
| Executables | The published external executable surface comes from `src/runtime/executables.js`. | A second module names an absolute executable path. |
| Module graph and bundle | Production reaches every source module via literal local requires. The graph is acyclic and the core imports no runtime adapter. | A core import points at a runtime file, or a source module is absent from the bundle. |
| Language target | The artifact parses as ES2022 and the built-in checks target macOS 12.3. | Shipped code calls `Array.prototype.toSorted`. |
| Settings documentation | README and INSTALL.txt use the core catalog's setting and value labels. | A README settings row omits one of its values. |
| Repository consistency | Version, package name, Node and npm pins, language year and repository URL agree where declared. Release notes have a real date. | The Node pin and minimum disagree, or a release date is February 30. |
| Workflow tooling and actions | Linux portable jobs use a checksum-pinned actionlint. Actions are pinned to full SHAs. | The actionlint download has the wrong digest, or an action uses a version tag. |
| Release separation | Portable success, native evidence and a read-only Ubuntu rebuild are prerequisites for publication. Both the JXA and manifest must match. The publishing job installs no dependencies. | Native evidence is absent, has a different SHA or digest, or reports a cancelled run. |
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
presentation in Node and osascript against an expected-output corpus, and
reads saved preferences from later processes. The report records the source revision, working tree cleanliness,
artifact digest, OS build, architecture, exercised scope and result. The hosted
jobs accept a passed headless report on macOS 15 ARM64, checked against the
artifact and exact clean source commit. Qualification checks compilation,
the ejected alias volume, every unique case ID in the headless fixture
inventory, and the complete presentation corpus. It also checks the
supervisor results and separate-process preferences, including overlapping
writers that both read the initial record before saving distinct keys. A
queued or cancelled job produces no qualifying report.

Measured host behavior is documented where it affects the code. See
`src/runtime/shortcuts-input.js` for the Shortcuts envelope,
`src/runtime/bridge.js` for Objective-C out-parameters and NSError codes,
`src/runtime/preferences.js` for named domains, and
`src/runtime/supervise.js` for the process supervision choices.

### Interactive modes

Run interactive modes in a logged-in macOS session. Pass the flags after
`npm run test:integration:macos --`.

- `--dialogs` shows the start, folder and link questions and the failure alert
  using Standard Additions. The probe expects an invalid-answer fault when a
  question times out.
- `--terminal` opens each installed supported app, checks the exact working
  directory of a real shell and closes the test window. A separate Terminal
  check passes a path with a literal percent sequence and checks the kernel
  working directory after symlink traversal.
- `--shortcuts` tests both input routes through installed QA shortcuts. It
  stages the script with a unique preferences domain and checks invocation
  evidence. The Accessibility watcher matches a request-specific title and the
  refusal text before dismissing the alert, and stops if its child fails.

For `--shortcuts`, run `node tests/integration/shortcuts/build.mjs`, open
the two files it prints, and add **Term At Target QA (Selection)** and
**Term At Target QA (Input)**. Give the app running the suite Accessibility
access. The harness uses a dedicated staging directory and a new preferences
domain for each run. If the controller is interrupted or a loader result
cannot be verified, the staging lease stays in place. Confirm the QA
invocations have ended in Shortcuts, or restart the Mac, before removing the
QA staging directory named in the diagnostic.

## Interactive acceptance

- Invoke the installed Quick Action from Finder and its assigned keyboard shortcut. Check each selection from the [README input table](README.md#what-opens-where) against the shell's physical working directory.
- Check Return, Esc, Full Keyboard Access, VoiceOver, larger text, and light and dark appearance. Check the reading order and spoken name of a folder with both right-to-left text and ASCII digits. Cancel each question and confirm that the next run opens normally.
- Open Settings from a run with nothing selected. Check that each change saves immediately, Back leaves the current setting alone, and Done closes the list. Use a test preferences domain for unfamiliar saved values.

## Verification limits

The script targets macOS 12.3. Hosted headless checks run on macOS 15 ARM64.
The release report identifies the measured OS build and exercised scope.
Native compatibility at the 12.3 floor remains unmeasured. Qualifying it requires
a Mac or VM on that version and the finished JXA artifact from a newer build
host. [The pinned Node binary](https://github.com/nodejs/node/blob/v26.13.1/BUILDING.md#platform-list)
requires macOS 13.5. On the older host, verify the artifact digest, compile
it with osacompile, and exercise the Finder Quick Action, settings, aliases,
and real shell working directories. Record the OS build, architecture,
artifact digest and exercised scope with the report.
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
