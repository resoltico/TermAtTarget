"use strict";

/*
 * A folder inside the person's home folder is shown from "~", which no other
 * path shown begins with, so no two folders read the same.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { presentLocation } = require("../../../src/core/present.js");

const parentOf = (path, home) => presentLocation(path, home).parent;

test("a folder inside the home folder is shown from ~", () => {
    assert.equal(parentOf("/Users/you/Downloads/Projects", "/Users/you"), "~/Downloads");
    assert.equal(parentOf("/Users/you/Projects", "/Users/you"), "~");
    assert.equal(parentOf("/Users/you/a b/x", "/Users/you"), "~/a b");
    assert.equal(parentOf("/Users/you/a\nb/x", "/Users/you"), "\"~/a\\u{000A}b\"", "still escaped");
});

test("nothing outside it is", () => {
    assert.equal(parentOf("/Users/your/Projects", "/Users/you"), "/Users/your", "a sibling that shares a prefix");
    assert.equal(parentOf("/Users/Projects", "/Users/you"), "/Users");
    assert.equal(parentOf("/top", "/"), "/", "home at the root is not shortened");
    assert.equal(parentOf("/top/x", "/"), "/top");
    assert.equal(parentOf("/top/x", null), "/top");
    assert.equal(parentOf("/rel/x/y", "rel/x"), "/rel/x", "nor a home that is not absolute");
});
