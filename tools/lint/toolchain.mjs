import { assertAll, readFromDisk } from "./consistency.mjs";

/*
 * The Homebrew command that installs what the gate runs when it can.
 *
 * actionlint is optional, so that the gate stays runnable anywhere, which
 * also means nothing fails when a machine lacks it: the one guarantee that it
 * runs at all is the macOS jobs installing it. The command is written in
 * CONTRIBUTING.md and in each workflow, and a copy that drifts is a job that
 * quietly stops checking.
 *
 * The native suite itself needs nothing installed: osascript, lsof and open
 * ship with macOS.
 */

const INSTALL_SOURCES = [
    "CONTRIBUTING.md",
    ".github/workflows/quality.yml",
    ".github/workflows/release.yml"
];

const INSTALL = /brew install (?<value>[^\n`]+)/gu;

export async function installCommands(read = readFromDisk) {
    const found = [];

    await Promise.all(INSTALL_SOURCES.map(async (file) => {
        const matches = [...String(await read(file)).matchAll(INSTALL)];

        if (matches.length === 0) {
            throw new Error(`${file} no longer documents the install command`);
        }

        matches.forEach((match, index) => {
            found.push([`${file} (${index + 1})`, match.groups.value.trim()]);
        });
    }));

    return found.sort(([left], [right]) => left.localeCompare(right, "en"));
}

export async function checkToolchain(read = readFromDisk) {
    const installed = assertAll("install commands", await installCommands(read));

    if (!installed.split(/\s+/u).includes("actionlint")) {
        throw new Error(
            `the documented install (${installed}) does not provide actionlint, ` +
            "so no job would ever lint the workflows"
        );
    }

    return installed;
}
