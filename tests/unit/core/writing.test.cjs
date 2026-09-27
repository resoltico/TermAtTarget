"use strict";

/*
 * When an invisible character is part of visible writing, by the standard
 * each exception cites. Every character outside ASCII is built from its code
 * point, so this file holds none of the characters it is about.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { emojiMatcher, emojiPositions, isWriting } = require("../../../src/core/writing.js");

const points = (...values) => values;
const at = (values, index) => isWriting(values, index);

test("the emoji pattern is the engine's own recommended set, found globally", () => {
    const matcher = emojiMatcher();

    assert.equal(matcher.flags, "gv");
    assert.equal(matcher.source, "\\p{RGI_Emoji}");
});

// A RegExp from an engine that has no `v` flag.
function Refusing() {
    throw new SyntaxError("Invalid flags supplied to RegExp constructor 'gv'");
}

test("an engine without the v flag gets no emoji exception, and still loads", () => {
    assert.equal(emojiMatcher(Refusing), null);
    assert.deepEqual([...emojiPositions([..."null"], null)], [], "not a search for the text null");
});

test("positions are counted in code points, not UTF-16 units", () => {
    const characters = [...`x${String.fromCodePoint(0x1F469, 0x200D, 0x1F4BB)}y`];

    assert.deepEqual([...emojiPositions(characters, emojiMatcher())], [1, 2, 3]);
});

test("a joiner or non-joiner directly after a virama is writing", () => {
    assert.equal(at(points(0x915, 0x94D, 0x200D, 0x937), 2), true);
    assert.equal(at(points(0x915, 0x94D, 0x200C, 0x937), 2), true);
    assert.equal(at(points(0x94D, 0x200D), 1), true, "what follows does not matter");
});

test("a joiner with no virama before it is not", () => {
    assert.equal(at(points(0x915, 0x200D, 0x937), 1), false);
    assert.equal(at(points(0x200D, 0x937), 0), false);
    assert.equal(at(points(0x628, 0x200D, 0x628), 1), false, "a ZWJ between Arabic letters changes nothing");
});

test("a non-joiner between a left- and a right-joining letter is writing", () => {
    assert.equal(at(points(0x628, 0x200C, 0x628), 1), true);
    assert.equal(at(points(0x6CC, 0x200C, 0x62E), 1), true);
    assert.equal(at(points(0x628, 0x200C, 0x627), 1), true, "ALEF joins to the right");
});

test("transparent marks either side of the non-joiner are looked past", () => {
    assert.equal(at(points(0x628, 0x64E, 0x200C, 0x628), 2), true);
    assert.equal(at(points(0x628, 0x200C, 0x64E, 0x651, 0x628), 1), true);
});

test("a non-joiner that cannot separate a joining pair is not writing", () => {
    assert.equal(at(points(0x627, 0x200C, 0x628), 1), false, "ALEF does not join to the left");
    assert.equal(at(points(0x628, 0x200C, 0x61), 1), false, "a Latin letter does not join");
    assert.equal(at(points(0x200C, 0x628), 0), false, "nothing before it");
    assert.equal(at(points(0x628, 0x200C), 1), false, "nothing after it");
    assert.equal(at(points(0x628, 0x64E, 0x200C), 2), false, "only marks after it");
});

test("a selector is writing only in a defined sequence", () => {
    assert.equal(at(points(0x31, 0xFE0F), 1), true);
    assert.equal(at(points(0x2764, 0xFE0E), 1), true);
    assert.equal(at(points(0x2229, 0xFE00), 1), true);
    assert.equal(at(points(0x845B, 0xE0100), 1), true);
    assert.equal(at(points(0x845B, 0xE01EF), 1), true, "the last ideographic variation selector");
    assert.equal(at(points(0x628, 0xFE00), 1), false);
    assert.equal(at(points(0x61, 0xFE0F), 1), false);
    assert.equal(at(points(0x61, 0xE0100), 1), false);
    assert.equal(at(points(0xFE0F, 0x61), 0), false, "nothing before it");
    assert.equal(at(points(0xE0100, 0x845B), 0), false, "an ideographic selector with nothing before it");
});

test("characters that are neither joiners nor selectors are not writing", () => {
    assert.equal(at(points(0x61, 0xAD, 0x62), 1), false);
    assert.equal(at(points(0x61, 0x200B, 0x62), 1), false);
    assert.equal(at(points(0x845B, 0xE01F0), 1), false, "just past the ideographic selectors");
});
