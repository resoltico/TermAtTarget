"use strict";

/*
 * One run, in order: read the selection, decide, check, launch. What happens
 * when a step is refused or cancelled is in workflow-failures.test.cjs.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { execute } = require("../../../src/core/workflow.js");
const { fixture, calls, DEFAULTS } = require("../../helpers.cjs");

// The shape Shortcuts actually hands run(): the selection, then its options.
const envelope = (items) => [items, { source: "", "temporary items path": "/tmp", ignoresInput: false }];

test("a run decides, validates, and launches once", () => {
    const io = fixture();

    assert.deepEqual(execute(["/work"], DEFAULTS, io), []);
    assert.deepEqual(calls(io), ["path", "inspect", "chooseFolderMode", "validate", "launch"]);
});

test("the folder launched is the folder decided and validated", () => {
    const io = fixture({}, { chooseFolderMode: () => "LEVEL" });

    execute(["/work"], DEFAULTS, io);
    assert.deepEqual(io.events.filter(([name]) => name === "validate" || name === "launch"), [
        ["validate", "/"],
        ["launch", "/"]
    ]);
});

test("a run with no input chooses a folder and opens inside it", () => {
    const io = fixture();

    execute([], DEFAULTS, io);
    assert.deepEqual(calls(io), ["chooseFolder", "path", "validate", "launch"]);
});

test("the configuration is validated before anything else happens", () => {
    const io = fixture();

    assert.throws(() => execute([], {}, io), /^Error: Configuration must contain only/u);
    assert.equal(io.events.length, 0);
});

test("more than one item is refused before anything is asked", () => {
    const io = fixture();

    assert.throws(() => execute(["/a", "/b"], DEFAULTS, io), /one selected item at a time/u);
    assert.equal(io.events.length, 0);
});

test("the selection is read through the host, one item at a time", () => {
    const seen = [];
    const io = fixture({}, {
        pathOf(value) {
            seen.push(value);
            return value.path;
        }
    });

    execute([{ path: "/work" }], DEFAULTS, io);
    assert.deepEqual(seen, [{ path: "/work" }]);
});

test("a single item from Shortcuts opens, whatever it is wrapped in", () => {
    const io = fixture({ "/work/file.txt": { kind: "file" } });

    assert.deepEqual(execute(envelope(["/work/file.txt"]), DEFAULTS, io), []);
    assert.deepEqual(io.events.filter(([name]) => name === "launch"), [["launch", "/work"]]);
});

test("two items from Shortcuts are refused as two, not as a list and its options", () => {
    const io = fixture();

    assert.throws(() => execute(envelope(["/a", "/b"]), DEFAULTS, io), /one selected item at a time/u);
    assert.equal(io.events.length, 0);
});

test("an empty selection from Shortcuts chooses a folder", () => {
    const io = fixture();

    execute(envelope([]), DEFAULTS, io);
    assert.deepEqual(calls(io)[0], "chooseFolder");
});

test("runs are independent: each makes its own request", () => {
    // Nothing is shared between runs, so two in a row both open.
    const io = fixture();

    execute(["/work"], DEFAULTS, io);
    execute(["/work"], DEFAULTS, io);
    assert.equal(calls(io).filter((name) => name === "launch").length, 2);
});
