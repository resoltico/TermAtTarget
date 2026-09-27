"use strict";

/*
 * The encoded Unicode tables, decoded and searched. The encoder that writes
 * them is tools/unicode/ranges.mjs; the two are tested against each other.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const fc = require("fast-check");
const sets = require("../../../src/core/unicode-sets.js");

test("an empty table is empty, and a table of one point is that point", () => {
    assert.deepEqual(sets.decode(""), []);
    assert.deepEqual(sets.decode("0"), [[0, 0]]);
    assert.deepEqual(sets.decode("a.2,3"), [[10, 12], [16, 16]]);
});

test("search finds each range's ends and nothing either side", () => {
    const ranges = [[10, 12], [16, 16], [100, 200]];

    for (const point of [10, 11, 12, 16, 100, 150, 200]) {
        assert.equal(sets.contains(ranges, point), true, String(point));
    }

    for (const point of [0, 9, 13, 15, 17, 99, 201]) {
        assert.equal(sets.contains(ranges, point), false, String(point));
    }

    assert.equal(sets.contains([], 0), false);
    assert.equal(sets.contains(ranges, undefined), false, "past either end of a text");
    assert.equal(sets.contains(ranges, Number.NaN), false);
    assert.equal(sets.contains(ranges, 10.5), false);
});

test("whatever the encoder writes, the decoder reads back as the same set", async () => {
    const { encodeRanges, normalise } = await import("../../../tools/unicode/ranges.mjs");
    const RANGE = fc.tuple(fc.integer({ min: 0, max: 0x10FFFF }), fc.integer({ min: 0, max: 300 }))
        .map(([first, length]) => ({ first, last: Math.min(first + length, 0x10FFFF) }));

    fc.assert(fc.property(fc.array(RANGE, { maxLength: 30 }), (ranges) => {
        const expected = normalise(ranges).map(({ first, last }) => [first, last]);

        assert.deepEqual(sets.decode(encodeRanges(ranges)), expected);
    }));
});

test("the tables are Unicode 17's", () => {
    assert.equal(sets.UNICODE_VERSION, "17.0.0");
});
