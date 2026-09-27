"use strict";

/*
 * The Shortcuts envelope, taken apart only when it is exactly that. Each shape
 * below was measured on macOS 27 through Get Selected Files in Finder feeding
 * Run JavaScript for Mac Automation.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { selectionOf } = require("../../../src/core/invocation.js");

// JXA Path objects: String() is the path, and nothing else is readable.
const path = (text) => ({ toString: () => text });
const options = () => ({ source: "function run() {}", "temporary items path": "/tmp/x", ignoresInput: false });

test("one file, one folder or one alias comes out as a list of one", () => {
    const item = path("/work/file.txt");

    assert.deepEqual(selectionOf([[item], options()]), [item]);
});

test("two items come out as two, for the one-item rule to refuse", () => {
    const items = [path("/a"), path("/b")];

    assert.deepEqual(selectionOf([items, options()]), items);
});

test("an empty selection comes out empty, which is no input", () => {
    assert.deepEqual(selectionOf([[], options()]), []);
});

test("what osascript passes is taken as it is", () => {
    const item = path("/work");

    assert.deepEqual(selectionOf([item]), [item]);
    assert.equal(selectionOf("/work"), "/work");
    assert.equal(selectionOf(null), null);
    assert.equal(selectionOf(undefined), undefined);
    assert.deepEqual(selectionOf([]), []);
});

const UNRECOGNISED = /^Error: Shortcuts passed its input in a form this version does not recognise\.$/u;

test("a nested list that is not exactly the measured envelope is refused by name", () => {
    // A nested list is never a selection osascript passes, so it is the
    // envelope or a form this version does not know -- never "two items".
    const list = [path("/a")];
    const malformed = [
        [list],
        [list, options(), path("/b")],
        [list, path("/b")],
        [list, null],
        [list, undefined],
        [list, [path("/b")]],
        [list, { source: "x" }],
        [list, { ignoresInput: false }],
        [list, { source: 1, ignoresInput: false }],
        [list, { source: "x", ignoresInput: "false" }],
        [list, { source: "x", ignoresInput: 0 }],
        [[], { source: "x", ignoresInput: null }],
        // JXA specifiers are callable: a function is never the options object.
        [list, Object.assign(() => undefined, { source: "x", ignoresInput: false })]
    ];

    for (const input of malformed) {
        assert.throws(() => selectionOf(input), UNRECOGNISED);
    }
});

test("the options are read as given, including an ignoresInput of true", () => {
    // Checked for its type, not acted on: the items are what was given.
    const items = [path("/a")];

    assert.equal(selectionOf([items, { ...options(), ignoresInput: true }]), items);
});

test("a flat list whose items only resemble the envelope is taken as it is", () => {
    const input = [path("/a"), options()];

    assert.equal(selectionOf(input), input);
    const reversed = [options(), [path("/a")]];

    assert.equal(selectionOf(reversed), reversed);
});
