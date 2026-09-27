/*
 * What the shipped code may reach for, and what the portable core may not.
 *
 * The artifact runs under osascript, where there is no Node, no module loader
 * beyond the bundle's own, and no network the action has any business with.
 * A construct that would load or run code from somewhere else is refused
 * outright, rather than trusted to fail on the Mac.
 *
 * The core decides; the runtime touches macOS. Keeping every native name out
 * of src/core/ is what lets the core be tested in Node with nothing standing
 * in for it -- and what makes a native call findable by looking in one
 * directory.
 */

// Each a global, so a property of the same name on something else (a task's
// process, a loader's import) is not one: nothing may stand before it but
// something that is not part of a name or a member access.
const FORBIDDEN = [
    [/(?<![\w$.])eval\s*\(/u, "eval"],
    [/(?<![\w$.])new\s+Function\b/u, "new Function"],
    [/(?<![\w$.])import\s*\(/u, "dynamic import"],
    [/(?<![\w$.])fetch\s*\(/u, "fetch"],
    [/(?<![\w$.])process\./u, "Node's process"],
    [/(?<![\w$.])Buffer\./u, "Node's Buffer"]
];

const NATIVE_NAMES = /\b(?:ObjC|Application|NSTask|NSFileManager|Ref)\b/u;

/*
 * The action writes nothing: no lock, no preference, no temporary file. That
 * is a property of the product (INSTALL.txt says there is nothing to remove),
 * so the calls that would write are refused by name.
 */
const WRITE_NAMES = "mkdir|rmdir|unlink|fchmod|chmod|flock|rename|writeToFile\\w*|writeToURL\\w*|createFileAtPath\\w*|createDirectoryAtPath\\w*|createDirectoryAtURL\\w*|createSymbolicLink\\w*|removeItemAt\\w*|moveItemAt\\w*|copyItemAt\\w*|linkItemAt\\w*|setAttributes\\w*|trashItemAt\\w*|fileHandleForWriting\\w*|fileHandleForUpdating\\w*";
// A call or a member access, so prose that says "rename" is not a write.
const WRITES = new RegExp(`(?<=\\.)(?:${WRITE_NAMES})\\b|\\b(?:${WRITE_NAMES})(?=\\s*\\()`, "u");

export function writesIn(content) {
    return WRITES.exec(content)?.[0] ?? null;
}

export function forbiddenIn(content) {
    return FORBIDDEN
        .filter(([pattern]) => pattern.test(content))
        .map(([, name]) => name);
}

function checkLoads(relativePath, content) {
    const found = forbiddenIn(content);

    if (found.length > 0) {
        throw new Error(
            `${relativePath}: uses ${found.join(", ")}; the artifact runs ` +
            "under osascript and loads nothing it does not carry"
        );
    }
}

function checkWrites(relativePath, content) {
    const write = writesIn(content);

    if (write !== null) {
        throw new Error(
            `${relativePath}: calls ${write}; the action writes nothing to disk, ` +
            "and INSTALL.txt tells people there is nothing to remove"
        );
    }
}

function checkPortable(relativePath, content) {
    const native = NATIVE_NAMES.exec(content);

    if (relativePath.startsWith("src/core/") && native) {
        throw new Error(
            `${relativePath}: names ${native[0]}; the core is portable, and ` +
            "everything that touches macOS belongs in src/runtime/"
        );
    }
}

export function checkBoundaries(relativePath, content) {
    if (!relativePath.startsWith("src/")) {
        return;
    }

    checkLoads(relativePath, content);
    checkWrites(relativePath, content);
    checkPortable(relativePath, content);
}
