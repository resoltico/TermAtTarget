/*
 * The native macOS suite compiles the production artifact and exercises the
 * real Foundation adapters through a separately bundled test entry.
 *
 *   node tests/integration/macos.mjs [--dialogs] [--terminal] [--shortcuts]
 *
 * --dialogs shows each question for a second; --terminal opens one real
 * window in each supported terminal app that is installed; --shortcuts runs
 * the artifact through Shortcuts.
 */
import { createHash } from "node:crypto";
import { execFile, spawnSync, execFileSync } from "node:child_process";
import { mkdtemp, writeFile, mkdir, rm, realpath } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { root, artifactName, read } from "../../tools/repository.mjs";
import { renderBundle, renderRelease } from "../../tools/bundle.mjs";
import { checkSelectionCwd, checkTerminals } from "./terminal-check.mjs";
import { checkOverlappingPreferences, checkPreferences } from "./preferences-check.mjs";
import { throughShortcuts } from "./shortcuts/route.mjs";
import { prepareFixtures, releaseFixtures, aliasToEjectedVolume, isAttached } from "./fixtures.mjs";
import { checkSupervisor } from "./supervisor.mjs";
import { completeHeadlessCases, NATIVE_FIXTURES } from "./headless-cases.mjs";
import { checkPresentation } from "./present-check.mjs";

if (process.platform !== "darwin") {
    console.error("Native macOS integration requires macOS, osascript and Foundation. Not executed; not a passing skip.");
    process.exit(2);
}

const invokeAsync = promisify(execFile);
const flag = (name) => process.argv.includes(name);

const temp = await realpath(await mkdtemp(path.join(tmpdir(), "term-at-target-native-")));
const script = path.join(temp, "native.jxa");
const reportPath = path.join(root, "reports", "native-macos.json");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

function invoke(mode, ...args) {
    const result = spawnSync("/usr/bin/osascript", ["-l", "JavaScript", script, mode, temp, ...args], { encoding: "utf8", timeout: 60000 });

    if (result.error || result.status !== 0) {
        throw new Error(`Native ${mode} failed: ${result.stderr}${result.stdout}`);
    }

    return JSON.parse(result.stdout.trim());
}

async function invokeWriter(...args) {
    await invokeAsync("/usr/bin/osascript", ["-l", "JavaScript", script, "preferences", temp, ...args],
        { timeout: 60000 });
}

// Each question shown by Standard Additions as the artifact asks it.
function dialogCheck() {
    const shown = invoke("dialogs");

    // A question that times out must refuse the answer; the alert asks nothing,
    // so it must simply be shown and dismissed without complaint.
    for (const [question, refusal] of Object.entries(shown)) {
        const expected = question === "alert" ? null : "invalidAnswer";

        if (refusal !== expected) {
            throw new Error(`The ${question} dialog was not shown as asked: ${refusal}`);
        }
    }

    console.log("PASS: every question and the failure alert shown by Standard Additions with the options the artifact passes.");

    return shown;
}


try {
    await rm(reportPath, { force: true });
    const source = { commit: git("rev-parse", "HEAD"), clean: git("status", "--porcelain") === "" };
    const production = await renderRelease();
    const productionScript = path.join(temp, artifactName);
    const native = await renderBundle("tests/integration/entry.cjs");

    await writeFile(productionScript, production);
    await writeFile(script, `${native.code}\nconst NATIVE_FIXTURES = ${JSON.stringify(NATIVE_FIXTURES)};\n${await read("tests/integration/native-modes.jxa")}\n` +
        `${await read("tests/integration/native-body.jxa")}`);
    await prepareFixtures(temp);

    const compiled = spawnSync("/usr/bin/osacompile", ["-l", "JavaScript", "-o", path.join(temp, "production.scpt"),
        productionScript], { encoding: "utf8", timeout: 30000 });

    if (compiled.error || compiled.status !== 0) {
        throw new Error(`Native compile failed: ${compiled.stderr}`);
    }

    const image = await aliasToEjectedVolume(temp, (target, name) => invoke("alias", target, name));
    const report = invoke("main");

    if (!completeHeadlessCases(report.passed, report.count)) {
        throw new Error("The native suite did not complete the declared fixture inventory.");
    }

    if (isAttached(image)) {
        throw new Error("Resolving an alias to an ejected volume mounted it again.");
    }

    console.log(JSON.stringify(report, null, 2));
    report.source = source;
    report.artifactSha256 = createHash("sha256").update(production).digest("hex");
    report.architecture = process.arch;
    report.compiled = true;
    report.aliasVolumeStayedDetached = true;
    report.result = "passed";
    report.scope = ["headless", ...["dialogs", "terminal", "shortcuts"].filter((mode) => flag(`--${mode}`))];
    report.supervisor = checkSupervisor(invoke, execFileSync);
    report.presentation = checkPresentation(invoke);
    report.preferences = checkPreferences(invoke);
    report.overlappingPreferences = await checkOverlappingPreferences(invoke, invokeWriter, temp);

    if (flag("--dialogs")) {
        report.dialogs = dialogCheck();
    }

    const terminals = flag("--terminal") ? await checkTerminals(invoke, temp) : null;
    const selectionCwd = flag("--terminal") ? await checkSelectionCwd(invoke, temp) : null;

    // Shortcuts' own input delivery, through the harness shortcuts.
    const shortcuts = flag("--shortcuts") ? await throughShortcuts(temp, production) : null;
    await mkdir(path.join(root, "reports"), { recursive: true });
    await writeFile(reportPath,
        `${JSON.stringify({ ...report, terminals, selectionCwd, shortcuts }, null, 2)}\n`);
} finally {
    await releaseFixtures(temp);
    await rm(temp, { recursive: true, force: true });
}
