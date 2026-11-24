"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { validUnicode, checkPathText, absolutePath, decodeFileURL, selectedPath, parentPath } = require("../../../src/core/paths.js");

/*
 * What counts as path text, and how a path given as text becomes the one path
 * it names. The properties in paths-properties.test.cjs cover every name; the
 * cases here pin the exact messages and the boundaries between the rules.
 */

const NOT_TEXT = { kind: "pathNotText", params: {} };

test("well-formed text of every width is valid, surrogate pairs included", () => {
    for (const value of ["", "hello", "éЖĒ", "😀", "􏿿", "𐀀", "a😀z"]) {
        assert.equal(validUnicode(value), true, value);
    }
});

test("an unpaired surrogate, at either end or alone, is not text", () => {
    for (const value of ["\uD800", "\uDBFF", "\uDC00", "\uDFFF", "a\uD800z", "\uDC00\uD800", "\uD800\uD800", "😀\uD800"]) {
        assert.equal(validUnicode(value), false, JSON.stringify(value));
        assert.throws(() => checkPathText(value), NOT_TEXT);
    }
});

test("the characters just outside the surrogate ranges are ordinary text", () => {
    // U+D7FF and U+E000 are not surrogates, whatever their neighbours are.
    assert.equal(validUnicode("퟿"), true);
});

test("path text is a nonempty string without a NUL", () => {
    for (const value of [null, undefined, {}, 0, "", "a\0b"]) {
        assert.throws(() => checkPathText(value), NOT_TEXT, JSON.stringify(value));
    }

    // Whitespace and newlines are legal in a name, and kept exactly.
    assert.equal(checkPathText(" /\n "), " /\n ");
});

test("an absolute path keeps every name exactly, and only its slashes change", () => {
    assert.equal(absolutePath("/"), "/");
    assert.equal(absolutePath("///work//one/"), "/work/one");
    assert.equal(absolutePath("/work/a b'\n$`;&😀 "), "/work/a b'\n$`;&😀 ");
    assert.equal(absolutePath("/work/name#fragment?query"), "/work/name#fragment?query");
});

test("a relative path or ~ is refused rather than expanded", () => {
    for (const value of ["relative", "~/work", "./work", "work/"]) {
        assert.throws(
            () => absolutePath(value),
            { kind: "pathRelative", params: {} },
            value
        );
    }
});

test("a . or .. component is refused, and a name that only contains dots is not one", () => {
    for (const value of ["/a/./b", "/a/../b", "/.", "/..", "/a/.."]) {
        assert.throws(
            () => absolutePath(value),
            { kind: "pathDotComponent", params: {} },
            value
        );
    }

    assert.equal(absolutePath("/a/.../b/..c/.d"), "/a/.../b/..c/.d");
});

test("text that is not a path is refused before anything else is said", () => {
    assert.throws(() => absolutePath(""), NOT_TEXT);
    assert.throws(() => absolutePath("/a\0"), NOT_TEXT);
});

/*
 * A local file URL is decoded exactly once into the path it names. Anything
 * that could make it name a different path -- a remote host, a query, an
 * encoded separator, bytes that are not UTF-8 -- is refused.
 */

const NOT_LOCAL = { kind: "pathNotLocalURL", params: {} };

test("a local file URL is decoded once to its path", () => {
    assert.equal(absolutePath("file:///work/a%20b%27%0A%25"), "/work/a b'\n%");
    assert.equal(absolutePath("FILE://LOCALHOST/work/%2520"), "/work/%20", "decoded once, not twice");
    assert.equal(decodeFileURL("file://localhost/"), "/");
    assert.equal(decodeFileURL("file:///"), "/");
});

test("a remote host, a query or a fragment is refused", () => {
    for (const value of ["file://remote/a", "file://localhost.example/a", "file:///a?x", "file:///a#x"]) {
        assert.throws(() => decodeFileURL(value), NOT_LOCAL, value);
    }
});

test("a URL that is not of the file:// form is refused", () => {
    for (const value of ["file:/work", "file:work", "file://", "https://example.com/x"]) {
        assert.throws(() => decodeFileURL(value), NOT_LOCAL, value);
    }
});

test("only an absolute path or a file URL is accepted as input", () => {
    // An https URL is not a file URL, so it is refused as a relative path.
    assert.throws(() => absolutePath("https://example.com/x"), { kind: "pathRelative", params: {} });
});

test("an encoded separator is refused, in either case", () => {
    for (const value of ["file:///a%2fb", "file:///a%2Fb"]) {
        assert.throws(
            () => decodeFileURL(value),
            { kind: "pathEncodedSeparator", params: {} },
            value
        );
    }
});

test("invalid percent-encoding or UTF-8 is refused, keeping the decoder's reason", () => {
    for (const value of ["file:///bad%", "file:///bad%zz", "file:///bad%C0%80", "file:///bad%ED%A0%80"]) {
        assert.throws(() => decodeFileURL(value), { kind: "pathBadEncoding", params: {} }, value);
    }
});

test("what a URL decodes to is held to the same rules as a path", () => {
    assert.throws(() => absolutePath("file:///bad%00"), { kind: "pathNotText", params: {} });
    assert.throws(() => absolutePath("file:///a/%2e%2e/b"), { kind: "pathDotComponent", params: {} });
});

test("only text that starts as a file URL is read as one", () => {
    // A folder may be named "file:x"; a path through it is a path.
    assert.equal(absolutePath("/a/file:b/c"), "/a/file:b/c");
    assert.throws(() => decodeFileURL("xfile:///a"), NOT_LOCAL);
    assert.throws(() => decodeFileURL("/x/file:///a"), NOT_LOCAL);
});

/*
 * What was selected and how a path resolves to its parent.
 */

test("a trailing slash is kept as a fact about what was given", () => {
    // It means the name cannot be a file; the planner holds it to that.
    assert.deepEqual(selectedPath("/work//"), { path: "/work", slashed: true });
    assert.deepEqual(selectedPath("file:///work/dir/"), { path: "/work/dir", slashed: true });
    assert.deepEqual(selectedPath("file:///work/%252F/"), { path: "/work/%2F", slashed: true });
    assert.deepEqual(selectedPath("file:///work/dir"), { path: "/work/dir", slashed: false });
});

test("the root's slash is not a trailing slash", () => {
    assert.deepEqual(selectedPath("/"), { path: "/", slashed: false });
    assert.deepEqual(selectedPath("///"), { path: "/", slashed: false });
});

test("the item is held to the path rules", () => {
    assert.throws(() => selectedPath("bad"), { kind: "pathRelative", params: {} });
});

test("a parent is every component but the last, and the root is its own", () => {
    assert.equal(parentPath("/"), "/");
    assert.equal(parentPath("/work"), "/");
    assert.equal(parentPath("/work/a"), "/work");
    assert.equal(parentPath("/work/a/b"), "/work/a");
});
