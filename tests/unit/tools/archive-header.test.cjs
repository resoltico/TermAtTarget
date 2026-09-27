"use strict";

/*
 * One member's header: its fields where ustar puts them, and every name or
 * number that would not fit, or would extract somewhere else, refused.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { Buffer } = require("node:buffer");

const load = () => import("../../../tools/tar-header.mjs");
const field = (header, offset, width) => header.subarray(offset, offset + width).toString("latin1");

test("the fixed fields say root owns a 0644 file of this size and time", async () => {
    const { tarHeader } = await load();
    const header = tarHeader("dir/name", 10, 8);
    const fields = [[0, 9], [100, 8], [108, 16], [124, 12], [136, 12], [156, 1], [257, 8], [265, 5], [297, 5]];

    assert.equal(header.length, 512);
    assert.deepEqual(fields.map(([offset, width]) => field(header, offset, width)), [
        "dir/name\0",
        "0000644\0",
        "0000000\u00000000000\0",
        "00000000012\0",
        "00000000010\0",
        "0",
        "ustar\u000000",
        "root\0",
        "root\0"
    ]);
});

test("the checksum is the header's byte sum with its own field as spaces", async () => {
    const { tarHeader } = await load();
    const header = tarHeader("a", 0, 0);
    const recorded = field(header, 148, 8);
    const blanked = Buffer.from(header);

    blanked.fill(0x20, 148, 156);

    const sum = blanked.reduce((total, byte) => total + byte, 0);

    assert.equal(recorded, `${sum.toString(8).padStart(6, "0")}\0 `);
});

test("a name longer than its field is split at a folder into prefix and name", async () => {
    const { tarHeader } = await load();
    const folder = "d".repeat(120);
    const header = tarHeader(`${folder}/file`, 0, 0);

    assert.equal(field(header, 0, 5), "file\0");
    assert.equal(field(header, 345, 121), `${folder}\0`);
});

test("a name exactly as long as its field is kept whole", async () => {
    const { tarHeader } = await load();
    const name = `d/${"x".repeat(98)}`;

    assert.equal(field(tarHeader(name, 0, 0), 0, 100), name);
});

test("a name that could extract anywhere but beneath the archive is refused", async () => {
    const { tarHeader } = await load();

    for (const name of ["/absolute", "../outside", "a\\b", "a/../b", "a/./b", "a//b", "a/", "", "a\0b", ".", ".."]) {
        assert.throws(() => tarHeader(name, 0, 0), /^Error: Unsafe archive member name\.$/u, JSON.stringify(name));
    }
});

test("a long name with no folder to split at is refused", async () => {
    const { tarHeader } = await load();

    assert.throws(() => tarHeader("x".repeat(101), 0, 0), /^Error: Archive member name is too long\.$/u);
});

test("a name or prefix too long for its field is refused, naming it", async () => {
    const { tarHeader } = await load();
    const long = "x".repeat(101);

    assert.throws(() => tarHeader(`a/${long}`, 0, 0), new RegExp(`^Error: Archive header field exceeds its limit: ${long}$`, "u"));
    assert.throws(() => tarHeader(`${"x".repeat(156)}/b`, 0, 0), /field exceeds its limit/u);
});

test("a size or time that is not a whole, nonnegative number is refused", async () => {
    const { tarHeader } = await load();

    for (const [size, time] of [[-1, 0], [0, 1.5], [0, -1], [Number.NaN, 0]]) {
        assert.throws(() => tarHeader("a", size, time), /^Error: Invalid archive numeric field\.$/u, `${size} ${time}`);
    }
});

test("a number too wide for its field is refused, and the widest that fits is kept", async () => {
    const { tarHeader } = await load();

    assert.throws(() => tarHeader("a", 0o100000000000, 0), /^Error: Archive numeric field exceeds its limit\.$/u);
    assert.equal(field(tarHeader("a", 0o77777777777, 0), 124, 12), "77777777777\0");
});
