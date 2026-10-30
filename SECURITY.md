# Security and data boundaries

Term At Target is a local directory launcher, not a sandbox, permission manager
or command runner. Selected objects and their contents are never deliberately
written by this script. macOS and filesystem services may perform their normal
metadata/cache operations. Commands subsequently entered in the terminal app
are outside this action's boundary.

## Paths and launch

The final directory is passed to /usr/bin/open as a distinct NSTask argument,
with the terminal app named by its bundle identifier -- com.apple.Terminal,
com.mitchellh.ghostty, com.googlecode.iterm2 or net.kovidgoyal.kitty -- so no other application with the same name can
receive it. The identifiers are fixed in the script; a saved setting chooses
between them and cannot name any other app. No shell parses the directory; no
command is typed into an existing terminal session. kitty expands environment
variables in the directory it is given (measured; command substitution and ~
stay literal), so kitty is never handed a directory whose path contains "$". open reads and writes nothing but the
null device. It is given 10 seconds, on a clock no wall-clock change moves;
if it has not finished by then, or watching it fails, it is told to stop
through its own task object -- never by pid, which could by then name another
process -- and the run reports that the window may still appear, and which
process open is if it could not be seen to stop. Nothing is
retried, so a slow request cannot become two.
There is no eval, dynamic source download, network client, credential storage,
telemetry or external runtime dependency. Path text is validated without
trimming or splitting names. File URLs are decoded once and must be local.
Dialog display strings escape control characters and are never used as paths.

A selected Finder alias is classified before any target resolution. Choosing
its own containing folder does not resolve its target. Chosen alias targets
use withoutUI and withoutMounting options. This does not imply that access to
already mounted network filesystems can never block, or that every operation
macOS performs while accessing a path is under this script's control.

Validation precedes an asynchronous application handoff. Another process can
rename, remove or replace a directory between the check and Terminal opening
it. The script does not provide an atomic or sandboxed working-directory
transition, and an open exit status of zero does not prove a shell's actual
working directory. Ordinary filesystem and Shortcuts access controls remain
in effect; do not grant broad privileges to bypass a failure without diagnosis.

## Saved settings, and no other state

The one thing the action writes is its settings, in the macOS preferences
domain com.resoltico.TermAtTarget: which terminal app opens, and whether
folders and links are asked about. It writes no file -- no lock, cache or
temporary file. The source gate refuses a filesystem-writing call anywhere in
the shipped code, and NSUserDefaults anywhere but the one module that saves the
settings, so this is checked rather than promised.

A saved value is read as data and must be one of the few each setting takes;
anything else stops the run with a message naming the setting. Runs share
nothing else, so one run cannot block, corrupt or be blocked by another; two
at once make two requests, and a run reads the settings once, at its start.

There is deliberately no run lock. Nothing is shared that needs protecting,
and inside Shortcuts a lock cannot tell "another run holds it" from "locking
failed" (errno is not readable there), so it would turn every locking failure
into a silent no-op or every overlap into an error.

## Provenance and reports

Shortcuts may transform its input before invoking JXA. The script cannot
recover an alias or original Finder path that an upstream action has already
resolved/copied. Verify direct-input identity on the actual host. Do not hide
this problem by switching to Finder's later selection or guessing by basename.

The artifact checksum detects a byte mismatch, not authorship. A locally
created tar.gz has no signing or attestation claim. The included GitHub release
workflow requests separate verified build attestations when it is actually
run in the target repository. Preserve immutable/protected tags and suitable
repository permissions; a last-moment remote tag check is not an atomic tag
protection mechanism.

## Reporting

Report anything you believe to be a security problem through the repository's
private vulnerability reporting, rather than as a public issue. Include the
artifact checksum, the macOS and Shortcuts versions, how the action was
invoked, and a minimal reproduction that holds no real filenames, alias
targets or home paths.
