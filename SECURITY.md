# Security and data boundaries

Term At Target selects a destination and hands its path to a local terminal
app. The action reads filesystem metadata, leaves selected objects and their
contents untouched, and saves its preferences. macOS and filesystem services
may perform their normal metadata and cache operations. Commands entered
in the terminal app run outside the action's boundary.

## Path identity

The action uses the path it receives from Shortcuts. If an upstream action
copies an object or resolves its alias, the action receives the transformed
input. Check the input path on the actual host when diagnosing selection
problems. [Direct-input setup](INSTALL.txt)

The action checks the final directory before handing it to the terminal app.
When an alias is followed, macOS receives the without-UI and without-mounting
options. Opening the folder containing an alias avoids resolving its target.
Operations on an already mounted filesystem can still block.

Questions and alerts display paths using the escaping rules in
`src/core/present.js`. Alerts keep the full path and visibly escape controls
and direction-changing characters. The filesystem and launcher receive the
path itself.

## Launch and permissions

The launcher passes the destination as a distinct argument to the macOS
`open` helper through NSTask. The app bundle identifier comes from
`src/runtime/executables.js`. The core refuses paths a supported app is
known to reinterpret. [The kitty path rule](README.md#settings)

`src/runtime/supervise.js` bounds the wait on a monotonic clock and stops the
helper through its task object. An unconfirmed request may still reach the
app. Each action run makes at most one open request.

The terminal app receives a path after validation. Another process can
rename, remove or replace the directory in that interval. A successful
helper exit indicates the handoff. The terminal's profile and startup
commands can still affect the shell's working directory. Ordinary filesystem
permissions and Shortcuts access controls apply throughout. Grant access
for a selected location when it is needed.

## Local state

The preferences domain documented in [INSTALL.txt](INSTALL.txt) is the
action's only persistent state. The source gate rejects filesystem writes
and confines NSUserDefaults to `src/runtime/preferences.js`. Each run reads
settings once and manages its own request.

## Provenance

For a downloaded script, check the SHA-256 manifest for byte integrity and
verify the GitHub build attestation against the project repository. A local
build has a checksum manifest. [Verification commands](INSTALL.txt)

## Reporting

Use [GitHub's private vulnerability reporting](https://github.com/resoltico/TermAtTarget/security/advisories/new).
Include the script's SHA-256 checksum, the macOS and Shortcuts versions,
how the action was invoked, and a minimal reproduction with synthetic
filenames, alias targets and paths.
