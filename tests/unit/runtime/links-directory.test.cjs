"use strict";

/*
 * The last check before Terminal is asked: that the destination is still a
 * directory, reached the way the filesystem reaches it, and can be entered.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { validateDirectory } = require("../../../src/runtime/links.js");
const { fakeFoundation } = require("./fake-foundation.cjs");

test("a directory that can be entered passes, the root included", () => {
    const { bridge } = fakeFoundation();

    assert.doesNotThrow(() => validateDirectory(bridge, "/folder"));
    assert.doesNotThrow(() => validateDirectory(bridge, "/"));
});

test("what is checked for entry is the path as chosen, not the one it resolves to", () => {
    const { bridge, calls } = fakeFoundation({ "/directory-link": { type: "symlink", target: "folder" } });

    validateDirectory(bridge, "/directory-link");
    assert.deepEqual(calls.at(-1), ["searchable", "/directory-link"]);
});

test("a symbolic link to a directory is a directory; an alias is not", () => {
    const { bridge, calls } = fakeFoundation({ "/directory-link": { type: "symlink", target: "folder" } });

    assert.doesNotThrow(() => validateDirectory(bridge, "/directory-link"));
    assert.throws(
        () => validateDirectory(bridge, "/alias"),
        { kind: "destinationGone", params: { path: "/alias" } }
    );
    assert.equal(calls.some(([name]) => name === "resolve"), false, "no alias is resolved here");
});

test("a file is not a directory", () => {
    const { bridge } = fakeFoundation();

    assert.throws(() => validateDirectory(bridge, "/file"), { kind: "destinationGone", params: { path: "/file" } });
});

test("a link to nothing cannot be inspected", () => {
    const { bridge } = fakeFoundation({ "/broken": { type: "symlink", target: "missing" } });

    assert.throws(() => validateDirectory(bridge, "/broken"), { kind: "native", params: { operation: "inspect", path: "/missing", domain: "NSCocoaErrorDomain", code: 260, description: "missing" } });
});

test("a directory that cannot be entered is refused", () => {
    const { bridge } = fakeFoundation({ "/locked": { type: "directory", noSearch: true } });

    assert.throws(
        () => validateDirectory(bridge, "/locked"),
        { kind: "destinationNotEnterable", params: { path: "/locked" } }
    );
});

test("a link cycle on the way to the destination is refused, not followed forever", () => {
    const { bridge } = fakeFoundation({ "/loop": { type: "symlink", target: "loop" } });

    assert.throws(
        () => validateDirectory(bridge, "/loop"),
        { kind: "tooManyLinks", params: { path: "/loop" } }
    );
});
