"use strict";

/*
 * The real host, assembled from the JXA globals: every answer the planning
 * core asks for, each wired to the adapter that gives it.
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

test("Foundation is imported and dialogs get Standard Additions", () => {
    const seen = inWorld(() => undefined);

    assert.deepEqual(seen.imports.slice(0, 1), ["Foundation"]);
    assert.equal(seen.app.includeStandardAdditions, true);
});

test("the host answers every question the planning core asks, and holds no lock", () => {
    inWorld((host) => {
        assert.deepEqual(Object.keys(host).sort(), [
            "chooseFolder", "chooseFolderMode", "chooseLink", "inspect",
            "launch", "pathOf", "readLink", "resolveAlias", "validateDirectory"
        ]);

        for (const [name, value] of Object.entries(host)) {
            assert.equal(typeof value, "function", name);
        }
    });
});

test("an out-parameter is made with $(), never Ref()", () => {
    // Measured on macOS: an NSError read back out of a Ref() crashes osascript.
    const seen = inWorld((host) => {
        assert.throws(() => host.inspect("/nowhere"), /^Error: Cannot inspect "\/nowhere": /u);
    });

    assert.equal(seen.attributesError, seen.outParameters[0], "the error went to a $() placeholder");
});

test("each call makes its own out-parameter", () => {
    const seen = inWorld((host) => {
        assert.throws(() => host.inspect("/a"), /Cannot inspect/u);
        assert.throws(() => host.inspect("/b"), /Cannot inspect/u);
    });

    assert.equal(seen.outParameters.length, 2);
    assert.notEqual(seen.outParameters[0], seen.outParameters[1]);
});

test("a launch is timed on the Mac's uptime clock, and a refused launch says so", () => {
    // Uptime is monotonic: no change to the wall clock can move a deadline.
    const seen = inWorld((host) => {
        assert.throws(
            () => host.launch("/work"),
            /^Error: Cannot launch Terminal at "\/work": macOS did not provide further details\.$/u
        );
    });

    assert.equal(seen.clockReads, 1, "the deadline was fixed before the launch");
});
