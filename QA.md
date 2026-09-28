# Quality gates

What is checked, how, and what the checks do and do not establish. Everything
in the portable gate runs with one command, which does not rebuild first:

```sh
npm ci --ignore-scripts
npm run quality
```

`quality` runs, in order: the source gate, ESLint, the unit and repository
tests under 100% coverage, the mutation campaign, and the check that the
committed artifact is what the source renders to. A stale or hand-edited
`dist/` fails here rather than being quietly rebuilt.

## Source gate

`npm run lint` runs `tools/lint.mjs`, which only sequences the families under
`tools/lint/`. Each family is unit-tested against fixtures, so it can be shown
to fail, and `tests/repo/gate.test.cjs` applies it to the real tree.

| Family | What it holds |
| --- | --- |
| `discovery.mjs` | Every JavaScript file is found by walking, not listed, so a new file cannot escape the gate. `.jxa` counts. |
| `source-rules.mjs` | Node parses each file; no literal control character, and nothing invisible or that moves text -- by Unicode property: separators, unusual whitespace, every default-ignorable code point -- which must be written as escapes; no trailing whitespace, CR or missing final newline; no file over 150 lines. |
| `boundary-rules.mjs` | `src/` uses no `eval`, `new Function`, dynamic import, `fetch`, `process` or `Buffer`, and calls nothing that writes to disk (mkdir, unlink, `writeToFile…`, `removeItemAt…`, `fileHandleForWriting` and the rest); `src/core/` names nothing native. |
| `source-rules.mjs` | Every absolute executable path under `src/` is in `src/runtime/executables.js` and nowhere else. |
| `language-target.mjs` | The rendered artifact parses as an ES2022 script, and uses no built-in newer than macOS 12.3. |
| `consistency.mjs` | Version, package name, Node pin, language year and repository URL agree in every file that states them, and the version has dated release notes. |
| `toolchain.mjs` | The `brew install` line is the same in `CONTRIBUTING.md` and both workflows, and installs actionlint. |
| `workflow-rules.mjs` | Every action is pinned to a full commit SHA; actionlint passes when installed. |
| `ignore-rules.mjs` | `.gitignore` covers what the toolchain writes, and never covers `dist/`. |
| `unicode-tables.mjs` | `src/core/unicode-tables.js` is exactly what the vendored Unicode data generates. |
| `document-rules.mjs`, `document-hygiene.mjs`, `document-references.mjs` | Each document has one title and no section repeated in place, holds no invisible or control character, and every backticked path in it exists. |

actionlint is optional so the gate stays runnable anywhere; the macOS jobs
install it, which is the one place it is guaranteed to run.

## Static analysis

ESLint runs `js.configs.all`, every core rule, with the exceptions listed and
justified in `tools/eslint/rules.mjs`. `src/` is parsed as ES2022 CommonJS
with the JXA globals; tools and tests as current Node. `no-bitwise` is off for
`src/runtime/` alone, where the C flags and Foundation option sets are bit
masks.

ES2022 is the syntax year, and it is stated twice -- in `package.json`'s
`runtimeLanguage`, which the artifact carries, and in `eslint.config.mjs` --
and the gate requires the two to agree. No ECMAScript year maps onto a Safari
release, so the parse is the coarse half. The fine half is a list of late
built-ins, each naming the first JavaScriptCore to have it, refused in the
rendered artifact. Regular-expression flags are not inspected.

## Coverage and mutation

The unit and repository tests run under Node's coverage at 100% of lines,
branches and functions, over `src/` and `tools/` both. The tests are split the
way the code is: `tests/unit/core/`, `tests/unit/runtime/`, `tests/unit/tools/`
take their world by parameter; `tests/repo/` inspects the real repository. Only
the first kind means anything under mutation, where the tree is deliberately
altered, so only `tests/unit/` runs in the campaign.

StrykerJS mutates `src/` with the tap runner and per-test coverage. The score
at the last run was 100: all 1,006 mutants were detected, and one did not
compile and is not counted. Twenty-three were detected by timing out; each
takes away what stops a loop -- the link budget, a walk's own step, a search's
bounds, or the supervisor's check of its clock -- so the loop never ends where
the tests expect it to. The build breaks below 98.

No survivor is accepted as equivalent and left. A survivor is either a
missing test or code that says something twice -- a `typeof` guard inside a
`try` that already catches, a `null` result nobody distinguishes from
`undefined` -- and the second kind is rewritten until the check carries
meaning.

## What a generated case covers

fast-check drives the properties in `tests/unit/core/*-properties.test.cjs`.

Paths are built from components with a known answer rather than generated
whole and checked against the rules the code applies. A component is any text
a filesystem name can hold, in every UTF-16 width; what POSIX forbids is mapped
away rather than filtered, so no drawn input is discarded. Names that already
look percent-encoded are drawn on purpose, since they are the only names that
decoding twice would change. The properties: a path comes back as built; its
file URL decodes exactly once to it, with or without `localhost`; a parent is
every component but the last; a displayed path reads back as itself; `.`,
`..`, an encoded separator, a remote host and a lone surrogate are each refused
wherever they appear.

Link resolution is checked on filesystems built with the answer in hand: a
chain of links up to the budget reaches its end, one more is refused, an alias
cycle of any length is refused as a cycle, `link/../x` follows the link before
the `..`, and a relative target is read from its own folder, two folders deep
so that reading it from the wrong one cannot look right.

Each generator was checked against a deliberately broken copy of the code it
tests, and had to fail it. Normal runs use fast-check's defaults: a fresh seed
and a hundred cases, reported with the seed and the shrunk counterexample on
failure. The mutation campaign fixes the seed and runs 25 cases
(`tests/unit/fast-check-mutation.cjs`), so every mutant meets the same inputs.
The properties also pass at 20,000 cases for each of three seeds.

## The artifact

`dist/Term-At-Target.jxa` is rendered by `tools/bundle.mjs`: each module in
`tools/module-order.mjs` becomes a scoped factory, the requires between them a
declared graph, and a small loader serves only what the graph declares. The
graph is checked before anything is written (`tools/module-graph.mjs`): a
require must be a literal string naming a listed local module or one of the
two embedded values, the core may reach neither the host nor the
configuration, and there are no cycles. The tree under `src/` and the manifest
must name the same modules.

Node resolves the same `#config` and `#metadata` specifiers through
`package.json` `"imports"`, so the modules load in a test exactly as written,
and `tests/repo/layout.test.cjs` requires the two derivations to agree. The
rendered artifact is loaded in a bare `vm` context in `tests/unit/tools/`,
where it must declare `run` and make the source's decisions with nothing from
Node or macOS in reach.

`npm run check-dist` compares the committed artifact and `dist/SHA256SUMS`
with a fresh render. The release workflow runs it before rebuilding, then
requires the rebuild to leave `dist/` unchanged.

## What Shortcuts hands the script

Run JavaScript for Mac Automation does not pass its input as `run`'s first
argument. It passes both of its own arguments inside it:

```
run([[item, ...], { source, "temporary items path", ignoresInput }], {})
```

Measured on macOS 27 for a file, a folder, a Finder alias, two files and an
empty selection, through Get Selected Files in Finder and through the
shortcut's own input: the same shape every time, each item a JXA Path, an
alias arriving as its own path, `source` a string and `ignoresInput` a
boolean. `src/core/invocation.js` unwraps exactly that shape, so the one-item
rule is applied to what was selected. A list nested in a list is never a
selection osascript passes, so one that is not exactly this envelope is
refused by name ("a form this version does not recognise") rather than read
some other way. Read as the selection itself, one file was two items, and
every run was refused as a multiple selection -- which no test outside
Shortcuts could see, because each was handed a shape somebody assumed.

## The Objective-C bridge

Four facts about the bridge were measured on macOS and shape the runtime:

- **An out-parameter is made with `$()`, not `Ref()`.** Reading an NSError
  back out of a `Ref()` after a failing Foundation call crashes osascript with
  SIGSEGV, five runs in five, in a thirty-line reproduction with no bundler
  involved. An unrelated Objective-C call in between hides it. With `$()` the
  same calls are stable and the error describes itself. The host's
  out-parameter maker is tested to be `$()`, and the native harness uses it
  too.
- **errno cannot be read inside Shortcuts.** There the script runs in
  ShortcutsMacHelper, where the bridge overwrites errno between a C call and
  the read: a mkdir that failed on an existing directory read 22 rather than
  17, and one that succeeded read 22 as well. osascript preserves it, so a
  test there proves nothing about it. Nothing in the action reads errno; each
  failure is explained by Foundation, whose NSError arrives intact, or by the
  call's own result.
- **An NSError's code arrives as text.** Through `$()` the code reads as
  `"260"`, not 260, and is converted before it is kept. Each native failure
  names its operation, the path, macOS's own description, and the domain and
  code -- `Cannot inspect "/x": … (NSCocoaErrorDomain 260)` -- and carries
  them on the error as well.
- **Variadic C functions lose their trailing arguments.** A mode passed to
  `open()` does not arrive (a created file lands at mode 000), so nothing that
  needs one -- `fcntl()` to make a pipe non-blocking among them -- can be used.
  The action makes no C calls at all.

## The launch

`/usr/bin/open -b com.apple.Terminal <directory>`: Terminal by bundle
identifier, the directory as one argument. `src/runtime/supervise.js` runs it
and reads nothing from it -- stdin, stdout and stderr are the null device --
so no pipe can hold a run: not a helper blocked writing to one, and not a
descendant keeping one open after the helper exits (measured: 25 s past a
10 s deadline while stderr was a pipe). JXA cannot read a pipe without that
risk, since making it non-blocking needs the variadic `fcntl()`. What is kept
is open's exit status, and a failure says to check that Terminal opens on its
own.

The deadline is 10 seconds of elapsed time on the Mac's uptime clock, which
no wall-clock change moves. It is fixed before launch and re-read after every
sleep of at most 50 ms, so a sleep that overshoots ends the wait at the next
check instead of adding to it. It bounds waiting for open -- not a launch call
the system stalls inside, and not time the Mac is asleep.

Once open has been launched, the request may already have reached Terminal,
so nothing that happens afterwards escapes as a plain failure. If open
outlives the deadline, or watching it fails -- the clock, the running check,
the sleep, reading its status -- it is abandoned: told to stop with SIGTERM
through the task object, watched for a second, and reported. The run says the
window may still appear and that nothing was retried, says why it stopped
watching, and names open's process if it could not be seen to stop. A step
that fails while stopping it is reported after that, never instead of it.

It is never signalled by pid. NSTask reaps its child as soon as it exits, so
a pid read a moment ago may already name another process; the only signal
sent is through the task object. A helper that ignored SIGTERM would be left
running and named, rather than risk killing something else. open does not
ignore it. The longest a run waits on open is 11 seconds.

## The questions

A question is a Standard Additions dialog with three buttons: Cancel, the
alternative, and the usual answer as the default, on the right, so Return
takes it and Esc cancels. The question is its first line, and each path
appears once, as the item's name and the folder it is in. An answer must be
one of the buttons offered; anything else, including a dialog that timed out,
is refused. Cancel is thrown by Standard Additions with errorNumber -128 and
passes through as a cancellation.

Names are shown by `src/core/present.js`. An ordinary name is shown as it
is. A name holding anything invisible or that moves text -- a control, a line
or paragraph separator, whitespace other than a plain space, or any
default-ignorable code point (a soft hyphen, a grapheme joiner, a zero-width
or direction mark, a filler, a tag or selector) -- is shown quoted, with each
such character written as `\u{XXXX}` and `"` and `\` escaped; so is a name
with a space at either end of a component or a leading `"`.

Some of those characters are how visible text is written, and are kept -- by
published standards only, decided in `src/core/writing.js`:

- **Emoji:** the engine's own set of recommended emoji (`\p{RGI_Emoji}`, the
  `v` flag). It knows a joined emoji from two emoji with a joiner between
  them, and a real flag's tags from any others. It is built from a string
  inside try/catch, so an engine without the `v` flag still loads the
  artifact and simply keeps no emoji exception.
- **Variation selectors:** a base and selector listed in Unicode's emoji
  variation sequences or standardized variants -- a digit with its emoji
  selector, a math symbol's variant -- or an ideographic variation selector
  after a Han ideograph.
- **Joiners:** RFC 5892 Appendix A, as IDNA uses it: a joiner or non-joiner
  directly after a virama, or a non-joiner between a letter that joins to the
  left and one that joins to the right, with only transparent characters (a
  vowel mark, say) between. A Devanagari conjunct and an everyday Persian word
  read as written; a joiner between Latin letters, or after an Arabic letter
  that does not join onward, is shown.

The Unicode facts come from Unicode 17.0.0's own files, vendored unmodified in
`tools/unicode/data/` with the Unicode License. `tools/unicode/generate.mjs`
derives `src/core/unicode-tables.js` from them -- joining types, viramas,
defined variation sequences, encoded as ranges -- with the Unicode notice in
its header, so the notice travels with the artifact. The gate regenerates and
compares it on every run, and a test checks each decoded table against its
source file at every code point. Generated data is not mutated.

Properties check the presentation at every run, and at 20,000 cases for each
of three seeds: nothing that only hides or moves text is shown unescaped, a
name is shown plainly only when it holds nothing to show, no two different
names are shown as the same text, and recommended emoji among ordinary words
stay as they are. Each property fails against a copy of the rule with its
part removed. What is shown is never read back as a path. Error messages keep
the exact JSON spelling, since they are read when something is wrong.

What this promises is readable presentation with every character outside a
published sequence shown -- not that different names look different in every
font. Characters that merely look alike are a different matter; the path
itself is what is opened.

## What a run does, and does not, share

Nothing. The action writes nothing to disk -- no lock, preference or temporary
file, and the source gate holds it to that -- so two runs cannot block,
corrupt or be blocked by each other; two at once make two requests. A folder
question left open does not stop another run from opening.

## macOS integration gate

`npm run test:integration:macos` checks the committed artifact against the
source, compiles it with osacompile, and appends a test body in place of its
entry point. On a machine that is not a Mac it exits 2 and says it did not
run; it never reports a skip as a pass.

Against disposable fixtures -- real Finder aliases written as bookmark files,
relative, broken and cyclic symbolic links, a package, a folder that cannot
be entered, and a folder named with a quote, a newline, `$`, a backtick, `;`,
`&` and an emoji -- it runs the real adapters for 41 checks: classification of
each kind; the package question, and its answer when macOS cannot give one;
alias resolution, and a broken target reported as that; Path, NSString,
NSURL, file-reference URL and Shortcuts-envelope input; a URL for a link to a
folder, trailing slash and all; a file-reference URL written as text; each
policy's destination, including the root
opening without a question; component-ordered traversal; a missing item
reported with its NSError domain and code; and the refusals -- two items, a
file named with a trailing slash, a slashed link that leads to a file or to a
Finder alias, a cycle, a folder that cannot be entered.
Each refusal must carry its own message; a failure of any other kind does not
pass for it.

It makes a disk image, puts a folder on it, writes an alias to that folder,
and ejects the image. Resolving the alias must fail, and the image must not be
attached again afterwards: no volume is mounted, and nothing is asked.

It runs the supervisor against real processes: one that succeeds and one
that exits 3, both reported at once with their status; one that exits while a
child it started keeps writing to its stderr, which must also finish at once;
one that never ends, which must be stopped at the deadline; one that ignores
SIGTERM, which must be reported, after the grace second, as not stopped and
with its pid (the suite then ends it); and one that cannot start.

It presents 29 names -- joined and merely adjacent emoji, flags, invalid
tags, keycaps and bare digit selectors, Devanagari and Persian joiners, soft
hyphens, direction marks, undefined variation selectors -- in osascript's
engine and in Node's, and requires the two to agree, since the rule relies on
each engine's own Unicode properties and emoji set.

With `--dialogs` it shows both questions with the real Standard Additions,
passing exactly the options the artifact passes plus a one-second limit.
Timing out is not one of the offered buttons, so the artifact must refuse the
answer, which shows the options were accepted as given.

With `--shortcuts` it runs the artifact through Shortcuts itself, by both
routes a Quick Action can take: Get Selected Files in Finder feeding the
action, and the shortcut's own input. For each, a file, a folder and a Finder
alias open where they should, checked in the shell Terminal starts, and two
files are refused as two. The two harness shortcuts are imported once
(`node tests/integration/shortcuts/build.mjs` builds and signs them); each
runs whatever artifact the suite last staged, so every later build is tested
through Shortcuts without pasting anything. The configuration is fixed at
INSIDE and TARGET so no question waits on a person.

With `--terminal` it also opens a real Terminal window at a folder named
`` cwd ' $HOME `x`; & 😀 ``, finds the shell that starts there by asking the
kernel for its working directory (`lsof`, whose `\xNN` escapes are decoded
first), requires the match to be exact, and closes the window by ending that
shell.

## What has been measured on this Mac

On 2026-09-28, macOS 27.0 (26A428) on Apple Silicon, Node 26.8.1:

- `npm run quality` passed: 462 tests, 100% coverage, mutation score 100,
  and the committed artifact matching the source.
- `node tests/integration/macos.mjs --dialogs --terminal --shortcuts` passed: all 41
  native checks, the ejected-image alias, the supervisor against real
  processes (an endless helper stopped at 10.1 s, one ignoring SIGTERM
  reported with its pid at 11.0 s), names presented identically by both
  engines, both questions shown by Standard
  Additions, Terminal's shell at the hostile folder exactly, and both
  Shortcuts routes.

- On 2026-09-28, GitHub's `macos-15` runner (macOS 15.7.9, Apple Silicon)
  passed the gate and the native suite -- all 41 checks, the supervisor (an
  endless helper stopped at 10.2 s), and the 29 names presented identically
  by that engine and Node's -- in the Quality workflow and again in the
  Release workflow for v1.0.0, which attested every asset and verified each
  attestation before publishing.

## Interactive acceptance

The native suite runs the artifact's adapters and the harness shortcuts, not
a person's clicks. What only a person at a Mac can check, with the action
installed as `INSTALL.txt` describes:

- **The Quick Action itself.** Invoked from Finder's Quick Actions menu or a
  keyboard shortcut rather than the command line, the selection should
  arrive the same way; that trigger has not been exercised by anything but a
  person.
- **The questions.** Each row of the table in `README.md` with ASK
  configured, the selected item's folder and its target's folder kept apart
  so a wrong choice is obvious, checked in the shell that opens (`pwd -P`
  against the physical target where a link is involved). Whether each
  question reads clearly.
- **Keyboard and accessibility.** Return takes the default and Esc cancels;
  with Full Keyboard Access, Tab reaches every button; VoiceOver reads the
  question and each button; the dialog reads well in light and dark
  appearance and with larger text.
- **Cancellation.** Cancel each question in turn; nothing opens, and the next
  run works.

## What has not been established

- **macOS 12.3 to 14, and Intel Macs.** 12.3 is the floor the language target
  holds the artifact to; macOS 15 (on CI) and 27 have run it, nothing between
  or older. On macOS 27 osascript ships for Apple Silicon only, so the Intel
  code path cannot run here at all.
- **The interactive checks above.** None has been recorded.
- **Older engines.** The emoji exception is the engine's own recommended
  set, which is its macOS's. An older macOS knows fewer emoji, and one without
  the `v` flag (before macOS 14) knows none, so more is shown escaped -- the
  safe direction, measured nowhere older than macOS 27.
- **Ideographic variation selectors.** After a Han ideograph one is kept
  without checking the IVD registry, which is too large to embed in a script
  that is pasted; an unregistered one there is not shown.
- **Terminal's own settings.** A profile's startup command can change the
  directory after the shell starts; the suite's check is of the shell, before
  anything a profile does.
- **Atomicity.** The destination is validated and then handed to Terminal by
  path; a folder renamed or replaced in between is not detected.

## What was rejected, and why

- **A run lock.** Nothing is shared between runs that needs protecting, and
  that is reason enough. It would also be hard to do well here: inside
  Shortcuts, errno is not readable through this bridge, so a lock built on
  flock could not tell "held by another run" from "locking failed"; and the
  variadic `open()` cannot pass a mode, so a lock file would need a second
  call to become usable -- a window in which an interrupted run leaves a file
  that refuses every later run. The cost of having none is a second window on
  an accidental double trigger.
- **Reading open's diagnostic.** It is one line, and it would need a pipe; a
  pipe can hold the run past its deadline, and JXA cannot make one
  non-blocking. The exit status is kept instead.
- **A result object for later actions.** Nothing consumes one: the action ends
  the shortcut, and a Quick Action's output can be handed back to Finder. It
  returns `[]` on success and on cancel.
- **Binding the validated folder to the handoff.** Validation already runs
  immediately before open; a second identity check would leave the same gap
  after it, since Terminal is handed a path.
- **Killing a helper by pid.** NSTask signals its task object only with
  SIGTERM; SIGKILL would need `kill()` with a pid, and NSTask reaps its child
  as soon as it exits, so the pid could name another process by the time the
  signal is sent. A helper that ignores SIGTERM is reported, with its pid.
- **Retrying a request that timed out.** It may already have reached
  Terminal; a retry could open two windows.
