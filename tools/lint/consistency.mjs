import { readFile } from "node:fs/promises";
import path from "node:path";
import { root } from "../repository.mjs";
import { extractNotes } from "../notes.mjs";

/*
 * Facts that are stated in more than one file must agree.
 *
 * Each is stated where a reader or a tool looks for it, so it cannot be
 * stated once; what can be done is to compare every copy on every run.
 */

export async function readFromDisk(relative) {
    try {
        return await readFile(path.join(root, relative), "utf8");
    } catch (error) {
        throw new Error(
            `${relative} is missing, and the gate checks it for a fact other ` +
            "files state too. If it was renamed, update " +
            "tools/lint/consistency.mjs as well; INSTALL.txt in particular is " +
            "deliberately plain text.",
            { cause: error }
        );
    }
}

export function assertAll(label, found) {
    const distinct = [...new Set(found.map(([, value]) => value))];

    if (distinct.length > 1) {
        const detail = found
            .map(([where, value]) => `  ${where}: ${value}`)
            .join("\n");

        throw new Error(`${label} disagree between files:\n${detail}`);
    }

    return distinct[0];
}

export function extract(text, pattern, where) {
    const match = pattern.exec(text);

    if (!match) {
        throw new Error(`could not find the declared value in ${where}`);
    }

    return [where, match.groups.value];
}

async function readJson(read, relative) {
    return JSON.parse(await read(relative));
}

export async function checkVersion(read = readFromDisk) {
    const packageJson = await readJson(read, "package.json");
    const lock = await readJson(read, "package-lock.json");

    return assertAll("versions", [
        ["package.json", packageJson.version],
        ["package-lock.json", lock.version],
        ["package-lock.json (root package)", lock.packages[""].version],
        extract(await read("INSTALL.txt"), /TERM AT TARGET (?<value>\d+\.\d+\.\d+)/u, "INSTALL.txt"),
        extract(await read("CHANGELOG.md"), /^## \[(?<value>\d+\.\d+\.\d+)\]/mu, "CHANGELOG.md (newest entry)")
    ]);
}

// npm writes the name into the lockfile, and a rename that skips it leaves
// `npm ci` installing against a lockfile for some other package.
export async function checkPackageName(read = readFromDisk) {
    const packageJson = await readJson(read, "package.json");
    const lock = await readJson(read, "package-lock.json");

    return assertAll("package names", [
        ["package.json", packageJson.name],
        ["package-lock.json", lock.name],
        ["package-lock.json (root package)", lock.packages[""].name]
    ]);
}

export async function checkNodeVersion(read = readFromDisk) {
    const packageJson = await readJson(read, "package.json");

    return assertAll("Node versions", [
        [".node-version", (await read(".node-version")).trim()],
        extract(await read("mise.toml"), /node = "(?<value>[\d.]+)"/u, "mise.toml"),
        ["package.json engines", packageJson.engines.node.replace(/^>=/u, "")]
    ]);
}

/*
 * The language the artifact is written in, stated twice: once in the
 * metadata the artifact carries, and once in the ESLint setting that holds
 * src/ to it. Either alone could be raised without the other noticing.
 */
export async function checkLanguageYear(read = readFromDisk) {
    const packageJson = await readJson(read, "package.json");

    return assertAll("language targets", [
        extract(packageJson.termAtTarget.runtimeLanguage, /^ES(?<value>\d{4})$/u, "package.json runtimeLanguage"),
        extract(await read("eslint.config.mjs"), /JXA_ECMA_VERSION = (?<value>\d{4});/u, "eslint.config.mjs")
    ]);
}

/*
 * The one address the artifact's documents carry out of this repository.
 * package.json declares it in two forms as npm requires, and both are
 * compared here in the plain one.
 */
const PROJECT_URL = /(?<value>https:\/\/github\.com\/[\w.-]+\/[\w.-]+)/u;

const asBrowsableUrl = (declared) => String(declared)
    .replace(/^git\+/u, "")
    .replace(/\.git$/u, "");

export async function checkRepositoryUrl(read = readFromDisk) {
    const packageJson = await readJson(read, "package.json");

    return assertAll("repository URLs", [
        ["package.json homepage", packageJson.homepage],
        ["package.json repository", asBrowsableUrl(packageJson.repository.url)],
        extract(await read("README.md"), PROJECT_URL, "README.md"),
        extract(await read("INSTALL.txt"), PROJECT_URL, "INSTALL.txt")
    ]);
}

export async function checkConsistency(read = readFromDisk) {
    const version = await checkVersion(read);
    const name = await checkPackageName(read);
    const node = await checkNodeVersion(read);
    const language = await checkLanguageYear(read);
    const url = await checkRepositoryUrl(read);

    // The version the files agree on has release notes, dated, to publish.
    extractNotes(await read("CHANGELOG.md"), version);

    return `${name} ${version}, node ${node}, ES${language}, ${url}`;
}
