/*
 * The native macOS suite: the committed artifact, compiled and run against
 * real Foundation, with a test entry point appended in a temporary copy.
 *
 *   node tests/integration/macos.mjs [--dialogs] [--terminal] [--shortcuts]
 *
 * --dialogs shows each question for a second; --terminal opens one real
 * Terminal window; --shortcuts runs the artifact through Shortcuts.
 */
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtemp, writeFile, mkdir, rm, realpath } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { root, artifactName, read } from "../../tools/repository.mjs";
import { checkDist } from "../../tools/dist.mjs";
import { shellAt } from "./terminal-cwd.mjs";
import { throughShortcuts } from "./shortcuts/route.mjs";
import { prepareFixtures, releaseFixtures, aliasToEjectedVolume, isAttached } from "./fixtures.mjs";
import { checkSupervisor } from "./supervisor.mjs";
import { checkPresentation } from "./present-check.mjs";

if (process.platform !== "darwin") {
    console.error("Native macOS integration requires macOS, osascript and Foundation. Not executed; not a passing skip.");
    process.exit(2);
}

const flag = (name) => process.argv.includes(name);

await checkDist();

const temp = await realpath(await mkdtemp(path.join(tmpdir(), "term-at-target-native-")));
const script = path.join(temp, "native.jxa");

function invoke(mode, ...args) {
    const result = spawnSync("/usr/bin/osascript", ["-l", "JavaScript", script, mode, temp, ...args], { encoding: "utf8", timeout: 60000 });

    if (result.error || result.status !== 0) {
        throw new Error(`Native ${mode} failed: ${result.stderr}${result.stdout}`);
    }

    return JSON.parse(result.stdout.trim());
}

// Both questions shown by Standard Additions as the artifact asks them.
function dialogCheck() {
    const shown = invoke("dialogs");

    for (const [question, refusal] of Object.entries(shown)) {
        if (refusal !== "The location dialog returned an invalid answer.") {
            throw new Error(`The ${question} question was not shown as asked: ${refusal}`);
        }
    }

    console.log("PASS: both questions shown by Standard Additions with the options the artifact passes.");

    return shown;
}

async function terminalCheck() {
    // A real Terminal window, opened at a name built to break a shell command,
    // and its shell's working directory read from the kernel.
    const hostile = path.join(temp, "cwd ' $HOME `x`; & \u{1F600}");

    await mkdir(hostile);
    invoke("terminal", hostile);

    const shell = await shellAt(hostile, 15000);

    if (shell === null) {
        throw new Error(`No shell reached ${JSON.stringify(hostile)} within 15 seconds.`);
    }

    // The window is this test's own: ending its shell closes it.
    process.kill(shell, "SIGHUP");
    console.log(`PASS: Terminal's shell (pid ${shell}) is at the hostile path exactly.`);
}

try {
    const production = await read(`dist/${artifactName}`);

    await writeFile(script, `${production}\n${await read("tests/integration/native-modes.jxa")}\n` +
        `${await read("tests/integration/native-body.jxa")}`);
    await prepareFixtures(temp);

    const compiled = spawnSync("/usr/bin/osacompile", ["-l", "JavaScript", "-o", path.join(temp, "production.scpt"),
        path.join(root, "dist", artifactName)], { encoding: "utf8", timeout: 30000 });

    if (compiled.error || compiled.status !== 0) {
        throw new Error(`Native compile failed: ${compiled.stderr}`);
    }

    const image = await aliasToEjectedVolume(temp, (target, name) => invoke("alias", target, name));
    const report = invoke("main");

    if (isAttached(image)) {
        throw new Error("Resolving an alias to an ejected volume mounted it again.");
    }

    console.log(JSON.stringify(report, null, 2));
    report.architecture = process.arch;
    report.supervisor = checkSupervisor(invoke, execFileSync);
    report.presentation = checkPresentation(invoke);

    if (flag("--dialogs")) {
        report.dialogs = dialogCheck();
    }

    if (flag("--terminal")) {
        await terminalCheck();
    }

    // Shortcuts' own input delivery, through the harness shortcuts.
    const shortcuts = flag("--shortcuts") ? await throughShortcuts(temp, production) : null;
    await mkdir(path.join(root, "reports"), { recursive: true });
    await writeFile(path.join(root, "reports", "native-macos.json"),
        `${JSON.stringify({ ...report, terminalRequest: flag("--terminal"), shortcuts }, null, 2)}\n`);
} finally {
    await releaseFixtures(temp);
    await rm(temp, { recursive: true, force: true });
}
