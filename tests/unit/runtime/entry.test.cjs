"use strict";

/*
 * The artifact's entry: a run hands the workflow what was selected and a
 * host made for that run.
 *
 * Substitute the host and workflow in Node's module cache to exercise the
 * Shortcuts boundary directly.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const { freshly } = require("./fake-jxa.cjs");

const HOST = path.resolve(__dirname, "../../../src/runtime/host.js");
const ENTRY = path.resolve(__dirname, "../../../src/runtime/entry.js");

// The entry, loaded against a stand-in host and whatever workflow is cached.
function entryWith(standIns) {
    require.cache[HOST].exports = { createMacHost: standIns.createMacHost };
    delete require.cache[ENTRY];

    return require(ENTRY);
}

function withStandIns(standIns, action) {
    // Fresh first: it clears every cached source module, and the workflow
    // patched below must be the one the entry then loads.
    freshly(HOST);

    const workflow = require("../../../src/core/workflow.js");
    const realExecute = workflow.execute;

    workflow.execute = standIns.execute;

    try {
        return action(entryWith(standIns));
    } finally {
        workflow.execute = realExecute;
        delete require.cache[HOST];
        delete require.cache[ENTRY];
    }
}

test("a run hands the workflow its input and a new host", () => {
    const received = [];
    const madeHost = { made: true };
    const answer = withStandIns({
        createMacHost: () => madeHost,
        execute(...args) {
            received.push(args);
            return { kind: "opened" };
        }
    }, (entry) => entry.run([["/input"], { source: "", ignoresInput: false }]));

    assert.deepEqual(answer, []);
    assert.deepEqual(received, [[["/input"], madeHost]]);
    assert.equal(received[0][1], madeHost);
});

test("a refused or failed run is told in the host's alert, and then ends quietly", () => {
    const failure = new Error("failed");
    const refused = { kind: "refused", refusal: failure };

    for (const execute of [() => refused, () => { throw failure; }]) {
        const reported = [];
        const answer = withStandIns({
            createMacHost: () => ({ report: (error) => reported.push(error) }), execute
        }, (entry) => entry.run(["/input"]));

        assert.deepEqual(answer, []);
        assert.deepEqual(reported, [failure]);
    }
});

test("opened, cancelled and settingsClosed finish without an alert or Shortcuts output", () => {
    for (const outcome of [{ kind: "opened", terminal: "terminal", path: "/work" }, { kind: "cancelled" }, { kind: "settingsClosed" }]) {
        const answer = withStandIns({
            createMacHost: () => ({ report: () => assert.fail(`unexpected alert for ${outcome.kind}`) }),
            execute: () => outcome
        }, (entry) => entry.run([]));

        assert.deepEqual(answer, [], outcome.kind);
    }
});

test("a workflow outcome without a Shortcuts mapping is reported as a fault", () => {
    const reported = [];
    const answer = withStandIns({
        createMacHost: () => ({ report: (error) => reported.push(error) }),
        execute: () => ({ kind: "futureOutcome" })
    }, (entry) => entry.run([]));

    assert.deepEqual(answer, []);
    assert.deepEqual(reported, [new TypeError("Unrecognised workflow outcome: futureOutcome.")]);
});

test("an unfamiliar envelope is reported at the Shortcuts boundary", () => {
    const reported = [];
    const answer = withStandIns({
        createMacHost: () => ({ report: (error) => reported.push(error.message) }),
        execute: () => assert.fail("malformed envelope reached the core")
    }, (entry) => entry.run([[], null]));

    assert.deepEqual(answer, []);
    assert.deepEqual(reported, ["Shortcuts passed its input in a form this version does not recognise."]);
});

test("a failure the alert cannot tell is thrown as itself, for Shortcuts to show", () => {
    const failure = new Error("refused");

    for (const execute of [() => ({ kind: "refused", refusal: failure }), () => { throw failure; }]) {
        assert.throws(() => withStandIns({
            createMacHost: () => ({
                report() {
                    throw new Error("no alert");
                }
            }),
            execute
        }, (entry) => entry.run(["/input"])), (error) => error === failure);
    }
});

test("the production entry exports only run", () => {
    withStandIns({ createMacHost: () => ({}), execute: () => ({ kind: "cancelled" }) }, (entry) => {
        assert.deepEqual(Object.keys(entry), ["run"]);
    });
});
