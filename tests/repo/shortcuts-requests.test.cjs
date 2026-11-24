"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { spawnSync } = require("node:child_process");
const { access, mkdtemp, readFile, writeFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");

const moduleName = "../../tests/integration/shortcuts/request.mjs";
const load = () => import(moduleName);
const requestFile = (directory) => path.join(directory, "request");
const observationFile = (directory) => path.join(directory, "last-input.json");

async function inStage(run) {
    const directory = await mkdtemp(path.join(tmpdir(), "termattarget-request-"));

    try {
        await run(directory);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

test("a verified request clears the stale observation and releases the lease", () => inStage(async (directory) => {
    const { invokeRequest, requireIdle } = await load();
    await writeFile(observationFile(directory), JSON.stringify({ request: "stale" }));

    const result = await invokeRequest(directory, async () => {
        await assert.rejects(() => access(observationFile(directory)), { code: "ENOENT" });
        await assert.rejects(() => invokeRequest(directory, () => assert.fail("overlapping request")), { code: "EEXIST" });
        const request = await readFile(requestFile(directory), "utf8");

        await writeFile(observationFile(directory), JSON.stringify({ request }));
        return { status: 0 };
    });

    assert.equal(result.status, 0);
    await requireIdle(directory);
    await assert.rejects(() => access(requestFile(directory)), { code: "ENOENT" });
}));

test("mismatched evidence or an unconfirmed timed-out CLI quarantines the lease", async () => {
    const { invokeRequest, requireIdle } = await load();
    const timedOut = () => {
        const child = spawnSync(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { timeout: 100 });

        assert.equal(child.error?.code, "ETIMEDOUT");
        throw child.error;
    };
    const wrong = (directory) => writeFile(observationFile(directory), JSON.stringify({ request: "late" }));

    await Promise.all([timedOut, wrong].map((simulate) => inStage(async (directory) => {
        await assert.rejects(() => invokeRequest(directory, () => simulate(directory)));
        await assert.rejects(() => access(requestFile(directory)), { code: "ENOENT" });
        await writeFile(observationFile(directory), JSON.stringify({ request: "a late loader" }));
        await assert.rejects(() => requireIdle(directory), /without a verified loader result/u);
        await assert.rejects(() => invokeRequest(directory, () => assert.fail("quarantined request")), { code: "EEXIST" });
    })));
});

test("a killed controller cannot lend its lease to a new request", () => inStage(async (directory) => {
    const { invokeRequest } = await load();
    const helper = require.resolve(moduleName);
    const script = "const { invokeRequest } = await import(process.argv[1]);" +
        "await invokeRequest(process.argv[2], () => process.kill(process.pid, 'SIGKILL'));";
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", script, helper, directory]);

    assert.equal(child.signal, "SIGKILL");
    await assert.rejects(() => invokeRequest(directory, () => assert.fail("interrupted request")), { code: "EEXIST" });
    await rm(path.join(directory, "request-lease"), { recursive: true });
    const recovered = await invokeRequest(directory, async () => {
        const request = await readFile(requestFile(directory), "utf8");

        await writeFile(observationFile(directory), JSON.stringify({ request }));
        return { status: 0 };
    });
    assert.equal(recovered.status, 0);
}));

test("an unsuccessful child aborts the alert watcher and waits for it to settle", async () => {
    const { EventEmitter, once } = require("node:events");
    const { observeRefusal } = await import("../../tests/integration/shortcuts/alert.mjs");
    const failure = new Error("the child could not start");
    const child = new EventEmitter();
    let settled = false;

    child.kill = () => assert.fail("the missing child cannot be killed");
    const result = observeRefusal(child, async (signal) => {
        await once(signal, "abort");
        settled = true;
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });
    child.emit("error", failure);

    await assert.rejects(result, (error) => error === failure);
    assert.equal(settled, true);
});

test("a successful exit lets the in-flight alert check return evidence", async () => {
    const { EventEmitter } = require("node:events");
    const { observeRefusal } = await import("../../tests/integration/shortcuts/alert.mjs");
    const child = new EventEmitter();
    const result = observeRefusal(child, async (signal) => {
        await Promise.resolve();
        assert.equal(signal.aborted, false);
        return "expected message";
    });
    child.emit("exit", 0);

    assert.deepEqual(await result, { status: 0, alert: "expected message" });
});
