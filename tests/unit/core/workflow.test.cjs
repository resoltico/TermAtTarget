"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { assertRefused } = require("../../outcome-checks.cjs");
const { execute } = require("../../../src/core/workflow.js");
const { fixture, hostFor, calls, asked } = require("../../helpers.cjs");
const { cancelled } = require("../../../src/core/outcomes.js");

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

/*
 * A run given nothing: it asks whether to choose a folder or change the
 * settings, and can always reach the settings -- even when a saved one is not
 * recognised, since that is how it is fixed.
 */

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

/*
 * Every way a run can stop short: cancelled by the person, or failing at a
 * step. A cancel is quiet; a failure is thrown as itself, whatever it is.
 */

function userCancelled() {
    throw cancelled();
}

test("a cancel at any question returns quietly and launches nothing", () => {
    const stages = [
        [[], {}, "ask"],
        [[], {}, "chooseFolder"],
        [["/work"], {}, "ask"],
        [["/a"], { "/a": { kind: "alias" } }, "ask"]
    ];

    for (const [input, entries, stage] of stages) {
        const io = fixture(entries, { [stage]: userCancelled });

        assert.deepEqual(execute(input, hostFor(io)), { kind: "cancelled" }, stage);
        assert.equal(calls(io).includes("launch"), false, stage);
    }
});

test("a cancel in the settings returns quietly too", () => {
    const io = fixture({}, { ask: () => "settings", pickSetting: userCancelled });

    assert.deepEqual(execute([], hostFor(io)), { kind: "cancelled" });
});

test("a failure at any step is thrown as itself, and nothing after it runs", () => {
    for (const stage of ["load", "isInstalled", "inspect", "resolveAlias", "validateDirectory", "launch"]) {
        const failure = new Error(stage);
        const io = fixture({ "/a": { kind: "alias", target: "/work" } }, {
            [stage]() {
                throw failure;
            }
        });

        assert.throws(() => execute(["/a"], hostFor(io)), (error) => error === failure, stage);
    }
});

test("a failed validation launches nothing", () => {
    const io = fixture({}, {
        validateDirectory() {
            throw new Error("gone");
        }
    });

    assert.throws(() => execute(["/work"], hostFor(io)), /^Error: gone$/u);
    assert.equal(calls(io).includes("launch"), false);
});

test("anything thrown is a failure, including values that are falsy", () => {
    for (const failure of [null, false, 0, undefined, "", "native text"]) {
        const io = fixture({}, {
            inspect() {
                throw failure;
            }
        });
        const thrown = [];

        try {
            execute(["/work"], hostFor(io));
        } catch (error) {
            thrown.push(error);
        }

        assert.deepEqual(thrown, [failure], String(failure));
    }
});

test("a thrown object that only resembles a cancellation is a failure", () => {
    // Standard Additions' own number is the runtime's to translate, not the core's.
    for (const failure of [{ errorNumber: -128 }, Object.assign(new Error("User canceled."), { errorNumber: -128 })]) {
        const io = fixture({}, {
            inspect() {
                throw failure;
            }
        });

        assert.throws(() => execute(["/work"], hostFor(io)), (error) => error === failure);
    }
});

/*
 * An app that expands environment variables in the folder it is given is
 * never given a folder whose path holds a "$": it would open somewhere else.
 */

const DOLLAR = "/work/dollar $HOME";

test("kitty is refused a folder with a \"$\" in its path, after it is checked and before it is opened", () => {
    const io = fixture({ [DOLLAR]: { kind: "directory" } }, {}, { terminal: "kitty", folder: "inside" });

    assertRefused(execute([DOLLAR], hostFor(io)), "terminalReadsVariables", { terminal: "kitty", path: DOLLAR, parentUsable: true });
    assert.deepEqual(calls(io).slice(-2), ["inspect", "validate"]);
});

test("when the parent has a \"$\" too, kitty is only pointed at another app", () => {
    const deep = "/w$x/inner";
    const io = fixture({ "/w$x": { kind: "directory" }, [deep]: { kind: "directory" } }, {}, { terminal: "kitty", folder: "inside" });

    assertRefused(execute([deep], hostFor(io)), "terminalReadsVariables", { terminal: "kitty", path: deep, parentUsable: false });
});

test("kitty opens any other folder", () => {
    const io = fixture({}, {}, { terminal: "kitty", folder: "inside" });

    execute(["/work"], hostFor(io));
    assert.deepEqual(io.events.at(-1), ["launch", "/work", "kitty"]);
});

test("an app that reads no variables is given a \"$\" as a name", () => {
    for (const terminal of ["terminal", "ghostty", "iterm2"]) {
        const io = fixture({ [DOLLAR]: { kind: "directory" } }, {}, { terminal, folder: "inside" });

        execute([DOLLAR], hostFor(io));
        assert.deepEqual(io.events.at(-1), ["launch", DOLLAR, terminal], terminal);
    }
});
