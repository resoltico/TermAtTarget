import { parse } from "acorn";

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

/*
 * What JXA puts in a script's global scope to reach macOS. Found by parsing,
 * as identifiers the code actually uses -- not as words, which a comment, a
 * string or a property named the same would also be.
 */
const HOST_GLOBALS = new Set(["ObjC", "Application", "Ref", "Path", "Progress", "Library", "$", "globalThis"]);

/*
 * The action writes no file: no lock, no cache, no temporary file. Its saved
 * settings are the one thing it writes, through macOS preferences, from the
 * one module that owns them -- INSTALL.txt says that domain is all there is to
 * remove -- so the calls that would write a file are refused by name, and
 * preferences are refused anywhere else.
 */
const WRITE_NAMES = "mkdir|rmdir|unlink|fchmod|chmod|flock|rename|writeToFile\\w*|writeToURL\\w*|createFileAtPath\\w*|createDirectoryAtPath\\w*|createDirectoryAtURL\\w*|createSymbolicLink\\w*|removeItemAt\\w*|moveItemAt\\w*|copyItemAt\\w*|linkItemAt\\w*|setAttributes\\w*|trashItemAt\\w*|fileHandleForWriting\\w*|fileHandleForUpdating\\w*";
// A call or a member access, so prose that says "rename" is not a write.
const WRITES = new RegExp(`(?<=\\.)(?:${WRITE_NAMES})\\b|\\b(?:${WRITE_NAMES})(?=\\s*\\()`, "u");

const PREFERENCES = /\bNSUserDefaults\b/u;
const PREFERENCES_MODULE = "src/runtime/preferences.js";

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
            `${relativePath}: calls ${write}; the action writes no file, ` +
            "and INSTALL.txt tells people its settings are all there is to remove"
        );
    }

    if (relativePath !== PREFERENCES_MODULE && PREFERENCES.test(content)) {
        throw new Error(
            `${relativePath}: names NSUserDefaults; the saved settings are written ` +
            `only by ${PREFERENCES_MODULE}, so what the action writes is in one place`
        );
    }
}

// A name used as a value: not a property after a dot, nor a key in an object literal.
function isReference(node, parent, key) {
    return !(parent?.type === "MemberExpression" && key === "property" && !parent.computed) &&
        !(parent?.type === "Property" && key === "key" && !parent.computed);
}

// A node's child nodes, each with the key it hangs from.
function childrenOf(node) {
    return Object.entries(node).flatMap(([key, value]) => (Array.isArray(value) ? value : [value])
        .filter((child) => child !== null && typeof child === "object" && typeof child.type === "string")
        .map((child) => [key, child]));
}

export function hostGlobalIn(node, parent = null, key = null) {
    if (node.type === "Identifier" && HOST_GLOBALS.has(node.name) && isReference(node, parent, key)) {
        return node.name;
    }

    for (const [childKey, child] of childrenOf(node)) {
        const found = hostGlobalIn(child, node, childKey);

        if (found !== null) {
            return found;
        }
    }

    return null;
}

function checkPortable(relativePath, content) {
    if (!relativePath.startsWith("src/core/")) {
        return;
    }

    const native = hostGlobalIn(parse(content, { ecmaVersion: "latest", sourceType: "script" }));

    if (native !== null) {
        throw new Error(
            `${relativePath}: uses ${native}; the core is portable, and ` +
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
