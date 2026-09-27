"use strict";

/*
 * Following an alias or a link to what it finally points at, one hop at a
 * time, with a cycle and an overlong chain each refused in their own words.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { resolveTarget, MAX_LINKS } = require("../../../src/core/resolve.js");
const { fixture } = require("../../helpers.cjs");

const file = { kind: "file" };
const alias = (target) => ({ kind: "alias", target });
const link = (target) => ({ kind: "symlink", target });

test("an item that is neither alias nor link is its own target", () => {
    const io = fixture({ "/work/child": file });

    assert.deepEqual(resolveTarget("/work/child", io), { path: "/work/child", facts: file });
});

test("relative and absolute links and mixed alias chains reach the same file", () => {
    const io = fixture({
        "/work/link": link("child"),
        "/work/child": file,
        "/work/absolute": link("/work/link"),
        "/work/alias": alias("/work/absolute"),
        "/work/toAlias": link("alias"),
        "/work/up": link("../work/child")
    });

    for (const path of ["/work/link", "/work/absolute", "/work/alias", "/work/toAlias", "/work/up"]) {
        assert.deepEqual(resolveTarget(path, io), { path: "/work/child", facts: file }, path);
    }
});

test("an alias target is held to the path rules", () => {
    assert.throws(() => resolveTarget("/a", fixture({ "/a": alias("relative") })), /absolute POSIX path/u);
});

test("a link target is held to the text rules before it is followed", () => {
    assert.throws(() => resolveTarget("/a", fixture({ "/a": link("") })), /nonempty Unicode text/u);
});

test("a missing target is reported, not guessed at", () => {
    assert.throws(() => resolveTarget("/a", fixture({ "/a": alias("/missing") })), /^Error: No such item: \/missing$/u);
});

test("an alias that returns to itself is a cycle", () => {
    assert.throws(
        () => resolveTarget("/a", fixture({ "/a": alias("/a") })),
        /^Error: A link cycle was found at "\/a"\.$/u
    );
});

test("a symbolic link to itself is a cycle too", () => {
    assert.throws(() => resolveTarget("/a", fixture({ "/a": link("a") })), /Too many/u);
});

function aliasChain(length) {
    return Object.fromEntries(Array.from({ length }, (unused, index) => [`/a${index}`, alias(`/a${index + 1}`)]));
}

test("an alias chain past the budget is refused as too many aliases", () => {
    assert.throws(
        () => resolveTarget("/a0", fixture(aliasChain(MAX_LINKS + 1))),
        /^Error: Too many aliases while resolving "\/a0"\.$/u
    );
});

test("a link at the end of a spent budget is refused as too many links", () => {
    const items = { ...aliasChain(MAX_LINKS), [`/a${MAX_LINKS}`]: link("/work") };

    assert.throws(
        () => resolveTarget("/a0", fixture(items)),
        /^Error: Too many links while resolving "\/a0"\.$/u
    );
});

test("a chain exactly as long as the budget resolves", () => {
    const items = { ...aliasChain(MAX_LINKS), [`/a${MAX_LINKS}`]: file };

    assert.deepEqual(resolveTarget("/a0", fixture(items)), { path: `/a${MAX_LINKS}`, facts: file });
});

test("a link is read before the budget is spent on it", () => {
    // A link that cannot be read says so, rather than being counted towards
    // a cycle that is not there.
    // With the budget already spent, reading first is the only way the read's
    // own failure can be the one reported.
    const failure = new Error("unreadable");
    const items = { ...aliasChain(MAX_LINKS), [`/a${MAX_LINKS}`]: link("/work") };
    const io = fixture(items, {
        readLink() {
            throw failure;
        }
    });

    assert.throws(() => resolveTarget("/a0", io), (error) => error === failure);
});
