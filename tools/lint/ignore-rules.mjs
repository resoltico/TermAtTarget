import { readFromDisk } from "./consistency.mjs";

// These directories hold generated output outside version control.
const GENERATED = ["node_modules/", "reports/", "artifacts/", ".stryker-tmp/", "dist/"];

export function parseIgnore(text) {
    return String(text)
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "" && !line.startsWith("#"));
}

function bare(pattern) {
    return pattern.replace(/^\//u, "").replace(/\/$/u, "");
}

/*
 * Last match wins, which is how git resolves a pattern and a later negation
 * of it.
 */
export function ignoresPath(patterns, path) {
    let ignored = false;

    for (const pattern of patterns) {
        const negated = pattern.startsWith("!");

        if (bare(negated ? pattern.slice(1) : pattern) === bare(path)) {
            ignored = !negated;
        }
    }

    return ignored;
}

export function checkIgnoreRules(patterns) {
    const uncovered = GENERATED.filter((path) => !ignoresPath(patterns, path));

    if (uncovered.length > 0) {
        throw new Error(
            "the toolchain writes these into the working tree and the ignore " +
            `file does not cover them: ${uncovered.join(", ")}`
        );
    }

    return patterns.length;
}

export async function checkIgnores(read = readFromDisk) {
    return checkIgnoreRules(parseIgnore(await read(".gitignore")));
}
