"use strict";

/*
 * One run, in order: read the selection and the settings, decide, check,
 * launch. What happens when a step is refused or cancelled is in
 * workflow-failures.test.cjs; a run given nothing is in workflow-start.test.cjs.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { execute } = require("../../../src/core/workflow.js");
const { fixture, hostFor, calls } = require("../../helpers.cjs");

// The shape Shortcuts actually hands run(): the selection, then its options.
const envelope = (items) => [items, { source: "", "temporary items path": "/tmp", ignoresInput: false }];

test("a run reads the settings, decides, validates, and launches once", () => {
    const io = fixture();

    assert.deepEqual(execute(["/work"], hostFor(io)), []);
    assert.deepEqual(calls(io), ["path", "load", "installed", "inspect", "chooseFolderMode", "validate", "launch"]);
});

test("the folder launched is the folder decided and validated, in the saved terminal app", () => {
    const io = fixture({}, { chooseFolderMode: () => "parent" }, { terminal: "ghostty" });
    const host = hostFor(io);

    execute(["/work"], host);
    assert.deepEqual(io.events.filter(([name]) => ["installed", "validate", "launch"].includes(name)), [
        ["installed", "ghostty"],
        ["validate", "/"],
        ["launch", "/", "ghostty"]
    ]);
    assert.deepEqual(io.namedFor, ["Ghostty"], "the questions name the app");
});

test("with nothing saved, Terminal is the app and every folder is asked about", () => {
    const io = fixture();
    const host = hostFor(io);

    execute(["/work"], host);
    assert.deepEqual(io.events.at(-1), ["launch", "/work", "terminal"]);
    assert.deepEqual(io.namedFor, ["Terminal"]);
});

test("saved settings decide without asking", () => {
    const io = fixture({ "/work/a": { kind: "alias", target: "/work" } }, {}, { folder: "parent", link: "follow" });

    execute(["/work/a"], hostFor(io));
    assert.equal(calls(io).some((name) => name.startsWith("choose")), false);
    assert.deepEqual(io.events.at(-1), ["launch", "/", "terminal"]);
});

test("a saved setting that is not recognised stops the run before anything is asked", () => {
    const io = fixture({}, {}, { folder: "LEVEL" });

    assert.throws(() => execute(["/work"], hostFor(io)), /^Error: The saved folder setting, "LEVEL", is not one of/u);
    assert.deepEqual(calls(io), ["path", "load"]);
});

test("a terminal app that is not installed stops the run before anything is asked", () => {
    const io = fixture({}, { isInstalled: () => false }, { terminal: "ghostty" });

    assert.throws(() => execute(["/work"], hostFor(io)), (error) => {
        assert.equal(error.message, "Ghostty is the terminal app in Term At Target's settings, but macOS cannot find it. " +
            "Install it, or choose another app. Run Term At Target with nothing selected to change its settings. " +
            "If you've just installed it, open it once from Applications, then try again.");
        assert.equal(error.summary, "Ghostty isn't installed");

        return true;
    });
    assert.deepEqual(calls(io), ["path", "load"]);
});

test("more than one item is refused before anything is read or asked", () => {
    const io = fixture();

    assert.throws(() => execute(["/a", "/b"], hostFor(io)), (error) => {
        assert.match(error.message, /one selected item at a time/u);
        assert.equal(error.summary, "Select one item at a time");

        return true;
    });
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

    execute([{ path: "/work" }], hostFor(io));
    assert.deepEqual(seen, [{ path: "/work" }]);
});

test("a single item from Shortcuts opens, whatever it is wrapped in", () => {
    const io = fixture({ "/work/file.txt": { kind: "file" } });

    assert.deepEqual(execute(envelope(["/work/file.txt"]), hostFor(io)), []);
    assert.deepEqual(io.events.filter(([name]) => name === "launch"), [["launch", "/work", "terminal"]]);
});

test("two items from Shortcuts are refused as two, not as a list and its options", () => {
    const io = fixture();

    assert.throws(() => execute(envelope(["/a", "/b"]), hostFor(io)), /one selected item at a time/u);
    assert.equal(io.events.length, 0);
});

test("runs are independent: each makes its own request", () => {
    const io = fixture();

    execute(["/work"], hostFor(io));
    execute(["/work"], hostFor(io));
    assert.equal(calls(io).filter((name) => name === "launch").length, 2);
});
