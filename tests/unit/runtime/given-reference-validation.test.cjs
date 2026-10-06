"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { pathOf } = require("../../../src/runtime/given-path.js");
const { fakeFoundation, box } = require("./fake-foundation.cjs");

const INVALID = [
    ["/%ZZ", /invalid percent-encoding/u],
    ["/%2f", /encoded path separator/u],
    ["/%2F", /encoded path separator/u],
    ["/%FF", /invalid percent-encoding/u],
    ["/..", /Direct input/u],
    ["?query", /without a remote host, query, or fragment/u],
    ["#fragment", /without a remote host, query, or fragment/u]
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
