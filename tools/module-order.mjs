// All production source modules are accounted for. Dependencies are checked
// and resolved locally by bundle.mjs; order is deterministic, not semantic.
export const modules = Object.freeze([
    "src/core/config.js",
    "src/core/errors.js",
    "src/core/paths.js",
    "src/core/invocation.js",
    "src/core/unicode-tables.js",
    "src/core/unicode-sets.js",
    "src/core/writing.js",
    "src/core/present.js",
    "src/core/resolve.js",
    "src/core/plan.js",
    "src/core/workflow.js",
    "src/runtime/executables.js",
    "src/runtime/bridge.js",
    "src/runtime/attributes.js",
    "src/runtime/links.js",
    "src/runtime/given-path.js",
    "src/runtime/foundation.js",
    "src/runtime/dialogs.js",
    "src/runtime/supervise.js",
    "src/runtime/launcher.js",
    "src/runtime/host.js",
    "src/runtime/entry.js"
]);
