"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { physicalPath, resolveTarget, validateDirectory, MAX_LINKS } = require("../../../src/core/resolve.js");
const { fixture } = require("../../helpers.cjs");

/*
 * Walking a path the way the filesystem does: component by component, a link
 * followed where it is met, and ".." applied to where the walk has got to
 * rather than to the text.
 */

const directory = { kind: "directory" };
const file = { kind: "file" };
const link = (target) => ({ kind: "symlink", target });
const fresh = () => ({ links: 0 });

test("a link partway through is followed before '..' is applied", () => {
    const io = fixture({
        "/a": directory,
        "/a/shortcut": link("/elsewhere/deep"),
        "/elsewhere": directory,
        "/elsewhere/deep": directory,
        "/elsewhere/goal": file
    });

    assert.equal(physicalPath("/a/shortcut/../goal", io, fresh()), "/elsewhere/goal");
});

test("empty and '.' components are skipped, and '..' stops at root", () => {
    const io = fixture({ "/a": directory });

    assert.equal(physicalPath("/../.././a//", io, fresh()), "/a");
    assert.equal(physicalPath("/", io, fresh()), "/");
    assert.equal(physicalPath("/a/.", io, fresh()), "/a");
});

test("a relative link partway through is read from its own folder", () => {
    const io = fixture({ "/work/link": link("child"), "/work/child": file });

    assert.equal(physicalPath("/work/link", io, fresh()), "/work/child");
});

test("an absolute link partway through restarts the walk from root", () => {
    const io = fixture({ "/a": directory, "/a/b": link("/work"), "/work/c": file });

    assert.equal(physicalPath("/a/b/c", io, fresh()), "/work/c");
});

test("a relative path is refused, since the walk has nowhere to start", () => {
    assert.throws(
        () => physicalPath("relative", fixture(), fresh()),
        { kind: "relativeResolutionPath", params: { path: "relative" } }
    );
    assert.throws(() => physicalPath("", fixture(), fresh()), { kind: "pathNotText", params: {} });
});

test("walking on through a file is refused, even to '..' or '.'", () => {
    const io = fixture({ "/work/goal": file });

    for (const path of ["/work/goal/..", "/work/goal/", "/work/goal/.", "/work/goal/x"]) {
        assert.throws(
            () => physicalPath(path, io, fresh()),
            { kind: "linkThroughFile", params: { path: "/work/goal" } },
            path
        );
    }
});

test("a file at the end of the walk is where it ends", () => {
    assert.equal(physicalPath("/work/goal", fixture({ "/work/goal": file }), fresh()), "/work/goal");
});

test("each link followed is counted against the shared budget", () => {
    const budget = fresh();
    const io = fixture({ "/a": link("/b"), "/b": link("/work") });

    assert.equal(physicalPath("/a", io, budget), "/work");
    assert.equal(budget.links, 2);
});

test("a link met with the budget spent is refused before it is read", () => {
    const io = fixture({ "/a": link("/work") }, {
        readLink() {
            throw new Error("must not be read");
        }
    });

    assert.throws(
        () => physicalPath("/a", io, { links: 40 }),
        { kind: "tooManyLinks", params: { path: "/a" } }
    );
});

test("a link cycle partway through runs into the budget", () => {
    assert.throws(
        () => physicalPath("/a", fixture({ "/a": link("/a") }), fresh()),
        { kind: "tooManyLinks", params: { path: "/a" } }
    );
});

/*
 * Following an alias or a link to what it finally points at, one hop at a
 * time, with a cycle and an overlong chain each refused in their own words.
 */

const alias = (target) => ({ kind: "alias", target });

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
    assert.throws(() => resolveTarget("/a", fixture({ "/a": alias("relative") })), { kind: "pathRelative", params: {} });
});

test("a link target is held to the text rules before it is followed", () => {
    assert.throws(() => resolveTarget("/a", fixture({ "/a": link("") })), { kind: "pathNotText", params: {} });
});

test("a missing target is reported, not guessed at", () => {
    assert.throws(() => resolveTarget("/a", fixture({ "/a": alias("/missing") })), /^Error: No such item: \/missing$/u);
});

test("an alias that returns to itself is a cycle", () => {
    assert.throws(
        () => resolveTarget("/a", fixture({ "/a": alias("/a") })),
        { kind: "linkCycle", params: { path: "/a" } }
    );
});

test("a symbolic link to itself is a cycle too", () => {
    assert.throws(() => resolveTarget("/a", fixture({ "/a": link("a") })), { kind: "tooManyLinks", params: { path: "//a" } });
});

function aliasChain(length) {
    return Object.fromEntries(Array.from({ length }, (unused, index) => [`/a${index}`, alias(`/a${index + 1}`)]));
}

test("an alias chain past the budget is refused as too many aliases", () => {
    assert.throws(
        () => resolveTarget("/a0", fixture(aliasChain(MAX_LINKS + 1))),
        { kind: "tooManyLinks", params: { path: "/a0" } }
    );
});

test("a link at the end of a spent budget is refused as too many links", () => {
    const items = { ...aliasChain(MAX_LINKS), [`/a${MAX_LINKS}`]: link("/work") };

    assert.throws(
        () => resolveTarget("/a0", fixture(items)),
        { kind: "tooManyLinks", params: { path: "/a0" } }
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

test("the validated destination is a physical directory with searchable original spelling", () => {
    const entries = { "/work/alias": { kind: "alias" }, "/work/link": link("folder"), "/work/folder": directory };
    const io = fixture(entries);

    validateDirectory("/work/link", io);
    assert.deepEqual(io.events.at(-1), ["validate", "/work/link"]);
    assert.throws(() => validateDirectory("/work/alias", io),
        { kind: "destinationGone", params: { path: "/work/alias" } });
    assert.equal(io.events.some(([name]) => name === "resolveAlias"), false);
    assert.throws(() => validateDirectory("/work/link", fixture(entries, { canEnter: () => false })),
        { kind: "destinationNotEnterable", params: { path: "/work/link" } });
});

test("validating a destination gives its physical walk the full link budget", () => {
    const entries = Object.fromEntries(Array.from({ length: 41 }, (_unused, index) =>
        [`/work/link${index}`, link(index === 40 ? "folder" : `link${index + 1}`)]));
    const io = fixture({ ...entries, "/work/folder": directory });

    assert.doesNotThrow(() => validateDirectory("/work/link1", io));
    assert.throws(() => validateDirectory("/work/link0", io),
        { kind: "tooManyLinks", params: { path: "/work/link0" } });
});
