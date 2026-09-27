"use strict";

/*
 * The path Shortcuts handed over, in each form it can arrive in, read the one
 * way that form documents -- and nothing that is not a path taken for one.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { pathOf } = require("../../../src/runtime/given-path.js");
const { fakeFoundation, box } = require("./fake-foundation.cjs");

const NOT_A_PATH = /^Error: The supplied item has no usable filesystem path\. Configure the action to receive Files\.$/u;

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
            /^Error: Shortcuts must supply a file, folder, absolute path, or local file URL\.$/u,
            String(value)
        );
    }
});

test("a conversion that only mentions a file URL partway through is not a path", () => {
    const { bridge } = fakeFoundation();

    assert.throws(() => pathOf(bridge, { toString: () => "a file:///x" }), NOT_A_PATH);
});
