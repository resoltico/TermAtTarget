"use strict";

/*
 * Where Terminal opens for a file or a folder: a file's own folder, and a
 * folder either inside or at its parent, as configured or as asked.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { destination } = require("../../../src/core/plan.js");
const { fixture, calls, DEFAULTS } = require("../../helpers.cjs");

const directory = { kind: "directory" };
const file = { kind: "file" };
const folderAction = (folder) => ({ defaultFolderAction: folder, defaultLinkAction: "TARGET" });
const selected = (path, slashed = false) => ({ path, slashed });

test("a file opens its containing folder, without asking anything", () => {
    const io = fixture({ "/work/file": file });

    assert.equal(destination(selected("/work/file"), DEFAULTS, io), "/work");
    assert.deepEqual(calls(io), ["inspect"]);
});

test("a folder opens inside or at its parent as configured, without asking", () => {
    assert.equal(destination(selected("/work"), folderAction("INSIDE"), fixture()), "/work");
    assert.equal(destination(selected("/work"), folderAction("LEVEL"), fixture()), "/");

    const io = fixture();

    destination(selected("/work"), folderAction("LEVEL"), io);
    assert.deepEqual(calls(io), ["inspect"]);
});

test("the root is opened without a question, since inside and parent are the same place", () => {
    for (const config of [DEFAULTS, folderAction("LEVEL"), folderAction("INSIDE")]) {
        const io = fixture();

        assert.equal(destination(selected("/"), config, io), "/");
        assert.deepEqual(calls(io), ["inspect"]);
    }
});

test("asked, the answer decides, and the question says the folder was selected", () => {
    const io = fixture();

    assert.equal(destination(selected("/work"), DEFAULTS, io), "/work");
    assert.deepEqual(io.events.at(-1), ["chooseFolderMode", "/work", null]);

    io.chooseFolderMode = () => "LEVEL";
    assert.equal(destination(selected("/work"), DEFAULTS, io), "/");
});

test("an answer that is neither inside nor parent is refused", () => {
    const io = fixture({}, { chooseFolderMode: () => "bad" });

    assert.throws(() => destination(selected("/work"), DEFAULTS, io), /^Error: Invalid folder-location choice\.$/u);
});

test("choosing a folder opens inside it, even when folders open at their parent", () => {
    const io = fixture();

    assert.equal(destination(null, folderAction("LEVEL"), io), "/work");
    assert.deepEqual(calls(io), ["chooseFolder", "path"]);
});

test("the chosen folder is held to the path rules", () => {
    const io = fixture({}, { chooseFolder: () => "relative" });

    assert.throws(() => destination(null, DEFAULTS, io), /absolute POSIX path/u);
});

test("a kind that is neither file, folder, alias nor link is refused", () => {
    const io = fixture({ "/odd": { kind: "unknown" } });

    assert.throws(() => destination(selected("/odd"), DEFAULTS, io), /^Error: The selected item's type could not be determined\.$/u);
});

test("a missing item is reported as missing", () => {
    assert.throws(() => destination(selected("/missing"), DEFAULTS, fixture()), /^Error: No such item: \/missing$/u);
});

test("without a slash, a file is a file", () => {
    assert.equal(destination(selected("/work/file"), DEFAULTS, fixture({ "/work/file": file })), "/work");
    assert.equal(destination(selected("/work", false), folderAction("INSIDE"), fixture({ "/work": directory })), "/work");
});
