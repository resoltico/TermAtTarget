/*
 * Running the harness shortcuts: staging the artifact under test where their
 * loader reads it, selecting in Finder, and reading back what Shortcuts gave.
 */
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { HARNESS, HARNESS_DIRECTORY } from "./names.mjs";
import { dismissAlert, observeRefusal } from "./alert.mjs";
import { invokeRequest, requireIdle } from "./request.mjs";

/*
 * The artifact under test saves its settings in a domain of the harness's own,
 * so a person's settings are never read or written. Its one spelling of the
 * action's domain is replaced, and the settings that let nothing wait on a
 * question are saved there for as long as the routes run.
 */
const require = createRequire(import.meta.url);
const { failureReport } = require("../../../src/core/failure-report.js");
const { refuse } = require("../../../src/core/outcomes.js");
const STAGED_ARTIFACT = path.join(HARNESS_DIRECTORY, "artifact.jxa");
const DOMAIN = "\"com.resoltico.TermAtTarget\"";
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

function forDomain(production, domain) {
    if (production.split(DOMAIN).length !== 2) {
        throw new Error("The artifact no longer spells its preferences domain exactly once, where the harness replaces it.");
    }

    return production.replace(DOMAIN, JSON.stringify(domain));
}

async function releaseStage(directory) {
    try {
        await requireIdle(directory);
    } catch {
        // Leave the lease after an unconfirmed invocation, without runnable code.
        await rm(path.join(directory, "artifact.jxa"), { force: true });
        console.error(`Shortcuts QA stage requires recovery: ${directory}`);
        return;
    }

    await rm(directory, { recursive: true });
}

export async function withStagedArtifact(production, run) {
    await mkdir(path.dirname(HARNESS_DIRECTORY), { recursive: true });
    // Both installed shortcuts use the same loader. An existing directory
    // means that a run is active or needs recovery after interruption.
    await mkdir(HARNESS_DIRECTORY);
    const domain = `com.resoltico.TermAtTarget.qa.${randomUUID()}`;

    try {
        await writeFile(STAGED_ARTIFACT, forDomain(production, domain));
        for (const [key, value] of Object.entries(UNATTENDED)) {
            execFileSync("/usr/bin/defaults", ["write", domain, key, value]);
        }

        return await run();
    } finally {
        spawnSync("/usr/bin/defaults", ["delete", domain], { stdio: "ignore" });
        await releaseStage(HARNESS_DIRECTORY);
    }
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

// Only an observed, successful invocation releases the request.
export function runRoute(route, items) {
    return invokeRequest(HARNESS_DIRECTORY, () => {
        const ran = spawnSync("/usr/bin/shortcuts", argumentsFor(route, items), { encoding: "utf8", timeout: TIMEOUT });

        if (ran.status !== 0) {
            throw new Error(`Shortcuts ${route} failed: ${ran.error ?? ran.stderr}`);
        }

        return { ran };
    });
}

async function withRefusalTitle(request, run) {
    const { heading, message } = failureReport(refuse("multipleSelection"));
    const title = `${heading} (QA ${request})`;
    const production = await readFile(STAGED_ARTIFACT, "utf8");
    const original = JSON.stringify(heading);

    if (production.split(original).length !== 2) {
        throw new Error("The staged artifact must contain exactly one multiple-selection heading.");
    }

    await writeFile(STAGED_ARTIFACT, production.replace(original, JSON.stringify(title)));
    try {
        return await run({ title, message });
    } finally {
        await writeFile(STAGED_ARTIFACT, production);
    }
}

async function refusedResult(route, items, expected) {
    const child = spawn("/usr/bin/shortcuts", argumentsFor(route, items), { stdio: "ignore", timeout: TIMEOUT });
    const result = await observeRefusal(child, (signal) => dismissAlert(expected, TIMEOUT, signal));

    if (result.status !== 0 || result.alert !== expected.message) {
        throw new Error(`Shortcuts ${route} did not finish with the expected refusal (status ${result.status}).`);
    }

    return result;
}

export function runRefused(route, items) {
    return invokeRequest(HARNESS_DIRECTORY,
        (request) => withRefusalTitle(request, (expected) => refusedResult(route, items, expected)));
}
