"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { resolveAlias, readLink, canEnter } = require("../../../src/runtime/links.js");
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

    assert.throws(() => resolveAlias(bridge, "/alias"), { kind: "aliasUnresolved", params: { operation: "resolveAlias", path: "/alias", domain: "NSCocoaErrorDomain", code: 4, description: "target error" } });
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

    assert.throws(() => readLink(bridge, "/symlink"), { kind: "fileMissing", params: { operation: "readLink", path: "/symlink", domain: "NSCocoaErrorDomain", code: 260, description: "link error" } });
});

test("search permission is checked on the spelling it is given", () => {
    const { bridge, calls } = fakeFoundation({ "/locked": { type: "directory", noSearch: true } });

    assert.equal(canEnter(bridge, "/folder"), true);
    assert.equal(canEnter(bridge, "/locked"), false);
    assert.deepEqual(calls.at(-1), ["searchable", "/locked"]);
});

test("an alias resolution permission failure keeps its native fault", () => {
    const { bridge } = fakeFoundation({ "/alias": { targetError: true, targetErrorCode: "257" } });

    assert.throws(() => resolveAlias(bridge, "/alias"), {
        kind: "native", params: { operation: "resolveAlias", path: "/alias", domain: "NSCocoaErrorDomain", code: 257, description: "target error" }
    });
});
