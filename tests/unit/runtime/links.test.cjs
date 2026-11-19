"use strict";

/*
 * Where an alias or a symbolic link points, read without side effects: no
 * volume mounted, no dialog shown, and a link's target kept as it is spelled.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { resolveAlias, readLink } = require("../../../src/runtime/links.js");
const { fakeFoundation } = require("./fake-foundation.cjs");

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
