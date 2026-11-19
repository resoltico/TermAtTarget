"use strict";

/*
 * One run, in order: read the selection and the settings, decide, check,
 * launch. What happens when a step is refused or cancelled is in
 * workflow-failures.test.cjs; a run given nothing is in workflow-start.test.cjs.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { assertRefused } = require("../../outcome-checks.cjs");
const { execute } = require("../../../src/core/workflow.js");
const { fixture, hostFor, calls, asked } = require("../../helpers.cjs");

test("a run reads the settings, decides, validates, and launches once", () => {
    const io = fixture();

    assert.deepEqual(execute(["/work"], hostFor(io)), { kind: "opened", terminal: "terminal", path: "/work" });
    assert.deepEqual(calls(io), ["path", "load", "installed", "inspect", "ask:folder", "validate", "launch"]);
});

test("the folder launched is the folder decided and validated, in the saved terminal app", () => {
    const io = fixture({}, {
        ask({ params }) {
            assert.equal(params.terminal, "Ghostty", "the question names the saved app");
            return "parent";
        }
    }, { terminal: "ghostty" });
    const host = hostFor(io);

    execute(["/work"], host);
    assert.deepEqual(io.events.filter(([name]) => ["installed", "validate", "launch"].includes(name)), [
        ["installed", "ghostty"],
        ["validate", "/"],
        ["launch", "/", "ghostty"]
    ]);
});

test("with nothing saved, Terminal is the app and every folder is asked about", () => {
    const io = fixture();
    const host = hostFor(io);

    execute(["/work"], host);
    assert.deepEqual(io.events.at(-1), ["launch", "/work", "terminal"]);
    assert.deepEqual(asked(io, "folder").map(({ params }) => params.terminal), ["Terminal"]);
});

test("saved settings decide without asking", () => {
    const io = fixture({ "/work/a": { kind: "alias", target: "/work" } }, {}, { folder: "parent", link: "follow" });

    execute(["/work/a"], hostFor(io));
    assert.equal(calls(io).some((name) => name.startsWith("ask:")), false);
    assert.deepEqual(io.events.at(-1), ["launch", "/", "terminal"]);
});

test("a saved setting that is not recognised stops the run before anything is asked", () => {
    const io = fixture({}, {}, { folder: "LEVEL" });

    assertRefused(execute(["/work"], hostFor(io)), "settingUnrecognised", { setting: "folder", saved: "LEVEL" });
    assert.deepEqual(calls(io), ["path", "load"]);
});

test("a terminal app that is not installed stops the run before anything is asked", () => {
    const io = fixture({}, { isInstalled: () => false }, { terminal: "ghostty" });

    assertRefused(execute(["/work"], hostFor(io)), "terminalMissing", { terminal: "ghostty" });
    assert.deepEqual(calls(io), ["path", "load"]);
});

test("more than one item is refused before anything is read or asked", () => {
    const io = fixture();

    assertRefused(execute(["/a", "/b"], hostFor(io)), "multipleSelection", {});
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

test("runs are independent: each makes its own request", () => {
    const io = fixture();

    execute(["/work"], hostFor(io));
    execute(["/work"], hostFor(io));
    assert.equal(calls(io).filter((name) => name === "launch").length, 2);
});
