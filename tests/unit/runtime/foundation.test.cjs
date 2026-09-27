"use strict";

/*
 * The adapter the rest of the runtime is handed: each Foundation question with
 * the bridge already supplied. Each entry must reach its own implementation
 * with the arguments it was given.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createFoundation } = require("../../../src/runtime/foundation.js");
const { isNil } = require("../../../src/runtime/bridge.js");
const { fakeFoundation, box, nativeError } = require("./fake-foundation.cjs");

test("each filesystem question is answered through the bridge it was made with", () => {
    const { bridge } = fakeFoundation();
    const files = createFoundation(bridge);

    assert.deepEqual(files.inspect("/App.app"), { kind: "directory" });
    assert.equal(files.resolveAlias("/alias"), "/folder");
    assert.equal(files.readLink("/symlink"), "file");
    assert.equal(files.pathOf(box("/given")), "/given");
    assert.doesNotThrow(() => files.validateDirectory("/folder"));
    assert.throws(() => files.validateDirectory("/file"), /no longer a directory/u);
});

test("the dialogs' and launcher's primitives are there too, bound the same way", () => {
    const { bridge } = fakeFoundation();
    const files = createFoundation(bridge);

    assert.equal(files.isPackage("/App.app"), true);
    assert.equal(files.isPackage("/folder"), false);
    assert.equal(files.isNil, isNil);
    assert.equal(
        files.nativeFailure("Cannot close", "/x", nativeError("busy")).message,
        "Cannot close \"/x\": busy (NSCocoaErrorDomain 260)"
    );
    assert.deepEqual(Object.keys(files).sort(), [
        "inspect", "isNil", "isPackage", "nativeFailure", "pathOf", "readLink", "resolveAlias", "validateDirectory"
    ]);
});
