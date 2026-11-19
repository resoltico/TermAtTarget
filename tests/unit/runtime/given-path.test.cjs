"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { pathOf } = require("../../../src/runtime/given-path.js");
const { fakeFoundation, box } = require("./fake-foundation.cjs");

/*
 * The path Shortcuts handed over, in each form it can arrive in, read the one
 * way that form documents -- and nothing that is not a path taken for one.
 */

const NOT_A_PATH = { kind: "unusableInput", params: {} };

test("a string is the path as given", () => {
    const { bridge } = fakeFoundation();

    assert.equal(pathOf(bridge, "/plain"), "/plain");
    assert.equal(pathOf(bridge, "relative"), "relative", "judged later, by the core");
});

test("an NSString is its text", () => {
    const { bridge } = fakeFoundation();

    assert.equal(pathOf(bridge, box("/NSString")), "/NSString");
});

test("an NSString that is not text is not taken as a path", () => {
    const { bridge } = fakeFoundation();

    assert.throws(() => pathOf(bridge, box(3)), NOT_A_PATH);
});

test("a JXA Path converts to its path, or to a file URL", () => {
    const { bridge } = fakeFoundation();

    assert.equal(pathOf(bridge, { toString: () => "/Path" }), "/Path");
    assert.equal(pathOf(bridge, { toString: () => "FILE:///other" }), "FILE:///other");
});

test("an object that throws when probed is read by its documented conversion", () => {
    // Asking an arbitrary JXA object about a class can throw, and so can
    // unwrapping one. Neither is a reason to refuse what it converts to.
    const { bridge } = fakeFoundation();
    const probeThrows = {
        get isKindOfClass() {
            throw new Error("JXA property probe");
        },
        toString: () => "/safe"
    };

    assert.equal(pathOf(bridge, probeThrows), "/safe");
});

test("a function with a path conversion is object-like too", () => {
    const { bridge } = fakeFoundation();
    const specifier = Object.assign(() => undefined, { toString: () => "/specifier" });

    assert.equal(pathOf(bridge, specifier), "/specifier");
});

test("a value with nothing path-like about it is refused", () => {
    const { bridge } = fakeFoundation();

    for (const value of [{}, { toString: () => 3 }, { toString: null }, { toString: () => "text" }]) {
        assert.throws(() => pathOf(bridge, value), NOT_A_PATH, JSON.stringify(value));
    }
});

test("a value that is no kind of item is refused before anything is asked", () => {
    const { bridge } = fakeFoundation();

    for (const value of [null, undefined, false, 1, []]) {
        assert.throws(
            () => pathOf(bridge, value),
            { kind: "unusableInput", params: {} },
            String(value)
        );
    }
});

test("a conversion that only mentions a file URL partway through is not a path", () => {
    const { bridge } = fakeFoundation();

    assert.throws(() => pathOf(bridge, { toString: () => "a file:///x" }), NOT_A_PATH);
});

/*
 * A native NSURL handed over as the selection: a file URL is its URL text,
 * left for the core to decode once; a file-reference URL is first turned into
 * the path of what it refers to; anything else is refused.
 */

function fileURL(ns, overrides = {}) {
    return {
        isKindOfClass: (cls) => cls === ns.NSURL,
        isNil: () => false,
        isFileURL: true,
        absoluteString: box("file:///file%20name"),
        ...overrides
    };
}

test("a file NSURL is its URL text, left for the core to decode", () => {
    const { bridge } = fakeFoundation();

    assert.equal(pathOf(bridge, fileURL(bridge.ns)), "file:///file%20name");
});

test("an NSURL that is not a file URL is refused", () => {
    const { bridge } = fakeFoundation();

    assert.throws(
        () => pathOf(bridge, fileURL(bridge.ns, { isFileURL: false })),
        { kind: "pathNotLocalURL", params: {} }
    );
});

test("an object of another class is not read as a URL", () => {
    const { bridge } = fakeFoundation();
    const other = { isKindOfClass: () => false, isFileURL: true, toString: () => "/other" };

    assert.equal(pathOf(bridge, other), "/other");
});

test("a file-reference URL is turned into the path of what it refers to", () => {
    // file:///.file/id=... names an object; read as a path it names nothing.
    const { bridge } = fakeFoundation();
    const reference = fileURL(bridge.ns, {
        absoluteString: box("file:///.file/id=6571367.515714763"),
        isFileReferenceURL: true,
        filePathURL: { isNil: () => false, absoluteString: box("file:///work/real%20file.txt") }
    });

    assert.equal(pathOf(bridge, reference), "file:///work/real%20file.txt");
});

test("a reference to something that no longer exists says so", () => {
    const { bridge } = fakeFoundation();

    for (const filePathURL of [{ isNil: () => true }, null]) {
        const reference = fileURL(bridge.ns, { isFileReferenceURL: true, filePathURL });

        assert.throws(() => pathOf(bridge, reference), { kind: "itemGone", params: {} });
    }
});

test("a path URL is taken as spelled, never resolved", () => {
    // Converting every URL would turn a selected link into where it points.
    const { bridge } = fakeFoundation();
    const plain = Object.defineProperty(fileURL(bridge.ns, { isFileReferenceURL: false }), "filePathURL", {
        get() {
            throw new Error("a path URL must not be converted");
        }
    });

    assert.equal(pathOf(bridge, plain), "file:///file%20name");
});

test("a file-reference URL written as text goes through Foundation too", () => {
    // As text it would otherwise be read as the path "/.file/id=...".
    const { bridge } = fakeFoundation();
    const asked = [];

    bridge.ns.NSURL.URLWithString = (text) => {
        asked.push(text);
        return fileURL(bridge.ns, {
            isFileReferenceURL: true,
            filePathURL: { isNil: () => false, absoluteString: box("file:///work/real.txt") }
        });
    };

    for (const text of ["file:///.file/id=1.2", "FILE://localhost/.file/id=1.2"]) {
        assert.equal(pathOf(bridge, text), "file:///work/real.txt", text);
    }

    assert.deepEqual(asked, ["file:///.file/id=1.2", "FILE://localhost/.file/id=1.2"]);
});

test("textual references that Foundation cannot read, or that refer to nothing, say so", () => {
    const { bridge } = fakeFoundation();

    for (const answer of [null, { isNil: () => true }]) {
        bridge.ns.NSURL.URLWithString = () => answer;
        assert.throws(() => pathOf(bridge, "file:///.file/id=1.2"), { kind: "itemGone", params: {} });
    }

    bridge.ns.NSURL.URLWithString = () => fileURL(bridge.ns, { isFileReferenceURL: true, filePathURL: null });
    assert.throws(() => pathOf(bridge, "file:///.file/id=1.2"), { kind: "itemGone", params: {} });
});

test("other text, including path URLs and look-alikes, is left for the core", () => {
    const { bridge } = fakeFoundation();

    bridge.ns.NSURL.URLWithString = () => {
        throw new Error("only reference URLs go to Foundation");
    };

    for (const text of ["/work/.file/id=1", "file:///work/.file/id=1", "file://remote/.file/id=1", "file:///.file/idx=1", "/.file/id=1",
        "/work/file:///.file/id=1"]) {
        assert.equal(pathOf(bridge, text), text, text);
    }
});

test("a Path or NSString whose text is a reference URL is converted as well", () => {
    const { bridge } = fakeFoundation();

    bridge.ns.NSURL.URLWithString = () => fileURL(bridge.ns, {
        isFileReferenceURL: true,
        filePathURL: { isNil: () => false, absoluteString: box("file:///work/x") }
    });
    assert.equal(pathOf(bridge, { toString: () => "file:///.file/id=9.9" }), "file:///work/x");
    assert.equal(pathOf(bridge, box("file:///.file/id=9.9")), "file:///work/x");
});

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
