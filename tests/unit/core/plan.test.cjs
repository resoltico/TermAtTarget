"use strict";

/*
 * Where the terminal app opens for a file or a folder: a file's own folder, and a
 * folder either inside or at its parent, as configured or as asked.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { destination } = require("../../../src/core/plan.js");
const { fixture, calls, DEFAULTS } = require("../../helpers.cjs");

const directory = { kind: "directory" };
const file = { kind: "file" };
const folderAction = (folder) => ({ ...DEFAULTS, folder, link: "follow" });
const selected = (path, slashed = false) => ({ path, slashed });
// The plan asks the filesystem and the person through one fixture.
const ports = (io) => [io, io];

test("a file opens its containing folder, without asking anything", () => {
    const io = fixture({ "/work/file": file });

    assert.equal(destination(selected("/work/file"), DEFAULTS, ...ports(io)), "/work");
    assert.deepEqual(calls(io), ["inspect"]);
});

test("a folder opens inside or at its parent as configured, without asking", () => {
    assert.equal(destination(selected("/work"), folderAction("inside"), ...ports(fixture())), "/work");
    assert.equal(destination(selected("/work"), folderAction("parent"), ...ports(fixture())), "/");

    const io = fixture();

    destination(selected("/work"), folderAction("parent"), ...ports(io));
    assert.deepEqual(calls(io), ["inspect"]);
});

test("the root is opened without a question, since inside and parent are the same place", () => {
    for (const config of [DEFAULTS, folderAction("parent"), folderAction("inside")]) {
        const io = fixture();

        assert.equal(destination(selected("/"), config, ...ports(io)), "/");
        assert.deepEqual(calls(io), ["inspect"]);
    }
});

test("asked, the answer decides, and the question says the folder was selected", () => {
    const io = fixture();

    assert.equal(destination(selected("/work"), DEFAULTS, ...ports(io)), "/work");
    assert.deepEqual(io.events.at(-1), ["chooseFolderMode", "/work", null]);

    io.chooseFolderMode = () => "parent";
    assert.equal(destination(selected("/work"), DEFAULTS, ...ports(io)), "/");
});

test("an answer that is neither inside nor parent is refused", () => {
    const io = fixture({}, { chooseFolderMode: () => "bad" });

    assert.throws(() => destination(selected("/work"), DEFAULTS, ...ports(io)), /^Error: Invalid folder-location choice\.$/u);
});

test("choosing a folder opens inside it, even when folders open at their parent", () => {
    const io = fixture();

    assert.equal(destination(null, folderAction("parent"), ...ports(io)), "/work");
    assert.deepEqual(calls(io), ["chooseFolder", "path"]);
});

test("the chosen folder is held to the path rules", () => {
    const io = fixture({}, { chooseFolder: () => "relative" });

    assert.throws(() => destination(null, DEFAULTS, ...ports(io)), /absolute POSIX path/u);
});

test("a kind that is neither file, folder, alias nor link is refused", () => {
    const io = fixture({ "/odd": { kind: "unknown" } });

    assert.throws(() => destination(selected("/odd"), DEFAULTS, ...ports(io)), /^Error: The selected item's type could not be determined\.$/u);
});

test("a missing item is reported as missing", () => {
    assert.throws(() => destination(selected("/missing"), DEFAULTS, ...ports(fixture())), /^Error: No such item: \/missing$/u);
});

test("without a slash, a file is a file", () => {
    assert.equal(destination(selected("/work/file"), DEFAULTS, ...ports(fixture({ "/work/file": file }))), "/work");
    assert.equal(destination(selected("/work", false), folderAction("inside"), ...ports(fixture({ "/work": directory }))), "/work");
});

test("the filesystem is asked through files, and the person through ask", () => {
    const fs = fixture({ "/work/a": { kind: "alias", target: "/work" } });
    const person = fixture();

    assert.equal(destination(selected("/work/a"), DEFAULTS, fs, person), "/work");
    assert.deepEqual(calls(fs), ["inspect", "inspect", "resolveAlias", "inspect"]);
    assert.deepEqual(calls(person), ["chooseLink", "chooseFolderMode"]);
});
