/*
 * Running the harness shortcuts: staging the artifact under test where their
 * loader reads it, selecting in Finder, and reading back what Shortcuts gave.
 */
import { spawnSync, execFileSync } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { HARNESS, HARNESS_DIRECTORY } from "./names.mjs";

const CONFIG = /var TERM_AT_TARGET_CONFIG = \{[^}]*\};/u;
const UNATTENDED = { defaultFolderAction: "INSIDE", defaultLinkAction: "TARGET" };
const TIMEOUT = 60000;

export function assertInstalled() {
    const installed = execFileSync("/usr/bin/shortcuts", ["list"], { encoding: "utf8" }).split("\n");
    const missing = Object.values(HARNESS).filter((name) => !installed.includes(name));

    if (missing.length > 0) {
        throw new Error(`Not installed: ${missing.join(", ")}. Run node tests/integration/shortcuts/build.mjs ` +
            "and add each shortcut it prints.");
    }
}

export async function stage(production) {
    if (!CONFIG.test(production)) {
        throw new Error("The artifact no longer declares TERM_AT_TARGET_CONFIG where the harness replaces it.");
    }

    await mkdir(HARNESS_DIRECTORY, { recursive: true });
    await writeFile(path.join(HARNESS_DIRECTORY, "artifact.jxa"),
        production.replace(CONFIG, `var TERM_AT_TARGET_CONFIG = ${JSON.stringify(UNATTENDED)};`));
}

function select(paths) {
    const items = paths.map((item) => `POSIX file ${JSON.stringify(item)} as alias`).join(", ");

    execFileSync("/usr/bin/osascript", ["-e", `tell application "Finder" to select {${items}}`]);
}

// The shortcut for a route, run on these items; its output and what it saw.
export async function runRoute(route, items) {
    if (route === "selection") {
        select(items);
    }

    const inputs = route === "input" ? items.flatMap((item) => ["--input-path", item]) : [];
    const ran = spawnSync("/usr/bin/shortcuts", ["run", HARNESS[route], ...inputs], { encoding: "utf8", timeout: TIMEOUT });
    const seen = JSON.parse(await readFile(path.join(HARNESS_DIRECTORY, "last-input.json"), "utf8"));

    return { ran, seen };
}
