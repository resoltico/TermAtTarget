"use strict";

/*
 * The four things every native adapter shares: telling nil from a value,
 * saying an NSError in words, the file manager, and a zero-argument method.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { isNil, fileManager, nativeFailure, perform } = require("../../../src/runtime/bridge.js");
const { fakeFoundation, box, nil, nativeError } = require("./fake-foundation.cjs");

test("null, undefined and a bridged nil are all nil", () => {
    assert.equal(isNil(null), true);
    assert.equal(isNil(undefined), true);
    assert.equal(isNil(nil), true);
});

test("a bridged value is not nil, whatever it holds", () => {
    assert.equal(isNil(box("")), false);
    assert.equal(isNil(box(0)), false);
});

test("the file manager is Foundation's shared one", () => {
    const { bridge } = fakeFoundation();

    assert.equal(fileManager(bridge), bridge.ns.NSFileManager.defaultManager);
});

test("a native failure says what failed, where, macOS's reason, and its domain and code", () => {
    const { bridge } = fakeFoundation();
    const error = nativeFailure(bridge, "Cannot read", "/a\nb", nativeError("No such file", "4"));

    assert.ok(error instanceof Error);
    assert.equal(error.message, "Cannot read \"/a\\nb\": No such file (NSCocoaErrorDomain 4)");
});

test("the domain and code are kept on the error, the code as a number", () => {
    // The bridge hands the code over as text (measured).
    const { bridge } = fakeFoundation();
    const error = nativeFailure(bridge, "Cannot read", "/x", nativeError("gone", "260"));

    assert.deepEqual(error.native, { operation: "Cannot read", path: "/x", domain: "NSCocoaErrorDomain", code: 260 });
});

test("without a reason from macOS, it says there was none", () => {
    const { bridge } = fakeFoundation();

    for (const error of [nil, null, undefined]) {
        const failure = nativeFailure(bridge, "Cannot read", "/", error);

        assert.equal(failure.message, "Cannot read \"/\": macOS did not provide further details.", String(error));
        assert.deepEqual(failure.native, { operation: "Cannot read", path: "/", domain: null, code: null });
    }
});

test("a zero-argument method is performed by reading it", () => {
    const performed = [];
    const target = {
        get waitUntilExit() {
            performed.push("waitUntilExit");
            return "result";
        }
    };

    assert.equal(perform(target, "waitUntilExit"), "result");
    assert.deepEqual(performed, ["waitUntilExit"]);
});
