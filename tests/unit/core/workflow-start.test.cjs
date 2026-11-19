"use strict";

/*
 * A run given nothing: it asks whether to choose a folder or change the
 * settings, and can always reach the settings -- even when a saved one is not
 * recognised, since that is how it is fixed.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { execute } = require("../../../src/core/workflow.js");
const { fixture, hostFor, calls, asked } = require("../../helpers.cjs");

test("choosing a folder opens inside it, whatever folders are set to", () => {
    const io = fixture({}, {}, { folder: "parent" });

    assert.deepEqual(execute([], hostFor(io)), { kind: "opened", terminal: "terminal", path: "/work" });
    assert.deepEqual(calls(io), ["load", "installed", "ask:start", "installed", "chooseFolder", "path", "validate", "launch"]);
    assert.equal(asked(io, "start")[0].params.reason, "ready");
    assert.deepEqual(io.events.at(-1), ["launch", "/work", "terminal"]);
});

test("the first question names the saved app, or none when it is not recognised", () => {
    const named = (saved) => {
        const io = fixture({}, {}, saved);
        const host = hostFor(io);

        execute([], host);
        return asked(io, "start").map(({ params }) => params.terminal);
    };

    assert.deepEqual(named({}), ["Terminal"]);
    assert.deepEqual(named({ terminal: "ghostty" }), ["Ghostty"]);
    assert.deepEqual(named({ terminal: "xterm" }), [null]);
});

test("the settings open instead of a folder, and end the run when done", () => {
    const io = fixture({}, { ask: () => "settings" });

    assert.deepEqual(execute([], hostFor(io)), { kind: "settingsClosed" });
    assert.deepEqual(calls(io).filter((name) => name !== "installed"), ["load", "pickSetting"]);
});

test("the settings open even when a saved setting is not recognised", () => {
    const io = fixture({}, { ask: () => "settings" }, { folder: "LEVEL", link: 3 });

    execute([], hostFor(io));
    assert.deepEqual(io.events.at(-1)[1].map((row) => row.value), ["terminal", null, null]);
});

test("an unrecognised setting is said first, and only the settings are offered", () => {
    const io = fixture({}, {}, { link: "TARGET" });

    execute([], hostFor(io));
    assert.equal(asked(io, "start")[0].params.reason, "unrecognised");
    assert.deepEqual(asked(io, "start")[0].answers, ["settings"]);
    assert.equal(calls(io).includes("installed"), true, "the settings list still asks what is installed");
});

test("a chosen app that is not installed is said first, and only the settings are offered", () => {
    const io = fixture({}, { isInstalled: () => false }, { terminal: "ghostty" });

    execute([], hostFor(io));
    assert.equal(asked(io, "start")[0].params.reason, "missing");
    assert.deepEqual(asked(io, "start")[0].answers, ["settings"]);
});

test("choosing a folder is no answer when the settings cannot open one", () => {
    for (const [saved, isInstalled] of [[{ link: "TARGET" }, () => true], [{ terminal: "ghostty" }, () => false]]) {
        const io = fixture({}, { isInstalled, ask: () => "choose" }, saved);

        assert.throws(() => execute([], hostFor(io)), { kind: "invalidAnswer", params: { question: "start" } });
        assert.equal(calls(io).includes("chooseFolder"), false);
    }
});

test("an answer to the first question that is neither is refused", () => {
    const io = fixture({}, { ask: () => "maybe" });

    assert.throws(() => execute([], hostFor(io)), { kind: "invalidAnswer", params: { question: "start" } });
    assert.equal(calls(io).includes("launch"), false);
});
