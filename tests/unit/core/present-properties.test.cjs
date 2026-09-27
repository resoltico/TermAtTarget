"use strict";

/*
 * For every name: what is shown never carries a character that could hide or
 * move text outside visible writing, a name is plain exactly when nothing in
 * it needs showing, no two different names are shown as the same text, and an
 * emoji joined from pictographs always stays as it is.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const fc = require("fast-check");
const { presentName } = require("../../../src/core/present.js");

const cp = (...points) => String.fromCodePoint(...points);

// Characters that could mislead, drawn on purpose alongside anything at all.
const RISKY = fc.constantFrom(
    "\n", "\t", cp(0), cp(0x7F), cp(0x85), cp(0xA0), cp(0xAD), cp(0x34F), cp(0x61C), cp(0x200B), cp(0x200D),
    cp(0x200E), cp(0x2028), cp(0x202E), cp(0x2066), cp(0xFE0F), cp(0xFEFF), cp(0x3164), cp(0xE0041), " ", "\"", "\\"
);
const NAME = fc.array(fc.oneof(fc.string({ unit: "grapheme", maxLength: 3 }), RISKY), { minLength: 1 })
    .map((parts) => parts.join(""))
    .filter((name) => name.length > 0);

// Never kept, in any context: these only ever hide or move text.
const ALWAYS_SHOWN = /(?![\t\n\r])[\p{Cc}\p{Zl}\p{Zp}\p{Bidi_Control}]|\u034F|[\u00AD\u115F\u1160\u3164\uFEFF\u200B\u2060-\u2064]/u;

test("nothing that only hides or moves text is ever shown unescaped", () => {
    fc.assert(fc.property(NAME, (name) => {
        assert.equal(ALWAYS_SHOWN.test(presentName(name)), false, JSON.stringify(name));
    }));
});

test("a name is shown plainly only when it holds nothing to show", () => {
    fc.assert(fc.property(NAME, (name) => {
        const shown = presentName(name);

        if (shown === name) {
            assert.equal(ALWAYS_SHOWN.test(name) || name.startsWith("\"") || name.startsWith(" ") || name.endsWith(" "), false);
        } else {
            assert.ok(shown.startsWith("\"") && shown.endsWith("\""), JSON.stringify(shown));
        }
    }));
});

test("two different names are never shown as the same text", () => {
    fc.assert(fc.property(NAME, NAME, (first, second) => {
        fc.pre(first !== second);
        assert.notEqual(presentName(first), presentName(second));
    }));
});

// Recommended emoji of every kind: joined, flags, keycaps, skin tones, tags.
const EMOJI = fc.constantFrom(
    cp(0x1F469, 0x200D, 0x1F4BB), cp(0x1F468, 0x200D, 0x1F469, 0x200D, 0x1F467), cp(0x1F1F1, 0x1F1FB),
    cp(0x31, 0xFE0F, 0x20E3), cp(0x1F44D, 0x1F3FD), cp(0x1F3F4, 0xE0067, 0xE0062, 0xE0073, 0xE0063, 0xE0074, 0xE007F),
    cp(0x2764, 0xFE0F, 0x200D, 0x1F525), cp(0x1F3F3, 0xFE0F, 0x200D, 0x1F308)
);

test("recommended emoji among ordinary words stay exactly as they are", () => {
    const WORDS = fc.string({ maxLength: 5 }).filter((text) => !/["\s\\]/u.test(text) && !/\p{Cc}/u.test(text));

    fc.assert(fc.property(WORDS, fc.array(EMOJI, { minLength: 1, maxLength: 3 }), WORDS, (before, emoji, after) => {
        const name = `${before}${emoji.join("")}${after}`;

        assert.equal(presentName(name), name, JSON.stringify(name));
    }));
});
