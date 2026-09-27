"use strict";

/*
 * What a trailing slash asks of a selection: that the name is not a file.
 * After a symbolic link it is a statement about where the link leads, as it
 * is to the filesystem, so the link is followed to check it.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { destination } = require("../../../src/core/plan.js");
const { fixture, calls, DEFAULTS } = require("../../helpers.cjs");

const directory = { kind: "directory" };
const file = { kind: "file" };
const folderAction = (folder) => ({ defaultFolderAction: folder, defaultLinkAction: "TARGET" });
const selected = (path, slashed = false) => ({ path, slashed });

test("a path that ended in / cannot name a file or a Finder alias", () => {
    for (const kind of ["file", "alias"]) {
        const io = fixture({ "/work/item": { kind } });

        assert.throws(
            () => destination(selected("/work/item", true), DEFAULTS, io),
            /^Error: "\/work\/item\/" ends in "\/", but it names a file, not a folder\.$/u,
            kind
        );
        assert.deepEqual(calls(io), ["inspect"], `${kind}: nothing asked, nothing followed`);
    }
});

test("a path that ended in / may name a folder, or a link that leads to one", () => {
    // Foundation spells a URL for a link to a folder with a slash too.
    assert.equal(destination(selected("/work", true), folderAction("INSIDE"), fixture()), "/work");

    const io = fixture({ "/work/link": { kind: "symlink", target: "/work" } });

    assert.equal(destination(selected("/work/link", true), folderAction("INSIDE"), io), "/work");
});

const LEADS_TO_FILE = /^Error: "\/folder\/linkfile\/" ends in "\/", but it leads to a file, not a folder\.$/u;

test("a slashed link that leads to a file is refused, whichever way it would open", () => {
    // The slash is a statement about where the link leads, as it is to the
    // filesystem, so it is checked before the link question is asked.
    for (const link of ["TARGET", "LINK", "ASK"]) {
        const io = fixture({ "/folder": directory, "/folder/file": file, "/folder/linkfile": { kind: "symlink", target: "/folder/file" } });

        assert.throws(
            () => destination(selected("/folder/linkfile", true), { defaultFolderAction: "INSIDE", defaultLinkAction: link }, io),
            LEADS_TO_FILE,
            link
        );
        assert.equal(calls(io).includes("chooseLink"), false, link);
    }
});

test("a slashed link that leads nowhere is refused as missing", () => {
    const io = fixture({ "/folder": directory, "/folder/gone": { kind: "symlink", target: "/folder/missing" } });

    assert.throws(() => destination(selected("/folder/gone", true), DEFAULTS, io), /^Error: No such item: \/folder\/missing$/u);
});

test("a slashed link to a folder is followed once, and then asked about as usual", () => {
    const io = fixture({ "/work/link": { kind: "symlink", target: "/target" }, "/target": directory });

    assert.equal(destination(selected("/work/link", true), DEFAULTS, io), "/target");
    assert.equal(calls(io).filter((name) => name === "readLink").length, 1, "read once, for the check and the answer");
    assert.deepEqual(calls(io).filter((name) => name.startsWith("choose")), ["chooseLink", "chooseFolderMode"]);
});

test("a slashed link to a folder may still open where the link sits", () => {
    const io = fixture({ "/work/link": { kind: "symlink", target: "/target" }, "/target": directory }, {
        chooseLink: () => "LINK"
    });

    assert.equal(destination(selected("/work/link", true), DEFAULTS, io), "/work");
});

test("without a slash, a link to a file or to nothing is not followed unless chosen", () => {
    const io = fixture({ "/work/gone": { kind: "symlink", target: "/missing" } }, { chooseLink: () => "LINK" });

    assert.equal(destination(selected("/work/gone"), DEFAULTS, io), "/work");
    assert.equal(calls(io).includes("readLink"), false);
});

test("a slashed link that leads to a Finder alias is refused, as the alias itself would be", () => {
    // An alias is a file to the filesystem, even one that points at a folder.
    const io = fixture({
        "/w": directory,
        "/w/link": { kind: "symlink", target: "/w/alias" },
        "/w/alias": { kind: "alias", target: "/target" },
        "/target": directory
    });

    assert.throws(
        () => destination(selected("/w/link", true), folderAction("INSIDE"), io),
        /^Error: "\/w\/link\/" ends in "\/", but it leads to a file, not a folder\.$/u
    );
    assert.equal(calls(io).includes("resolveAlias"), false, "the alias is not followed");
});

test("a slashed chain of links is followed in order to the folder at its end", () => {
    const io = fixture({
        "/w": directory,
        "/w/a": { kind: "symlink", target: "b" },
        "/w/b": { kind: "symlink", target: "/target" },
        "/target": directory
    });

    assert.equal(destination(selected("/w/a", true), folderAction("INSIDE"), io), "/target");
});

test("a slashed link in a cycle is refused as a cycle", () => {
    const io = fixture({ "/w": directory, "/w/loop": { kind: "symlink", target: "/w/loop" } });

    assert.throws(() => destination(selected("/w/loop", true), DEFAULTS, io), /Too many symbolic links, or a link cycle/u);
});
