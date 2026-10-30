"use strict";

/*
 * A run given nothing: it asks whether to choose a folder or change the
 * settings, and can always reach the settings -- even when a saved one is not
 * recognised, since that is how it is fixed.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { execute } = require("../../../src/core/workflow.js");
const { fixture, hostFor, calls } = require("../../helpers.cjs");

// A person who opens the settings, whatever the first question says.
const toSettings = { start: () => "settings" };
const envelope = (items) => [items, { source: "", "temporary items path": "/tmp", ignoresInput: false }];

test("choosing a folder opens inside it, whatever folders are set to", () => {
    const io = fixture({}, {}, { folder: "parent" });

    assert.deepEqual(execute([], hostFor(io)), []);
    assert.deepEqual(calls(io), ["load", "installed", "start", "installed", "chooseFolder", "path", "validate", "launch"]);
    assert.deepEqual(io.events.find(([name]) => name === "start"), ["start", "ready"]);
    assert.deepEqual(io.events.at(-1), ["launch", "/work", "terminal"]);
});

test("an empty selection from Shortcuts is the same as nothing", () => {
    const io = fixture();

    execute(envelope([]), hostFor(io));
    assert.deepEqual(calls(io).slice(0, 3), ["load", "installed", "start"]);
});

test("the first question names the saved app, or none when it is not recognised", () => {
    const named = (saved) => {
        const io = fixture({}, { start: () => "settings" }, saved);
        const host = hostFor(io);

        execute([], host);
        return io.namedFor;
    };

    assert.deepEqual(named({}), ["Terminal"]);
    assert.deepEqual(named({ terminal: "ghostty" }), ["Ghostty"]);
    assert.deepEqual(named({ terminal: "xterm" }), [null]);
});

test("the settings open instead of a folder, and end the run when done", () => {
    const io = fixture({}, { start: () => "settings" });

    assert.deepEqual(execute([], hostFor(io)), []);
    assert.deepEqual(calls(io).filter((name) => name !== "installed"), ["load", "pickSetting"]);
});

test("the settings open even when a saved setting is not recognised", () => {
    const io = fixture({}, { start: () => "settings" }, { folder: "LEVEL", link: 3 });

    execute([], hostFor(io));
    assert.deepEqual(io.events.at(-1)[1].map((row) => row.value), ["terminal", null, null]);
});

test("an unrecognised setting is said first, and only the settings are offered", () => {
    const io = fixture({}, {}, { link: "TARGET" });

    io.start = (setup) => {
        io.events.push(["start", setup]);
        return toSettings.start();
    };
    execute([], hostFor(io));
    assert.deepEqual(io.events.find(([name]) => name === "start"), ["start", "unrecognised"]);
    assert.equal(calls(io).includes("installed"), true, "the settings list still asks what is installed");
});

test("a chosen app that is not installed is said first, and only the settings are offered", () => {
    const io = fixture({}, { isInstalled: () => false }, { terminal: "ghostty" });

    io.start = (setup) => {
        io.events.push(["start", setup]);
        return toSettings.start();
    };
    execute([], hostFor(io));
    assert.deepEqual(io.events.find(([name]) => name === "start"), ["start", "missing"]);
});

test("choosing a folder is no answer when the settings cannot open one", () => {
    for (const [saved, isInstalled] of [[{ link: "TARGET" }, () => true], [{ terminal: "ghostty" }, () => false]]) {
        const io = fixture({}, { isInstalled }, saved);

        assert.throws(() => execute([], hostFor(io)), /^Error: Invalid start choice\.$/u);
        assert.equal(calls(io).includes("chooseFolder"), false);
    }
});

test("an answer to the first question that is neither is refused", () => {
    const io = fixture({}, { start: () => "maybe" });

    assert.throws(() => execute([], hostFor(io)), /^Error: Invalid start choice\.$/u);
    assert.equal(calls(io).includes("launch"), false);
});
