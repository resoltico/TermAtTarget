"use strict";

/*
 * One helper process, run to its end or to a deadline measured on a clock,
 * and at the deadline stopped -- or reported as not stopped.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { supervise, DEADLINE_SECONDS, STOP_GRACE_SECONDS } = require("../../../src/runtime/supervise.js");
const { fakeTask, eventsNamed } = require("./fake-task.cjs");

const COMMAND = { executable: "/usr/bin/tool", arguments: ["a b", "$x"], failure: "Cannot run", subject: "/where" };

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

    assert.throws(() => supervise(bridge, files, COMMAND), /^Error: Cannot run:\/where:native-error$/u);
    assert.deepEqual(events, ["launch"]);
});
