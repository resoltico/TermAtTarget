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
| `boundary-rules.mjs` | `src/` uses no `eval`, `new Function`, dynamic import, `fetch`, `process` or `Buffer`, calls nothing that writes a file (mkdir, unlink, `writeToFile…`, `removeItemAt…`, `fileHandleForWriting` and the rest), and names NSUserDefaults only in `src/runtime/preferences.js`; `src/core/` names nothing native. |
| `source-rules.mjs` | Every absolute executable path under `src/` is in `src/runtime/executables.js` and nowhere else. |
| `language-target.mjs` | The rendered artifact parses as an ES2022 script, and uses no built-in newer than macOS 12.3. |
| `consistency.mjs` | Version, package name, Node pin, language year and repository URL agree in every file that states them, and the version has dated release notes. |
| `toolchain.mjs` | The `brew install` line is the same in `CONTRIBUTING.md` and both workflows, and installs actionlint. |
| `workflow-rules.mjs` | Every action is pinned to a full commit SHA; actionlint passes when installed. |
| `ignore-rules.mjs` | `.gitignore` covers what the toolchain writes, and never covers `dist/`. |
| `unicode-tables.mjs` | `src/core/unicode-tables.js` is exactly what the vendored Unicode data generates. |
| `document-rules.mjs`, `document-hygiene.mjs`, `document-references.mjs` | Each document has one title and no section repeated in place, holds no invisible or control character, and every backticked path in it exists -- except in `AGENTS.md`, a baseline shared across repositories whose backticked names are naming examples. |

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
at the last run was 100: all 1,321 mutants were detected, and two did not
compile and are not counted. Twenty-three were detected by timing out; each
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
require must be a literal string naming a listed local module, the core may
not reach the host, and there are no cycles. The tree under `src/` and the
manifest must name the same modules. Nothing is embedded beyond the modules:
the artifact carries no settings, so every installed copy is the released file
byte for byte, and its checksum and attestation verify on the copy a person
pasted.

The rendered artifact is loaded in a bare `vm` context in `tests/unit/tools/`,
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

What Shortcuts puts in that list is not always what was selected. Measured on
macOS 27, by both routes: a Finder alias arrives as the alias; a symbolic
link to a folder arrives as the folder it leads to; a broken symbolic link,
or one in a cycle, arrives as nothing -- an empty list -- so the run asks what
a run given nothing asks. The action cannot recover a link Shortcuts has
already resolved, so the link question and the alias setting are worded for
Finder aliases. The symbolic-link rules still apply wherever links appear
inside a path, and to a link that reaches the action some other way.

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

`/usr/bin/open -b <bundle identifier> <directory>`: the terminal app chosen in
the settings, by the identifier `src/runtime/executables.js` gives it
(`com.apple.Terminal`, `com.mitchellh.ghostty`, `com.googlecode.iterm2`,
`net.kovidgoyal.kitty`), and the directory as one argument. Measured on macOS
27: the shell each starts is at a folder named with a quote, `$HOME`, a
backtick, `;`, `&` and an emoji exactly -- except kitty, which expands
environment variables in the folder it is given, by open or by its own
`--directory`: a folder named `dollar $HOME` opened in the home folder, while
`$(...)`, backticks and `~` stayed literal. kitty is marked `readsVariables` in
`src/core/vocabulary.js`, and the core refuses to hand it a folder whose path
contains `$`, after the folder is checked and before anything is launched;
with that one character left out, kitty's shell is at the hostile folder
exactly.
Before anything is asked, the run checks with Launch Services
(`NSWorkspace` `URLForApplicationWithBundleIdentifier`) that the app is
installed, which answers the same wherever the app is and whether it came from
its vendor or a Homebrew cask; the same lookup answers inside Shortcuts. `src/runtime/supervise.js` runs it
and reads nothing from it -- stdin, stdout and stderr are the null device --
so no pipe can hold a run: not a helper blocked writing to one, and not a
descendant keeping one open after the helper exits (measured: 25 s past a
10 s deadline while stderr was a pipe). JXA cannot read a pipe without that
risk, since making it non-blocking needs the variadic `fcntl()`. What is kept
is open's exit status, and a failure says to check that the app opens on its
own.

The deadline is 10 seconds of elapsed time on the Mac's uptime clock, which
no wall-clock change moves. It is fixed before launch and re-read after every
sleep of at most 50 ms, so a sleep that overshoots ends the wait at the next
check instead of adding to it. It bounds waiting for open -- not a launch call
the system stalls inside, and not time the Mac is asleep.

Once open has been launched, the request may already have reached the app,
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

A question is a Standard Additions dialog with three buttons -- as many as
Standard Additions allows: Cancel, the alternative, and the usual answer as the
default, on the right, so Return takes it and Esc cancels. The question is its
first line, names the terminal app chosen, and shows each path once, as the
item's name and the folder it is in. An answer must be one of the buttons
offered; anything else, including a dialog that timed out, is refused. Cancel
is thrown by Standard Additions with errorNumber -128, which
`src/runtime/standard-additions.js` turns into the core's own cancellation, so
the core knows nothing of Standard Additions' numbers.

Inside the person's home folder (`NSHomeDirectory`, which inside Shortcuts
measured the person's own), a folder is shown from `~`: shorter, and never the
same text as another folder, since every other path shown begins with `/` or
a quote. A home at the root is not used. Error messages keep the full path.

A run given nothing asks first: Cancel, Settings…, or Choose Folder… as the
default. If a saved setting is not recognised, or the chosen terminal app is
not installed, it says that instead and offers only Cancel and Settings…, so
nobody is invited to choose a folder that could not be opened; the core
refuses Choose Folder… as an answer then. The settings are Standard Additions lists: every setting with what it
is set to (a saved value that is not recognised shown as that, and a terminal
app that is not installed marked "(not installed)"), and for the one picked, its values with the current one selected; back in the first list,
the setting picked last is selected again. Done and Back leave a list
without an answer; a list answer must be exactly one item offered. Only an
installed terminal app is offered, and the core checks every answer against
what was offered before saving it.

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

## A failed run

A run that is refused or fails is told in Term At Target's own Standard
Additions alert, with OK its only button, and then ends without an error:
through `shortcuts run`, a thrown error read "Error: Error: Error: …", one
prefix for each layer it passed through. A failure a person can put right is
a refusal with its own heading -- "Select one item at a time", "The folder
setting isn't recognised", "Ghostty isn't installed", "kitty can't open this
folder", "The alias's original can't be found" -- and says what would work:
Open Where It Is for a broken alias, Open in Parent when only the folder's own
name holds kitty's "$", and opening a just-installed app once; anything else is headed "Term At Target couldn't finish", which stays
true even when a request may yet reach the terminal app. The core still
throws; only `src/runtime/entry.js` turns the failure into the alert, and if
the alert cannot be shown, the failure is thrown as itself for Shortcuts to
show. Cancelling is not a failure and shows nothing.

## The saved settings

The settings are saved in the macOS preferences domain
`com.resoltico.TermAtTarget`, a key per setting, each value the setting's own
text. Measured on macOS 27 with a probe run through Shortcuts: the script runs
there as `com.apple.WorkflowKit.MacHelper`, not sandboxed, and a value it saves
to a named domain lands in `~/Library/Preferences`, where `defaults` and
osascript read the same value back. The native suite saves one in an osascript
process and reads it back in a later one and with `defaults`.

Only the domain's own dictionary is read (`persistentDomainForName`). A named
`NSUserDefaults` also falls back to the host app's domain and the global one,
and `terminal`, `folder` and `link` are names anything may use: measured
through Shortcuts, a `link` written only to the global domain skipped the link
question. The native suite plants a `terminal` in osascript's own domain and
requires it unread.

A value is read as found -- null where nothing is saved -- and the core decides
whether it is one of the setting's. Anything else, a number written with
`defaults -int` included, stops the run with the setting, the value -- text
quoted, numbers and lists as written, a date as a date, and data as "a value
that is not text" -- and how to change it, and is shown as not recognised in the settings list. A run given
nothing can still reach the settings, which is how such a value is replaced.

## What a run does, and does not, share

Only the settings, read once at the start of a run. The action writes no file
-- no lock, cache or temporary file -- and NSUserDefaults is allowed only in
`src/runtime/preferences.js`; the source gate holds it to both. Two runs cannot
block, corrupt or be blocked by each other; two at once make two requests. A
question left open does not stop another run from opening, and a setting
changed meanwhile applies to the next run.

## macOS integration gate

`npm run test:integration:macos` checks the committed artifact against the
source, compiles it with osacompile, and appends a test body in place of its
entry point. On a machine that is not a Mac it exits 2 and says it did not
run; it never reports a skip as a pass.

Against disposable fixtures -- real Finder aliases written as bookmark files,
relative, broken and cyclic symbolic links, a package, a folder that cannot
be entered, and a folder named with a quote, a newline, `$`, a backtick, `;`,
`&` and an emoji -- it runs the real adapters for 49 checks: classification of
each kind; the package question, and its answer when macOS cannot give one;
alias resolution, and a broken target reported as that; Path, NSString,
NSURL, file-reference URL and Shortcuts-envelope input; a URL for a link to a
folder, trailing slash and all; a file-reference URL written as text; each
policy's destination, including the root
opening without a question; component-ordered traversal; a missing item
reported with its NSError domain and code; and the refusals -- two items, a
file named with a trailing slash, a slashed link that leads to a file or to a
Finder alias, a cycle, a folder that cannot be entered, and a saved setting
that is not recognised.
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

It saves settings in a preferences domain of its own,
`com.resoltico.TermAtTarget.native-test`, removed before and after: one value
the way the action does and one number the way `defaults -int` would, read back
in the same process, in a later one, and by `defaults`. A person's own settings
are never read or written by the suite.

With `--dialogs` it shows the three questions -- the first one a run given
nothing asks, the folder question and the link question -- and the failure
alert with the real Standard Additions, passing exactly the options the
artifact passes plus a one-second limit. Timing out is not one of the offered
buttons, so the artifact must refuse a question's answer, which shows the
options were accepted as given; the alert asks nothing, so it must simply be
shown and dismissed. The
settings lists have no time limit to give, so they are not shown by the suite.

With `--shortcuts` it runs the artifact through Shortcuts itself, by both
routes a Quick Action can take: Get Selected Files in Finder feeding the
action, and the shortcut's own input. For each, a file, a folder and a Finder
alias open where they should, checked in the shell Terminal starts, and two
files are refused as two: the refusal's alert is read and OK pressed through
the Accessibility API, as a person would, which needs the app running the
suite allowed under Privacy & Security > Accessibility. The two harness shortcuts are imported once
(`node tests/integration/shortcuts/build.mjs` builds and signs them); each
runs whatever artifact the suite last staged, so every later build is tested
through Shortcuts without pasting anything. The staged copy saves its
settings in `com.resoltico.TermAtTarget.harness` instead of the action's
domain, set to open folders inside and follow links so no question waits on a
person, and removed when the routes have run.

With `--terminal` it also opens a real window in each supported terminal app
that is installed -- Terminal always -- at a folder named
`` cwd ' $HOME `x`; & 😀 ``, finds the shell that starts there by asking the
kernel for its working directory (`lsof`, whose `\xNN` escapes are decoded
first), requires the match to be exact, and closes the window by ending that
shell five seconds later -- iTerm2 warns about its profile when a shell ends
at once, and the warning blocks quitting it. An app the check started is quit
again; one already running is left as it was.

## What has been measured on this Mac

For 2.0.0, on 2026-10-30, macOS 27.0.1 (26A434), Apple Silicon, Node 26.13.0,
Ghostty 1.4.0, iTerm2 3.7.6, kitty 0.49.2, the artifact whose SHA-256 begins
`944c51c2`:

- `npm run quality` passed: 536 tests, 100% coverage, mutation score 100
  (1,321 mutants), and the committed artifact matching the source.
- `node tests/integration/macos.mjs --dialogs --terminal --shortcuts` passed:
  all 49 native checks, the supervisor and presentation checks, the saved
  settings across processes, all three questions and the failure alert, the
  shells of Terminal, Ghostty, iTerm2 and kitty at the hostile folder exactly,
  and both Shortcuts input routes with the settings read from the harness's
  domain and two files refused in the alert headed "Select one item at a
  time".
- A field test outside the repository drove the built artifact through the
  harness shortcut in 51 scenarios (every input kind, hostile names, every
  cancel point, every kind of unrecognised saved value, a key planted in the
  global preferences domain, kitty's "$" rule, and each of Ghostty, iTerm2
  and kitty removed with `--zap` and reinstalled with Homebrew); after the
  fixes it found, all pass. A freshly installed app's first launch waits
  behind macOS's "downloaded from the Internet" prompt, and opens the folder
  1--2 s after it is answered.
- Through the harness shortcut, on screen: a folder inside the home folder was
  asked about as "In: ~", the link values read "Follow the alias or link" (now
  "Follow the alias"), and
  Back from them returned to the settings list with the link setting still
  selected.
- Through Shortcuts, a probe saved a value to a named preferences domain, which
  landed in `~/Library/Preferences`; the same probe found Ghostty installed by
  its bundle identifier.
- Ghostty, opened at a folder when not running, had its shell there 1.6 s
  later; while running with one window, a second request opened a tab in it.
- iTerm2 3.7.6, installed by its Homebrew cask, did the same: its shell was at
  the hostile folder 4.7 s after a cold start, and a second request opened a
  tab. When a shell ends, iTerm2 keeps its window by its own preference.
- The settings, through the harness shortcut run by Shortcuts with nothing
  selected, each step pressed and read back through the Accessibility API
  (System Events): the first question offered Cancel, Settings… and Choose
  Folder…; the settings list showed every setting, the first selected;
  changing "When a folder is selected" to Open in parent and the terminal app
  to Ghostty saved each at once, and the list showed both; Back from the link
  values left the link setting unsaved; Done ended the run quietly. With
  `folder` written by hand as `LEVEL`, a run on a folder was refused naming the
  setting, and the settings list showed "not recognised (LEVEL)" with no value
  preselected and replaced it. With Ghostty chosen, the first question and the
  folder question named Ghostty, and Open Inside started Ghostty -- not running
  before -- with its shell in the folder.

For 1.0.1, on 2026-10-06, macOS 27.0 (26A428), Apple Silicon, Node 26.8.1:

- `npm run quality` passed: 465 tests, 100% coverage, mutation score 100,
  and the committed artifact matching the source.
- `node tests/integration/macos.mjs --dialogs --terminal --shortcuts` passed:
  all 48 native checks, the supervisor and presentation checks, both dialogs,
  Terminal's exact working directory, and both Shortcuts input routes.
- A file-reference URL with an encoded slash opened a different filename
  under 1.0.0; the same native reproduction under 1.0.1 refused it without
  a launch request. The Terminal check's decoder was also verified against
  both literal emoji and escaped UTF-8 from `lsof`.


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
- **The questions.** Each row of the table in `README.md` with every choice
  set to Ask each time, the selected item's folder and its target's folder kept apart
  so a wrong choice is obvious, checked in the shell that opens (`pwd -P`
  against the physical target where a link is involved). Whether each
  question reads clearly.
- **Keyboard and accessibility.** Return takes the default and Esc cancels;
  with Full Keyboard Access, Tab reaches every button; VoiceOver reads the
  question and each button; the dialog reads well in light and dark
  appearance and with larger text.
- **Cancellation.** Cancel each question in turn; nothing opens, and the next
  run works.
- **The settings.** Run with nothing selected, choose Settings…, change each
  setting and pick Done; the next run follows them, and
  `defaults read com.resoltico.TermAtTarget` shows them. Back leaves a value
  unchanged. With Ghostty chosen, a run opens Ghostty, and each question names
  it. Write a value by hand (`defaults write com.resoltico.TermAtTarget folder
  LEVEL`): a run is refused with that setting named, and the settings list
  shows it as not recognised and replaces it.

## What has not been established

- **macOS 12.3 to 14, and Intel Macs.** 12.3 is the floor the language target
  holds the artifact to; macOS 15 (on CI) and 27 have run it, nothing between
  or older. On macOS 27 osascript ships for Apple Silicon only, so the Intel
  code path cannot run here at all.
- **The interactive checks above, apart from the settings.** The settings were
  walked through in Shortcuts, pressed through the Accessibility API rather
  than by a pointer (see the measurements above); the Quick Action trigger,
  every question's keyboard and VoiceOver behaviour, and each cancellation have
  not been recorded. `choose from list` cannot be dismissed on a timer, so no
  unattended check shows the settings lists.
- **Older engines.** The emoji exception is the engine's own recommended
  set, which is its macOS's. An older macOS knows fewer emoji, and one without
  the `v` flag (before macOS 14) knows none, so more is shown escaped -- the
  safe direction, measured nowhere older than macOS 27.
- **Ideographic variation selectors.** After a Han ideograph one is kept
  without checking the IVD registry, which is too large to embed in a script
  that is pasted; an unregistered one there is not shown.
- **Each terminal app's own settings.** A Terminal profile's startup command,
  or a Ghostty configuration's working directory or command, can change the
  directory after the shell starts; the suite's check is of the shell, before
  anything such a setting does. Whether a request opens a window or a tab is the
  app's own choice.
- **Other installs of Ghostty and iTerm2.** Only Ghostty's release from
  ghostty.org, which its Homebrew cask also installs, and iTerm2's Homebrew
  cask, which installs its release, have been measured. A build with a
  different bundle identifier -- a nightly or beta, for instance -- is not
  found.
- **Atomicity.** The destination is validated and then handed to the terminal
  app by path; a folder renamed or replaced in between is not detected.

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
  after it, since the terminal app is handed a path.
- **Killing a helper by pid.** NSTask signals its task object only with
  SIGTERM; SIGKILL would need `kill()` with a pid, and NSTask reaps its child
  as soon as it exits, so the pid could name another process by the time the
  signal is sent. A helper that ignores SIGTERM is reported, with its pid.
- **Retrying a request that timed out.** It may already have reached
  the app; a retry could open two windows.
- **Settings in the script, or in `config.json` built into it.** No person can
  change a pasted script from the action itself, an edited copy no longer
  matches its checksum, and a newer version pasted over it loses the edit.
  Saving them in preferences costs one domain to remove, which INSTALL.txt
  says.
- **A Settings button on the folder question.** Standard Additions allows three
  buttons and that question uses all three; replacing Cancel would lose Esc.
  The question is also never asked once folders open inside or at their
  parent, so the settings would become unreachable. They are on the question a
  run given nothing asks, which can always be reached.
- **Holding Option to open the settings.** It is hidden from anyone who has
  not read about it, and has not been shown to work inside Shortcuts.
- **A custom AppKit settings window.** Measured: an `NSAlert` with pop-up menus,
  run from the script through Shortcuts, never appeared on screen -- no window
  from any Shortcuts process -- and the run waited behind it until it was
  stopped. Standard Additions dialogs and lists do appear there.
- **Any app that opens a folder.** Not every terminal app starts its shell at
  a folder it is handed. An app is supported only once that has been measured,
  so the settings name apps, not bundle identifiers.
