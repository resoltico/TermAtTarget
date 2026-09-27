"use strict";

/*
 * What counts as path text, and how a path given as text becomes the one path
 * it names. The properties in paths-properties.test.cjs cover every name; the
 * cases here pin the exact messages and the boundaries between the rules.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { validUnicode, checkPathText, absolutePath } = require("../../../src/core/paths.js");

const NOT_TEXT = /^Error: A path must be nonempty Unicode text without a NUL character\.$/u;

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
            /^Error: Use an absolute POSIX path or a local file URL; relative paths and ~ are not expanded\.$/u,
            value
        );
    }
});

test("a . or .. component is refused, and a name that only contains dots is not one", () => {
    for (const value of ["/a/./b", "/a/../b", "/.", "/..", "/a/.."]) {
        assert.throws(
            () => absolutePath(value),
            /^Error: Direct input must not contain \. or \.\. path components\. Select the item itself\.$/u,
            value
        );
    }

    assert.equal(absolutePath("/a/.../b/..c/.d"), "/a/.../b/..c/.d");
});

test("text that is not a path is refused before anything else is said", () => {
    assert.throws(() => absolutePath(""), NOT_TEXT);
    assert.throws(() => absolutePath("/a\0"), NOT_TEXT);
});
