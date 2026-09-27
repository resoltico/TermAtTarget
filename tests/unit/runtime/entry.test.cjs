"use strict";

/*
 * The artifact's entry: a run hands the workflow what was selected, the
 * embedded configuration, and a host made for that run.
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

test("a run hands the workflow its input, the embedded configuration and a new host", () => {
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
    assert.deepEqual(received, [[["/input"], require("#config"), madeHost]]);
    assert.equal(received[0][2], madeHost);
});

test("the pieces a native harness needs are exported with it", () => {
    withStandIns({ createMacHost: () => ({}), execute: () => [] }, (entry) => {
        assert.deepEqual(Object.keys(entry).sort(), ["createMacHost", "execute", "forNativeTests", "run"]);
        assert.equal(typeof entry.createMacHost, "function");
        assert.equal(typeof entry.execute, "function");
        assert.deepEqual(Object.keys(entry.forNativeTests).sort(), ["createDialogs", "createFoundation", "presentName", "supervise"]);
        assert.equal(entry.forNativeTests.supervise, require("../../../src/runtime/supervise.js").supervise);
    });
});
