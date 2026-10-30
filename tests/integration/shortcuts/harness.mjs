/*
 * Running the harness shortcuts: staging the artifact under test where their
 * loader reads it, selecting in Finder, and reading back what Shortcuts gave.
 */
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { HARNESS, HARNESS_DIRECTORY } from "./names.mjs";
import { dismissAlert } from "./alert.mjs";

/*
 * The artifact under test saves its settings in a domain of the harness's own,
 * so a person's settings are never read or written. Its one spelling of the
 * action's domain is replaced, and the settings that let nothing wait on a
 * question are saved there for as long as the routes run.
 */
const DOMAIN = "\"com.resoltico.TermAtTarget\"";
const HARNESS_DOMAIN = "com.resoltico.TermAtTarget.harness";
const UNATTENDED = { terminal: "terminal", folder: "inside", link: "follow" };
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
    if (production.split(DOMAIN).length !== 2) {
        throw new Error("The artifact no longer spells its preferences domain exactly once, where the harness replaces it.");
    }

    await mkdir(HARNESS_DIRECTORY, { recursive: true });
    await writeFile(path.join(HARNESS_DIRECTORY, "artifact.jxa"), production.replace(DOMAIN, JSON.stringify(HARNESS_DOMAIN)));

    for (const [key, value] of Object.entries(UNATTENDED)) {
        execFileSync("/usr/bin/defaults", ["write", HARNESS_DOMAIN, key, value]);
    }
}

// The harness's settings, gone once the routes have run.
export function unstage() {
    spawnSync("/usr/bin/defaults", ["delete", HARNESS_DOMAIN], { stdio: "ignore" });
}

function select(paths) {
    const items = paths.map((item) => `POSIX file ${JSON.stringify(item)} as alias`).join(", ");

    execFileSync("/usr/bin/osascript", ["-e", `tell application "Finder" to select {${items}}`]);
}

function argumentsFor(route, items) {
    if (route === "selection") {
        select(items);
    }

    return ["run", HARNESS[route], ...(route === "input" ? items.flatMap((item) => ["--input-path", item]) : [])];
}

const seenByLoader = async () => JSON.parse(await readFile(path.join(HARNESS_DIRECTORY, "last-input.json"), "utf8"));

// The shortcut for a route, run on these items; its output and what it saw.
export async function runRoute(route, items) {
    const ran = spawnSync("/usr/bin/shortcuts", argumentsFor(route, items), { encoding: "utf8", timeout: TIMEOUT });

    return { ran, seen: await seenByLoader() };
}

// The same, for a run that is refused: its alert read and dismissed, then its exit status.
export async function runRefused(route, items) {
    const child = spawn("/usr/bin/shortcuts", argumentsFor(route, items), { stdio: "ignore" });
    const exited = new Promise((resolve) => {
        child.on("exit", resolve);
    });
    const alert = await dismissAlert(TIMEOUT);

    if (alert === null) {
        child.kill();
    }

    return { status: await exited, alert, seen: await seenByLoader() };
}
