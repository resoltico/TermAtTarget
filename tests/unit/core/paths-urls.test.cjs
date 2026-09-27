"use strict";

/*
 * A local file URL is decoded exactly once into the path it names. Anything
 * that could make it name a different path -- a remote host, a query, an
 * encoded separator, bytes that are not UTF-8 -- is refused.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { decodeFileURL, absolutePath } = require("../../../src/core/paths.js");

const NOT_LOCAL = /^Error: Use a local file URL without a remote host, query, or fragment\.$/u;

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
    assert.throws(() => absolutePath("https://example.com/x"), /relative paths and ~ are not expanded/u);
});

test("an encoded separator is refused, in either case", () => {
    for (const value of ["file:///a%2fb", "file:///a%2Fb"]) {
        assert.throws(
            () => decodeFileURL(value),
            /^Error: A file URL must not contain an encoded path separator\.$/u,
            value
        );
    }
});

test("invalid percent-encoding or UTF-8 is refused, keeping the decoder's reason", () => {
    for (const value of ["file:///bad%", "file:///bad%zz", "file:///bad%C0%80", "file:///bad%ED%A0%80"]) {
        assert.throws(() => decodeFileURL(value), (error) => {
            assert.equal(error.message, "The file URL contains invalid percent-encoding or UTF-8.");
            assert.ok(error.cause instanceof URIError, "the decoder's own error is kept");

            return true;
        }, value);
    }
});

test("what a URL decodes to is held to the same rules as a path", () => {
    assert.throws(() => absolutePath("file:///bad%00"), /nonempty Unicode text without a NUL/u);
    assert.throws(() => absolutePath("file:///a/%2e%2e/b"), /must not contain \. or \.\. path components/u);
});

test("only text that starts as a file URL is read as one", () => {
    // A folder may be named "file:x"; a path through it is a path.
    assert.equal(absolutePath("/a/file:b/c"), "/a/file:b/c");
    assert.throws(() => decodeFileURL("xfile:///a"), NOT_LOCAL);
    assert.throws(() => decodeFileURL("/x/file:///a"), NOT_LOCAL);
});
