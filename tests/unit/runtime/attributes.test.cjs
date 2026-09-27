"use strict";

/*
 * What an item is. A link is classified from lstat-like attributes before
 * anything asks NSURL about it, since NSURL would follow it.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { inspect, isPackage, attributes, attribute, resourceBoolean } = require("../../../src/runtime/attributes.js");
const { fakeFoundation, box } = require("./fake-foundation.cjs");

test("files, folders, aliases, links and special files are told apart", () => {
    const { bridge } = fakeFoundation();

    assert.deepEqual(inspect(bridge, "/folder"), { kind: "directory" });
    assert.deepEqual(inspect(bridge, "/App.app"), { kind: "directory" });
    assert.deepEqual(inspect(bridge, "/alias"), { kind: "alias" });
    assert.deepEqual(inspect(bridge, "/file"), { kind: "file" });
    assert.deepEqual(inspect(bridge, "/socket"), { kind: "file" });
    assert.deepEqual(inspect(bridge, "/symlink"), { kind: "symlink" });
});

test("a link is never asked about through NSURL, and nothing is resolved", () => {
    const { bridge, calls } = fakeFoundation();

    inspect(bridge, "/symlink");
    assert.deepEqual(calls, [["attributes", "/symlink"]]);
});

test("a file is asked whether it is an alias; a folder is asked nothing optional", () => {
    // Whether a folder is a package changes only a question's wording, so
    // walking a path does not ask it of every folder on the way.
    const { bridge, calls } = fakeFoundation();

    inspect(bridge, "/folder");
    inspect(bridge, "/file");
    assert.deepEqual(calls.filter(([name]) => name === "resource"), [["resource", "/file", "alias"]]);
});

test("whether a folder is a package is its own question", () => {
    const { bridge, calls } = fakeFoundation();

    assert.equal(isPackage(bridge, "/App.app"), true);
    assert.equal(isPackage(bridge, "/folder"), false);
    assert.deepEqual(calls.filter(([name]) => name === "resource"), [
        ["resource", "/App.app", "package"],
        ["resource", "/folder", "package"]
    ]);
});

test("a package question macOS cannot answer reads as not a package", () => {
    for (const entry of [{ resourceError: true }, { resourceMissing: true }]) {
        const { bridge } = fakeFoundation({ "/folder": { type: "directory", ...entry } });

        assert.equal(isPackage(bridge, "/folder"), false, JSON.stringify(entry));
    }
});

test("an alias question macOS cannot answer is an error, never a guess", () => {
    // Unlike the package question, the answer changes the destination.
    const { bridge } = fakeFoundation({ "/file": { type: "regular", resourceError: true } });

    assert.throws(() => inspect(bridge, "/file"), /Cannot read metadata for "\/file"/u);
});

test("a special file is not asked anything more", () => {
    const { bridge, calls } = fakeFoundation();

    inspect(bridge, "/socket");
    assert.deepEqual(calls, [["attributes", "/socket"]]);
});

test("an item that cannot be inspected says so, with macOS's reason", () => {
    const { bridge, made } = fakeFoundation();

    assert.throws(() => attributes(bridge, "/missing"), /^Error: Cannot inspect "\/missing": missing \(NSCocoaErrorDomain 260\)$/u);
    assert.equal(made.length, 1, "one out-parameter, for the error");
});

test("an omitted attribute is an error, not a default", () => {
    const { bridge } = fakeFoundation({ "/file": { attributeMissing: true } });

    assert.throws(() => inspect(bridge, "/file"), /^Error: macOS omitted a required filesystem attribute\.$/u);
});

test("an attribute is unwrapped from the dictionary", () => {
    const { bridge } = fakeFoundation();
    const dict = { objectForKey: (key) => box(`value of ${key}`) };

    assert.equal(attribute(bridge, dict, "k"), "value of k");
});

test("metadata that cannot be read is an error, not a 'no'", () => {
    // An alias check that failed must not become "not an alias".
    const { bridge } = fakeFoundation({ "/file": { type: "regular", resourceError: true } });

    assert.throws(() => inspect(bridge, "/file"), /^Error: Cannot read metadata for "\/file": metadata error \(NSCocoaErrorDomain 260\)$/u);
});

test("an omitted resource value is an error, not a 'no'", () => {
    const { bridge } = fakeFoundation({ "/file": { type: "regular", resourceMissing: true } });

    assert.throws(
        () => inspect(bridge, "/file"),
        /^Error: macOS omitted a required resource value for "\/file"\.$/u
    );
});

test("a resource value is read as a boolean, through its own out-parameter", () => {
    const { bridge, made } = fakeFoundation({ "/x": { alias: 1 } });

    assert.equal(resourceBoolean(bridge, "/x", bridge.ns.NSURLIsAliasFileKey), true);
    assert.equal(made.length, 2, "one for the value and one for the error");
});
