"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { resolveAlias, readLink, validateDirectory } = require("../../../src/runtime/links.js");
const { fakeFoundation } = require("./fake-foundation.cjs");

/*
 * Where an alias or a symbolic link points, read without side effects: no
 * volume mounted, no dialog shown, and a link's target kept as it is spelled.
 */

test("an alias resolves to its target's path", () => {
    const { bridge } = fakeFoundation();

    assert.equal(resolveAlias(bridge, "/alias"), "/folder");
});

test("an alias is resolved without UI and without mounting, both at once", () => {
    const { bridge, calls } = fakeFoundation();

    resolveAlias(bridge, "/alias");
    // NSURLBookmarkResolutionWithoutUI (256) and WithoutMounting (512), together.
    assert.deepEqual(calls.at(-1), ["resolve", "/alias", 768]);
});

test("an alias whose original cannot be found says so, and what would work instead", () => {
    const { bridge } = fakeFoundation({ "/alias": { targetError: true } });

    assert.throws(() => resolveAlias(bridge, "/alias"), { kind: "aliasTargetMissing", params: { native: { operation: "resolveAlias", path: "/alias", domain: "NSCocoaErrorDomain", code: 260, description: "target error" } } });
});

test("an alias to something that is not a local file is refused", () => {
    const { bridge } = fakeFoundation({ "/alias": { remote: true, target: "/x" } });

    assert.throws(() => resolveAlias(bridge, "/alias"), { kind: "aliasTargetNotLocal", params: { path: "/alias" } });
});

test("a link's target is returned as spelled, relative or not", () => {
    const { bridge } = fakeFoundation({ "/up": { target: "../x" } });

    assert.equal(readLink(bridge, "/symlink"), "file");
    assert.equal(readLink(bridge, "/up"), "../x");
});

test("a link that cannot be read says why", () => {
    const { bridge } = fakeFoundation({ "/symlink": { linkError: true } });

    assert.throws(() => readLink(bridge, "/symlink"), { kind: "native", params: { operation: "readLink", path: "/symlink", domain: "NSCocoaErrorDomain", code: 260, description: "link error" } });
});

/*
 * The last check before Terminal is asked: that the destination is still a
 * directory, reached the way the filesystem reaches it, and can be entered.
 */

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
