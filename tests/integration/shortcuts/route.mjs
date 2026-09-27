/*
 * The artifact run through Shortcuts itself, by both routes a Quick Action can
 * take: Finder's selection fed in by Get Selected Files in Finder, and the
 * shortcut's own input. Unit tests are handed the input shape as it was
 * measured; this is where that measurement stays true.
 *
 * The configuration is fixed at INSIDE and TARGET so nothing waits on a
 * question, and each successful run is checked in the shell Terminal starts.
 */
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertInstalled, stage, runRoute } from "./harness.mjs";
import { shellAt } from "../terminal-cwd.mjs";

async function opensAt(route, items, expected) {
    const { ran, seen } = await runRoute(route, items);

    if (ran.status !== 0) {
        throw new Error(`${route}: ${JSON.stringify(items)} failed: ${ran.stderr}${ran.stdout}`);
    }

    const shell = await shellAt(expected, 15000);

    if (shell === null) {
        throw new Error(`${route}: no shell reached ${JSON.stringify(expected)} for ${JSON.stringify(items)}.`);
    }

    process.kill(shell, "SIGHUP");

    return seen;
}

async function refused(route, items) {
    const { ran, seen } = await runRoute(route, items);

    if (ran.status === 0 || !`${ran.stderr}${ran.stdout}`.includes("one selected item at a time")) {
        throw new Error(`${route}: two items were not refused as two: ${ran.status} ${ran.stderr}${ran.stdout}`);
    }

    return seen;
}

async function fixtures(temp) {
    const base = path.join(temp, "shortcuts ' $HOME `x`; & \u{1F600}");
    const folder = path.join(base, "folder");
    const file = path.join(base, "file.txt");

    await mkdir(folder, { recursive: true });
    await writeFile(file, "fixture\n");
    await writeFile(path.join(base, "second.txt"), "fixture\n");
    execFileSync("/usr/bin/osascript", ["-e", `tell application "Finder" to make new alias file at ` +
        `(POSIX file ${JSON.stringify(base)} as alias) to (POSIX file ${JSON.stringify(folder)} as alias) ` +
        "with properties {name:\"folder alias\"}"]);

    return { base, folder, file, alias: path.join(base, "folder alias"), second: path.join(base, "second.txt") };
}

async function eachRoute(at) {
    const evidence = {};

    for (const route of ["selection", "input"]) {
        evidence[route] = {
            file: await opensAt(route, [at.file], at.base),
            folder: await opensAt(route, [at.folder], at.folder),
            alias: await opensAt(route, [at.alias], at.folder),
            twoFiles: await refused(route, [at.file, at.second])
        };
        console.log(`PASS: through Shortcuts (${route}): a file, a folder and an alias open where they should; two files are refused.`);
    }

    return evidence;
}

export async function throughShortcuts(temp, production) {
    assertInstalled();
    await stage(production);

    const at = await fixtures(temp);
    return await eachRoute(at);
}
