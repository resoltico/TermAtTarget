/*
 * The supervisor against real processes: one that succeeds; one that fails;
 * one that exits while a child it started keeps writing to its stderr (which
 * held a pipe open for 20 s before the pipe was removed); one that never ends;
 * one that ignores SIGTERM, which must be reported as not stopped, with its
 * pid, and is then ended here; and one that cannot start.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { DEADLINE_SECONDS, STOP_GRACE_SECONDS } = require("../../src/runtime/supervise.js");
const QUICK_SECONDS = 2;

function aliveNow(pid, execFileSync) {
    try {
        execFileSync("/bin/ps", ["-p", String(pid)], { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

function assertFinished(result, name, status) {
    if (result[name].finished !== true || result[name].status !== status || result[name].seconds > QUICK_SECONDS) {
        throw new Error(`Supervisor ${name}: expected exit ${status} at once, got ${JSON.stringify(result[name])}`);
    }
}

// Stopped at the deadline, confirmed stopped, and gone.
function assertStopped(result, name, execFileSync, atMost) {
    const ran = result[name];

    if (ran.finished !== false || ran.stopped !== true || ran.cleanup.length > 0 || aliveNow(ran.pid, execFileSync) ||
        ran.seconds < DEADLINE_SECONDS || ran.seconds > atMost) {
        throw new Error(`Supervisor ${name}: expected stopped at the deadline, got ${JSON.stringify(ran)}`);
    }
}

// The lingering helper's child outlives it by design; end it if it has not ended already.
function endLingering(execFileSync) {
    try {
        execFileSync("/usr/bin/pkill", ["-f", "sleep 20"], { stdio: "ignore" });
    } catch {
        // pkill exits 1 when nothing matched: it had already finished.
    }
}

// Not signalled by pid: reported as still running, with the pid to end it by.
function assertReportedRunning(ran, execFileSync) {
    const alive = aliveNow(ran.pid, execFileSync);

    if (alive) {
        process.kill(ran.pid, "SIGKILL");
    }

    if (ran.finished !== false || ran.stopped !== false || ran.lost !== null || !alive ||
        ran.seconds < DEADLINE_SECONDS + STOP_GRACE_SECONDS || ran.seconds > DEADLINE_SECONDS + STOP_GRACE_SECONDS + 1) {
        throw new Error(`Supervisor stubborn: expected reported as running after the grace, got ${JSON.stringify(ran)}`);
    }
}

function assertRefused(result) {
    if (!/^Cannot run "/u.test(String(result.unstartable))) {
        throw new Error(`Supervisor: a file that cannot run was not refused: ${result.unstartable}`);
    }
}

export function checkSupervisor(invoke, execFileSync) {
    const result = invoke("supervise");

    assertFinished(result, "quiet", 0);
    assertFinished(result, "failing", 3);
    assertFinished(result, "lingering", 1);
    assertStopped(result, "flood", execFileSync, DEADLINE_SECONDS + STOP_GRACE_SECONDS + 1);
    assertReportedRunning(result.stubborn, execFileSync);

    assertRefused(result);
    endLingering(execFileSync);
    console.log("PASS: supervisor — success and failure at once, a helper whose child keeps its stderr at once, " +
        `an endless helper stopped at ${result.flood.seconds.toFixed(1)} s, one ignoring SIGTERM reported with its pid ` +
        `at ${result.stubborn.seconds.toFixed(1)} s, and a file that cannot run.`);

    return result;
}
