"use strict";

/*
 * The real host, assembled from the JXA globals: every port the core asks
 * through, each wired to the adapter that gives it.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const { jxaWorld, withGlobals, freshly } = require("./fake-jxa.cjs");

const HOST = path.resolve(__dirname, "../../../src/runtime/host.js");

/*
 * The host reads $ when a call makes an out-parameter, not when it is
 * assembled, so everything a test does with it happens inside the world.
 */
function inWorld(action) {
    const world = jxaWorld();

    withGlobals(world.globals, () => action(freshly(HOST).createMacHost()));

    return world.seen;
}

test("Foundation and AppKit are imported, and the questions get Standard Additions", () => {
    const seen = inWorld(() => undefined);

    assert.deepEqual(seen.imports, ["Foundation", "AppKit"]);
    assert.equal(seen.app.includeStandardAdditions, true);
});

test("the host has every port the core asks through, each with what the core calls", () => {
    inWorld((host) => {
        assert.deepEqual(Object.keys(host), ["files", "preferences", "terminals", "questions", "settingsScreen", "report"]);
        assert.equal(typeof host.report, "function");

        const ports = {
            files: ["pathOf", "inspect", "resolveAlias", "readLink", "validateDirectory"],
            preferences: ["load", "save"],
            terminals: ["isInstalled", "launch"],
            questions: ["start", "chooseFolder", "chooseFolderMode", "chooseLink"],
            settingsScreen: ["pickSetting", "pickValue"]
        };
        const made = { ...host, questions: host.questions("Terminal") };

        for (const [port, names] of Object.entries(ports)) {
            for (const name of names) {
                assert.equal(typeof made[port][name], "function", `${port}.${name}`);
            }
        }
    });
});

test("the settings are read from the action's own preferences domain", () => {
    const seen = inWorld((host) => {
        assert.deepEqual(host.preferences.load(), { terminal: null, folder: null, link: null });
    });

    assert.deepEqual(seen.domains, ["com.resoltico.TermAtTarget"]);
});

test("an out-parameter is made with $(), never Ref()", () => {
    // Measured on macOS: an NSError read back out of a Ref() crashes osascript.
    const seen = inWorld((host) => {
        assert.throws(() => host.files.inspect("/nowhere"), /^Error: Cannot inspect "\/nowhere": /u);
    });

    assert.equal(seen.attributesError, seen.outParameters[0], "the error went to a $() placeholder");
});

test("each call makes its own out-parameter", () => {
    const seen = inWorld((host) => {
        assert.throws(() => host.files.inspect("/a"), /Cannot inspect/u);
        assert.throws(() => host.files.inspect("/b"), /Cannot inspect/u);
    });

    assert.equal(seen.outParameters.length, 2);
    assert.notEqual(seen.outParameters[0], seen.outParameters[1]);
});

test("a launch is timed on the Mac's uptime clock, and a refused launch says so", () => {
    // Uptime is monotonic: no change to the wall clock can move a deadline.
    const seen = inWorld((host) => {
        assert.throws(
            () => host.terminals.launch("terminal", "/work"),
            /^Error: Cannot launch Terminal at "\/work": macOS did not provide further details\.$/u
        );
    });

    assert.equal(seen.clockReads, 1, "the deadline was fixed before the launch");
});
