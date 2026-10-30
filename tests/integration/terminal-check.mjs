/*
 * A real window in each supported terminal app that is installed, opened by
 * the artifact's own launch at a folder named to break a shell command, and
 * the shell it starts found at that folder exactly by asking the kernel.
 */
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { shellAt } from "./terminal-cwd.mjs";

const require = createRequire(import.meta.url);
const { TERMINALS } = require("../../src/core/vocabulary.js");
const { TERMINAL_BUNDLES } = require("../../src/runtime/executables.js");

/*
 * A shell ended moments after it started makes iTerm2 warn that its profile's
 * command may be wrong (seen on macOS 27 with iTerm2 3.7.6), and the warning
 * blocks quitting it; a few seconds' life avoids that for every app.
 */
const SHELL_LIFE_MS = 5000;

const isRunning = (id) => spawnSync("/usr/bin/osascript",
    ["-e", `application id "${TERMINAL_BUNDLES[id]}" is running`], { encoding: "utf8" }).stdout.trim() === "true";
const quit = (id) => spawnSync("/usr/bin/osascript", ["-e", `tell application id "${TERMINAL_BUNDLES[id]}" to quit`]);

/*
 * A folder named to break a shell command. An app that expands variables is
 * never handed a "$" (src/core/vocabulary.js), so its name has every other
 * hostile character but that one.
 */
function hostileName(terminal) {
    return terminal.readsVariables
        ? `${terminal.id} cwd ' HOME \`x\`; & \u{1F600}`
        : `${terminal.id} cwd ' $HOME \`x\`; & \u{1F600}`;
}

// One window in the app with this id, its shell found at the folder, then ended.
async function opensAt(invoke, temp, id) {
    const hostile = path.join(temp, hostileName(TERMINALS.find((terminal) => terminal.id === id)));

    await mkdir(hostile);
    invoke("terminal", hostile, id);

    const shell = await shellAt(hostile, 15000);

    if (shell === null) {
        throw new Error(`No ${id} shell reached ${JSON.stringify(hostile)} within 15 seconds.`);
    }

    // The window is this test's own: ending its shell closes it.
    await sleep(SHELL_LIFE_MS);
    process.kill(shell, "SIGHUP");
    console.log(`PASS: ${id}'s shell (pid ${shell}) is at the hostile path exactly.`);
}

// Terminal ships with macOS, so it must be among the apps installed.
export async function checkTerminals(invoke, temp) {
    const installed = invoke("installed", JSON.stringify(TERMINALS.map((terminal) => terminal.id)));

    if (!installed.includes("terminal")) {
        throw new Error("Terminal is not reported installed.");
    }

    // An app this check started is quit again; one already running is left as it was.
    for (const id of installed) {
        const wasRunning = isRunning(id);

        await opensAt(invoke, temp, id);

        if (!wasRunning) {
            quit(id);
        }
    }

    return installed;
}
