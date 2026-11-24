/*
 * The test gives its refusal a unique title. System Events must see that
 * title and the expected message on the same window before pressing OK.
 */
import { execFile, execFileSync } from "node:child_process";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

const execute = promisify(execFile);
const POLL_INTERVAL = 250;
const PROBE_TIMEOUT = 5000;

export const MATCH_ALERT = `
on isQAAlert(texts, expectedTitle, expectedMessage)
    considering case
        return texts contains expectedTitle and texts contains expectedMessage
    end considering
end isQAAlert`;

const DISMISS_MATCH = `${MATCH_ALERT}
on run argv
    tell application "System Events"
        repeat with p in (every process whose name is "ShortcutsMacHelper")
            repeat with w in (every window of p)
                try
                    set texts to value of every static text of w
                    if my isQAAlert(texts, item 1 of argv, item 2 of argv) and (exists button "OK" of w) then
                        click button "OK" of w
                        return item 2 of argv
                    end if
                end try
            end repeat
        end repeat
    end tell
    return ""
end run`;

export async function dismissAlert({ title, message }, timeoutMs, signal) {
    const deadline = performance.now() + timeoutMs;

    while (!signal.aborted && performance.now() < deadline) {
        const { stdout } = await execute("/usr/bin/osascript", ["-e", DISMISS_MATCH, title, message],
            { signal, timeout: PROBE_TIMEOUT });

        if (stdout.trim() !== "") {
            return stdout.trim();
        }

        await sleep(POLL_INTERVAL, undefined, { signal });
    }

    return null;
}

async function watch(child, probe, controller) {
    try {
        const alert = await probe(controller.signal);

        if (alert === null && !controller.signal.aborted) {
            child.kill();
        }

        return alert;
    } catch (error) {
        if (controller.signal.aborted && error.name === "AbortError") {
            return null;
        }

        child.kill();
        throw error;
    }
}

async function childStatus(child, controller) {
    try {
        const [status] = await once(child, "exit");
        if (status !== 0) {
            controller.abort();
        }
        return status;
    } catch (error) {
        controller.abort();
        throw error;
    }
}

export async function observeRefusal(child, probe) {
    const controller = new AbortController();
    const exited = childStatus(child, controller);
    const [observed, exitedResult] = await Promise.allSettled([watch(child, probe, controller), exited]);

    if (exitedResult.status === "rejected") {
        throw exitedResult.reason;
    }

    if (observed.status === "rejected") {
        throw observed.reason;
    }

    return { status: exitedResult.value, alert: observed.value };
}

export function checkAlertMatching() {
    const expect = `on run argv
    set titleText to "Select one item at a time (QA current)"
    set messageText to "Expected refusal"
    if my isQAAlert({"Unrelated title", messageText}, titleText, messageText) then error "Unrelated alert matched"
    if my isQAAlert({"Select one item at a time (QA earlier)", messageText}, titleText, messageText) then error "Previous run matched"
    if my isQAAlert({titleText, "Wrong message"}, titleText, messageText) then error "Wrong body matched"
    if not my isQAAlert({messageText, titleText}, titleText, messageText) then error "Expected refusal did not match"
end run`;
    execFileSync("/usr/bin/osascript", ["-e", `${MATCH_ALERT}\n${expect}`]);
    console.log("PASS: the actual alert predicate rejects unrelated, stale and wrong-message windows.");
}
