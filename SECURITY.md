# Security and data boundaries

Term At Target is a local directory launcher, not a sandbox, permission manager
or command runner. Selected objects and their contents are never deliberately
written by this script. macOS and filesystem services may perform their normal
metadata/cache operations. Commands subsequently entered in Terminal are
outside this action's boundary.

## Paths and launch

The final directory is passed to /usr/bin/open as a distinct NSTask argument,
with Terminal named by its bundle identifier, com.apple.Terminal, so no other
application called Terminal can receive it. No shell parses it; no command is
typed into an existing Terminal session. open reads and writes nothing but the
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

## No state

The action writes nothing to disk: no lock, preference, cache or temporary
file. The source gate refuses a filesystem-writing call anywhere in the
shipped code, so this is checked rather than promised. Runs share nothing,
so one run cannot block, corrupt or be blocked by another; two at once make
two requests.

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
