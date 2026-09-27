"use strict";

/*
 * What happens to a helper that is not finished when the run stops waiting --
 * at the deadline, or because watching it failed. Once launched, the request
 * may already have reached its target, so nothing thrown afterwards escapes.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { supervise, DEADLINE_SECONDS, STOP_GRACE_SECONDS } = require("../../../src/runtime/supervise.js");
const { fakeTask, eventsNamed } = require("./fake-task.cjs");

const COMMAND = { executable: "/usr/bin/tool", arguments: [], failure: "Cannot run", subject: "/where" };
const run = (options) => {
    const fake = fakeTask(options);

    return { ...fake, outcome: supervise(fake.bridge, fake.files, COMMAND) };
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

    assert.deepEqual(outcome, { finished: false, lost: null, stopped: false, pid: 4242, cleanup: ["terminate failed"] });
});

test("a failure watching the helper abandons it rather than escaping", () => {
    for (const call of ["sleep", "clock", "running"]) {
        const { events, outcome } = run({ runsFor: Infinity, failsAt: { [call]: 3 } });

        assert.equal(outcome.finished, false, call);
        assert.equal(outcome.lost, `${call} failed`, call);
        assert.deepEqual(eventsNamed(events, "terminate"), ["terminate"], `${call}: it was still told to stop`);
    }
});

test("a sleep that fails is kept as the reason, and the helper still seen to stop", () => {
    const { outcome } = run({ runsFor: Infinity, failsAt: { sleep: 3 } });

    assert.deepEqual(outcome, { finished: false, lost: "sleep failed", stopped: true, pid: 4242, cleanup: [] });
});

test("a clock that fails during the grace ends the watch, recorded, and nothing loops", () => {
    const { outcome } = run({ runsFor: Infinity, termTakes: Infinity, failsAt: { clock: DEADLINE_SECONDS + 0.5 } });

    assert.deepEqual(outcome, { finished: false, lost: null, stopped: false, pid: 4242, cleanup: ["clock failed"] });
});

test("a status that cannot be read after the helper ended is a lost observation, not an escape", () => {
    const { outcome } = run({ runsFor: 0.1, failsAt: { status: 0 } });

    assert.deepEqual(outcome, { finished: false, lost: "status failed", stopped: true, pid: 4242, cleanup: [] });
});

test("a pid that cannot be read is left out, and nothing else is lost", () => {
    const { outcome } = run({ runsFor: Infinity, termTakes: Infinity, failsAt: { pid: 0 } });

    assert.deepEqual(outcome, { finished: false, lost: null, stopped: false, pid: null, cleanup: ["pid failed"] });
});
