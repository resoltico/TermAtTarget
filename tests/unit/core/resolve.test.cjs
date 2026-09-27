"use strict";

/*
 * Walking a path the way the filesystem does: component by component, a link
 * followed where it is met, and ".." applied to where the walk has got to
 * rather than to the text.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { physicalPath } = require("../../../src/core/resolve.js");
const { fixture } = require("../../helpers.cjs");

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
        /^Error: Internal link resolution requires an absolute path\.$/u
    );
    assert.throws(() => physicalPath("", fixture(), fresh()), /nonempty Unicode text/u);
});

test("walking on through a file is refused, even to '..' or '.'", () => {
    const io = fixture({ "/work/goal": file });

    for (const path of ["/work/goal/..", "/work/goal/", "/work/goal/.", "/work/goal/x"]) {
        assert.throws(
            () => physicalPath(path, io, fresh()),
            /^Error: A link target traverses a non-directory: "\/work\/goal"\.$/u,
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
        /^Error: Too many symbolic links, or a link cycle, while resolving "\/a"\.$/u
    );
});

test("a link cycle partway through runs into the budget", () => {
    assert.throws(
        () => physicalPath("/a", fixture({ "/a": link("/a") }), fresh()),
        /Too many symbolic links, or a link cycle/u
    );
});
