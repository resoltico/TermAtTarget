"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { pathOf } = require("../../../src/runtime/given-path.js");
const { fakeFoundation, box } = require("./fake-foundation.cjs");

const INVALID = [
    ["/%ZZ", { kind: "pathBadEncoding", params: {} }],
    ["/%2f", { kind: "pathEncodedSeparator", params: {} }],
    ["/%2F", { kind: "pathEncodedSeparator", params: {} }],
    ["/%FF", { kind: "pathBadEncoding", params: {} }],
    ["/..", { kind: "pathDotComponent", params: {} }],
    ["?query", { kind: "pathNotLocalURL", params: {} }],
    ["#fragment", { kind: "pathNotLocalURL", params: {} }]
];

test("text references are validated before Foundation can rewrite them", () => {
    const { bridge } = fakeFoundation();
    bridge.ns.NSURL.URLWithString = () => {
        assert.fail("invalid input reached Foundation");
    };
    for (const [suffix, expected] of INVALID) {
        assert.throws(() => pathOf(bridge, `file:///.file/id=1.2${suffix}`), expected);
    }
});

test("native references are validated before reading their resolved path", () => {
    const { bridge } = fakeFoundation();
    for (const [suffix, expected] of INVALID.slice(1)) {
        const reference = {
            isKindOfClass: (cls) => cls === bridge.ns.NSURL,
            isFileURL: true,
            isFileReferenceURL: true,
            absoluteString: box(`file:///.file/id=1.2${suffix}`),
            get filePathURL() { return assert.fail("invalid reference was resolved"); }
        };
        assert.throws(() => pathOf(bridge, reference), expected);
    }
});
