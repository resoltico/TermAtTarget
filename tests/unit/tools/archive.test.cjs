"use strict";

/*
 * The source archive: the same bytes from the same files, readable by an
 * independent tar, with every file's contents exactly as they were.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { Buffer } = require("node:buffer");
const { gunzipSync } = require("node:zlib");
const { spawnSync } = require("node:child_process");
const { mkdtemp, writeFile, readFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");

const load = () => import("../../../tools/archive.mjs");
const WHEN = 1790006400;
const ENTRIES = [
    { name: "project/.github/config.yml", bytes: "name: quality\n" },
    { name: "project/file.txt", bytes: Buffer.from([0, 255, 10, 42]) },
    { name: "project/exact-block", bytes: Buffer.alloc(512, 7) },
    { name: "project/empty", bytes: "" },
    { name: `project/${"directory/".repeat(12)}file`, bytes: "long path\n" }
];

test("the same files make the same archive, in whatever order they are given", async () => {
    const { archiveOf } = await load();

    assert.deepEqual(archiveOf(ENTRIES, WHEN), archiveOf([...ENTRIES].reverse(), WHEN));
});

test("the archive is whole ustar blocks, closed by two empty ones", async () => {
    const { archiveOf } = await load();
    const tar = gunzipSync(archiveOf(ENTRIES, WHEN));

    assert.equal(tar.length % 512, 0);
    assert.equal(tar.subarray(257, 263).toString("latin1"), "ustar\0");
    assert.deepEqual(tar.subarray(-1024), Buffer.alloc(1024));
});

test("members are in name order, by code unit", async () => {
    const { archiveOf } = await load();
    const tar = gunzipSync(archiveOf([{ name: "b", bytes: "" }, { name: "B", bytes: "" }, { name: "a", bytes: "" }], 0));
    const names = [0, 512, 1024].map((offset) => tar.subarray(offset, offset + 1).toString());

    assert.deepEqual(names, ["B", "a", "b"]);
});

test("system tar reads every file back byte for byte", async () => {
    // An independent parser, not the encoder under test.
    const { archiveOf } = await load();
    const temp = await mkdtemp(path.join(tmpdir(), "term-at-target-tar-test-"));

    test.after(() => rm(temp, { recursive: true, force: true }));

    const file = path.join(temp, "archive.tar.gz");

    await writeFile(file, archiveOf(ENTRIES, WHEN));

    const extracted = spawnSync("tar", ["-xzf", file, "-C", temp], { encoding: "utf8" });

    assert.equal(extracted.status, 0, extracted.stderr);

    const read = await Promise.all(ENTRIES.map((entry) => readFile(path.join(temp, entry.name))));

    assert.deepEqual(read, ENTRIES.map((entry) => Buffer.from(entry.bytes)));
});

test("a name given twice is refused, naming it", async () => {
    const { archiveOf } = await load();

    assert.throws(
        () => archiveOf([{ name: "a", bytes: "" }, { name: "b", bytes: "" }, { name: "a", bytes: "x" }], 0),
        /^Error: Duplicate archive member: a$/u
    );
});
