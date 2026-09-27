"use strict";

/*
 * What was selected, and the two paths derived from a path: its parent, and
 * the form it is shown in. Both are kept apart from the path itself, so a
 * name is never rewritten on its way to the filesystem.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { selectedPath, parentPath, displayPath } = require("../../../src/core/paths.js");

function refuse() {
    throw new Error("must not be coerced");
}

test("no input is no selection, and nothing is asked of it", () => {
    for (const input of [null, undefined, []]) {
        assert.equal(selectedPath(input, refuse), null);
    }
});

test("one item, alone or in a list, is its path", () => {
    assert.deepEqual(selectedPath("/work", String), { path: "/work", slashed: false });
    assert.deepEqual(selectedPath(["/work"], String), { path: "/work", slashed: false });
});

test("a trailing slash is kept as a fact about what was given", () => {
    // It means the name cannot be a file; the planner holds it to that.
    assert.deepEqual(selectedPath([{ path: "/work//" }], (value) => value.path), { path: "/work", slashed: true });
    assert.deepEqual(selectedPath("file:///work/dir/", String), { path: "/work/dir", slashed: true });
    assert.deepEqual(selectedPath("file:///work/dir", String), { path: "/work/dir", slashed: false });
});

test("the root's slash is not a trailing slash", () => {
    assert.deepEqual(selectedPath("/", String), { path: "/", slashed: false });
    assert.deepEqual(selectedPath("///", String), { path: "/", slashed: false });
});

test("more than one item is refused before any is read", () => {
    assert.throws(
        () => selectedPath(["/one", "/two"], refuse),
        /^Error: Term At Target opens one selected item at a time\. Select one file or folder and run it again\.$/u
    );
});

test("the item is held to the path rules", () => {
    assert.throws(() => selectedPath(["bad"], String), /absolute POSIX path/u);
});

test("a parent is every component but the last, and the root is its own", () => {
    assert.equal(parentPath("/"), "/");
    assert.equal(parentPath("/work"), "/");
    assert.equal(parentPath("/work/a/"), "/work");
    assert.equal(parentPath("//work//a//b"), "/work/a");
});

test("a displayed path is quoted and escaped, so every character is visible", () => {
    assert.equal(displayPath("/a\n'b"), "\"/a\\n'b\"");
    assert.equal(displayPath("/"), "\"/\"");
});
