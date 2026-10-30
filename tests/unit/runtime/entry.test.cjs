"use strict";

/*
 * The artifact's entry: a run hands the workflow what was selected and a
 * host made for that run.
 *
 * entry.js is three lines of glue, so the host it would build is substituted
 * in Node's module cache rather than faking a whole Mac underneath it.
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
            return ["done"];
        }
    }, (entry) => entry.run(["/input"]));

    assert.deepEqual(answer, ["done"]);
    assert.deepEqual(received, [[["/input"], madeHost]]);
    assert.equal(received[0][1], madeHost);
});

test("a failed run is told in the host's alert, and then ends quietly", () => {
    const failure = new Error("refused");
    const reported = [];
    const answer = withStandIns({
        createMacHost: () => ({ report: (error) => reported.push(error) }),
        execute() {
            throw failure;
        }
    }, (entry) => entry.run(["/input"]));

    assert.deepEqual(answer, []);
    assert.deepEqual(reported, [failure]);
});

test("a failure the alert cannot tell is thrown as itself, for Shortcuts to show", () => {
    const failure = new Error("refused");

    assert.throws(() => withStandIns({
        createMacHost: () => ({
            report() {
                throw new Error("no alert");
            }
        }),
        execute() {
            throw failure;
        }
    }, (entry) => entry.run(["/input"])), (error) => error === failure);
});

test("the pieces a native harness needs are exported with it", () => {
    withStandIns({ createMacHost: () => ({}), execute: () => [] }, (entry) => {
        assert.deepEqual(Object.keys(entry).sort(), ["createMacHost", "execute", "forNativeTests", "run"]);
        assert.equal(typeof entry.createMacHost, "function");
        assert.equal(typeof entry.execute, "function");
        assert.deepEqual(Object.keys(entry.forNativeTests).sort(),
            ["createFailureReport", "createFoundation", "createPreferences", "createQuestions", "presentName", "supervise"]);
        assert.equal(entry.forNativeTests.supervise, require("../../../src/runtime/supervise.js").supervise);
    });
});
