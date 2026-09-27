import { fileURLToPath } from "node:url";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/*
 * Where this repository is, what is in it, and what it says about itself.
 *
 * Every tool that reads the tree reads it through here, with the base as a
 * parameter, so each can be pointed at a copy of the repository in a test and
 * shown to fail rather than only observed passing on a tree already in order.
 */

export const root = fileURLToPath(new URL("../", import.meta.url));

// Not source: version control, what the toolchain writes, and Finder's notes.
export const excluded = new Set([".git", "node_modules", "reports", "artifacts", ".stryker-tmp", ".DS_Store"]);

export const artifactName = "Term-At-Target.jxa";

const RELEASE_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;

export function read(relative, base = root) {
    return readFile(path.join(base, relative), "utf8");
}

/*
 * A symbolic link is refused rather than followed or skipped -- archived, it
 * would point somewhere on the machine that built it.
 */
function isDirectory(entry, name) {
    if (entry.isSymbolicLink()) {
        throw new Error(`Repository sources may not contain symlinks: ${name}`);
    }

    if (!entry.isDirectory() && !entry.isFile()) {
        throw new Error(`Unsupported repository entry: ${name}`);
    }

    return entry.isDirectory();
}

export async function filesBelow(relative = "", base = root) {
    const entries = await readdir(path.join(base, relative), { withFileTypes: true });
    const found = await Promise.all(entries
        .filter((entry) => !excluded.has(entry.name))
        .map((entry) => {
            const name = relative ? `${relative}/${entry.name}` : entry.name;

            return isDirectory(entry, name) ? filesBelow(name, base) : [name];
        }));

    return found.flat().sort();
}

export async function metadata(base = root) {
    const pkg = JSON.parse(await read("package.json", base));

    if (!RELEASE_VERSION.test(pkg.version)) {
        throw new Error("package.json must provide a valid release version.");
    }

    return { ...pkg.termAtTarget, version: pkg.version, license: pkg.license };
}
