"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { supervise, DEADLINE_SECONDS, STOP_GRACE_SECONDS } = require("../../../src/runtime/supervise.js");
const { fakeTask, eventsNamed } = require("./fake-task.cjs");

/*
 * One helper process, run to its end or to a deadline measured on a clock,
 * and at the deadline stopped -- or reported as not stopped.
 */

const COMMAND = { executable: "/usr/bin/tool", arguments: ["a b", "$x"], operation: "test", subject: "/where" };

test("the command runs as given, and reads and writes nothing but the null device", () => {
    const { task, bridge, files } = fakeTask();

    supervise(bridge, files, COMMAND);
    assert.deepEqual(task.executableURL, { path: "/usr/bin/tool" });
    assert.deepEqual(task.arguments, ["a b", "$x"]);
    assert.deepEqual([task.standardInput, task.standardOutput, task.standardError], ["null-device", "null-device", "null-device"]);
});

test("a process that ends is waited for, and its status is what is kept", () => {
    const { events, bridge, files } = fakeTask({ runsFor: 0.12, status: "7" });

    assert.deepEqual(supervise(bridge, files, COMMAND), { finished: true, status: 7 });
    assert.deepEqual(eventsNamed(events, "sleep"), [["sleep", 0.05], ["sleep", 0.05], ["sleep", 0.05]]);
    assert.deepEqual(eventsNamed(events, "terminate"), []);
});

test("a process that has already ended is not waited for", () => {
    const { events, bridge, files } = fakeTask({ runsFor: 0 });

    supervise(bridge, files, COMMAND);
    assert.deepEqual(eventsNamed(events, "sleep"), []);
});

test("the deadline is ten seconds, and a second's grace for each signal", () => {
    assert.equal(DEADLINE_SECONDS, 10);
    assert.equal(STOP_GRACE_SECONDS, 1);
});

test("the deadline is elapsed time: sleeps that overshoot do not stretch it", () => {
    // Each sleep asked for 0.05 s takes 0.25 s. Counting sleeps would allow
    // 50 s; the clock ends the wait at 10.
    const { clock, bridge, files } = fakeTask({ runsFor: Infinity, sleepTakes: 0.25 });

    supervise(bridge, files, COMMAND);
    assert.ok(clock.now >= DEADLINE_SECONDS && clock.now < DEADLINE_SECONDS + 1, String(clock.now));
});

test("the last sleep before the deadline is shortened to meet it", () => {
    const { events, bridge, files } = fakeTask({ runsFor: Infinity });

    supervise(bridge, files, COMMAND);

    const sleeps = eventsNamed(events, "sleep").map(([, seconds]) => seconds);

    assert.ok(sleeps.every((seconds) => seconds > 0 && seconds <= 0.05));
});

test("a process that ends just before the deadline has finished", () => {
    const { bridge, files } = fakeTask({ runsFor: DEADLINE_SECONDS - 0.01 });

    assert.equal(supervise(bridge, files, COMMAND).finished, true);
});

test("the clock starts before launch, so launching counts against the deadline", () => {
    const { clock, bridge, files } = fakeTask({ runsFor: Infinity });
    const launched = bridge.ns.NSTask.alloc.init.launchAndReturnError;

    bridge.ns.NSTask.alloc.init.launchAndReturnError = (error) => {
        clock.now += 4;
        return launched(error);
    };
    supervise(bridge, files, COMMAND);
    assert.ok(clock.now < DEADLINE_SECONDS + 1, `the wait began at 4 s and still ended by 10: ${clock.now}`);
});

test("a process that could not start is reported with macOS's reason, and nothing else is done", () => {
    const { events, bridge, files } = fakeTask({ start: false });

    assert.throws(() => supervise(bridge, files, COMMAND), { kind: "native", params: { operation: "test", path: "/where", domain: "TestDomain", code: 1, description: "native-error" } });
    assert.deepEqual(events, ["launch"]);
});

/*
 * What happens to a helper that is not finished when the run stops waiting --
 * at the deadline, or because watching it failed. Once launched, the request
 * may already have reached its target, so nothing thrown afterwards escapes.
 */

const STOP_COMMAND = { executable: "/usr/bin/tool", arguments: [], operation: "test", subject: "/where" };
const run = (options) => {
    const fake = fakeTask(options);

    return { ...fake, outcome: supervise(fake.bridge, fake.files, STOP_COMMAND) };
};

test("at the deadline the helper is told to stop, and stops", () => {
    const { events, outcome } = run({ runsFor: Infinity });

    assert.deepEqual(outcome, { finished: false, lost: null, stopped: true, pid: 4242, cleanup: [] });
    assert.deepEqual(eventsNamed(events, "terminate"), ["terminate"]);
});

test("a helper that shuts down within the grace is reported stopped", () => {
    assert.equal(run({ runsFor: Infinity, termTakes: 0.5 }).outcome.stopped, true);
});

test("a helper that ignores SIGTERM is reported as not stopped, and is never signalled by pid", () => {
    // A pid read a moment ago may already name another process.
    const { events, outcome } = run({ runsFor: Infinity, termTakes: Infinity });

    assert.deepEqual(outcome, { finished: false, lost: null, stopped: false, pid: 4242, cleanup: [] });
    assert.deepEqual(eventsNamed(events, "kill"), []);
});

test("the grace is watched for a second, and no longer", () => {
    const { clock } = run({ runsFor: Infinity, termTakes: Infinity });

    assert.ok(clock.now >= DEADLINE_SECONDS + STOP_GRACE_SECONDS && clock.now < DEADLINE_SECONDS + STOP_GRACE_SECONDS + 0.1,
        String(clock.now));
});

test("a failing SIGTERM is kept as a cleanup failure, and the grace still watched", () => {
    const { outcome } = run({ runsFor: Infinity, terminateThrows: true });

    assert.deepEqual(outcome, { finished: false, lost: null, stopped: false, pid: 4242, cleanup: [new Error("terminate failed")] });
});

test("a failure watching the helper abandons it rather than escaping", () => {
    for (const call of ["sleep", "clock", "running"]) {
        const { events, outcome } = run({ runsFor: Infinity, failsAt: { [call]: 3 } });

        assert.equal(outcome.finished, false, call);
        assert.equal(outcome.lost.failure.message, `${call} failed`, call);
        assert.deepEqual(eventsNamed(events, "terminate"), ["terminate"], `${call}: it was still told to stop`);
    }
});

test("a sleep that fails is kept as the reason, and the helper still seen to stop", () => {
    const { outcome } = run({ runsFor: Infinity, failsAt: { sleep: 3 } });

    assert.deepEqual(outcome, { finished: false, lost: { failure: new Error("sleep failed") }, stopped: true, pid: 4242, cleanup: [] });
});

test("a clock that fails during the grace ends the watch, recorded, and nothing loops", () => {
    const { outcome } = run({ runsFor: Infinity, termTakes: Infinity, failsAt: { clock: DEADLINE_SECONDS + 0.5 } });

    assert.deepEqual(outcome, { finished: false, lost: null, stopped: false, pid: 4242, cleanup: [new Error("clock failed")] });
});

test("a status that cannot be read after the helper ended is a lost observation, not an escape", () => {
    const { outcome } = run({ runsFor: 0.1, failsAt: { status: 0 } });

    assert.deepEqual(outcome, { finished: false, lost: { failure: new Error("status failed") }, stopped: true, pid: 4242, cleanup: [] });
});

test("a pid that cannot be read is left out, and nothing else is lost", () => {
    const { outcome } = run({ runsFor: Infinity, termTakes: Infinity, failsAt: { pid: 0 } });

    assert.deepEqual(outcome, { finished: false, lost: null, stopped: false, pid: null, cleanup: [new Error("pid failed")] });
});
