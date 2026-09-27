"use strict";

/*
 * How names and paths are shown in a question: plainly when nothing in them
 * is invisible, and otherwise quoted, with every invisible character written
 * out -- except where an invisible character is how visible text is written.
 * Every character outside ASCII is built from its code point here, so this
 * file holds none of the characters it is about.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { presentName, presentPath, presentLocation } = require("../../../src/core/present.js");

const cp = (...points) => String.fromCodePoint(...points);
const ZWJ = cp(0x200D);

test("an ordinary name or path is shown as it is", () => {
    for (const text of ["Projects-2026-archive", `caf${cp(0xE9)} ${cp(0x1F600)}`, "a b", "back\\slash", "it's", `O${cp(0x308)}`]) {
        assert.equal(presentName(text), text, text);
    }

    assert.equal(presentPath("/Users/you/Downloads"), "/Users/you/Downloads");
    assert.equal(presentPath("/"), "/");
});

test("recommended emoji are shown as the one symbol they are", () => {
    const emoji = [
        `Work ${cp(0x1F469)}${ZWJ}${cp(0x1F4BB)}`,
        `${cp(0x1F468)}${ZWJ}${cp(0x1F469)}${ZWJ}${cp(0x1F467)}`,
        cp(0x1F1F1, 0x1F1FB),
        `1${cp(0xFE0F, 0x20E3)}`,
        cp(0x1F44D, 0x1F3FD),
        cp(0x1F3F4, 0xE0067, 0xE0062, 0xE0073, 0xE0063, 0xE0074, 0xE007F),
        `${cp(0x2764, 0xFE0F)}${ZWJ}${cp(0x1F525)}`
    ];

    for (const name of emoji) {
        assert.equal(presentName(name), name, JSON.stringify(name));
    }
});

test("two emoji with a joiner that makes no emoji show the joiner", () => {
    // A pizza and a dog are drawn separately; the joiner between them is invisible.
    assert.equal(presentName(`${cp(0x1F355)}${ZWJ}${cp(0x1F436)}`), `"${cp(0x1F355)}\\u{200D}${cp(0x1F436)}"`);
    assert.equal(presentName(`${cp(0x1F469)}${ZWJ}`), `"${cp(0x1F469)}\\u{200D}"`);
});

test("tags that make no flag are shown", () => {
    assert.equal(presentName(cp(0x1F600, 0xE0061, 0xE0062, 0xE0063, 0xE007F)),
        `"${cp(0x1F600)}\\u{E0061}\\u{E0062}\\u{E0063}\\u{E007F}"`);
    assert.equal(presentName(`a${cp(0xE0041)}`), "\"a\\u{E0041}\"");
});

test("a defined variation sequence is shown as written", () => {
    // Emoji variation sequences, a standardized variant, and an ideographic one.
    for (const name of [`1${cp(0xFE0F)}`, `#${cp(0xFE0E)}`, `*${cp(0xFE0F)}`, cp(0x2764, 0xFE0E), cp(0x2229, 0xFE00), cp(0x845B, 0xE0100)]) {
        assert.equal(presentName(name), name, JSON.stringify(name));
    }
});

test("a selector after a character it is not defined for is shown", () => {
    for (const [name, shown] of [
        [`pa${cp(0xFE0F)}yments`, "\"pa\\u{FE0F}yments\""],
        [`${cp(0xFE0F)}a`, "\"\\u{FE0F}a\""],
        [cp(0x628, 0xFE00), `"${cp(0x628)}\\u{FE00}"`],
        [`a${cp(0xE0100)}`, "\"a\\u{E0100}\""]
    ]) {
        assert.equal(presentName(name), shown, JSON.stringify(name));
    }
});

test("a joiner where a script's shaping calls for one is shown as written", () => {
    const written = [
        cp(0x915, 0x94D, 0x200D, 0x937),
        cp(0x915, 0x94D, 0x200C, 0x937),
        cp(0x628, 0x64E, 0x200C, 0x628),
        cp(0x645, 0x6CC, 0x200C, 0x62E, 0x648, 0x627, 0x647, 0x645)
    ];

    for (const name of written) {
        assert.equal(presentName(name), name, JSON.stringify(name));
    }
});

test("a joiner anywhere else is shown", () => {
    for (const [name, shown] of [
        [`pay${ZWJ}ments`, "\"pay\\u{200D}ments\""],
        [cp(0x627, 0x200C, 0x628), `"${cp(0x627)}\\u{200C}${cp(0x628)}"`],
        [`${cp(0x915)}${ZWJ}${cp(0x937)}`, `"${cp(0x915)}\\u{200D}${cp(0x937)}"`],
        [`${ZWJ}${cp(0x937)}`, `"\\u{200D}${cp(0x937)}"`]
    ]) {
        assert.equal(presentName(name), shown, JSON.stringify(name));
    }
});

test("soft hyphens, grapheme joiners, fillers and direction marks are shown escaped", () => {
    for (const [point, code] of [[0xAD, "00AD"], [0x34F, "034F"], [0x3164, "3164"], [0x115F, "115F"], [0x202E, "202E"],
        [0x2066, "2066"], [0x200B, "200B"], [0x200E, "200E"], [0x61C, "061C"], [0x2060, "2060"], [0xFEFF, "FEFF"]]) {
        assert.equal(presentName(`pay${cp(point)}ments`), `"pay\\u{${code}}ments"`, code);
    }
});

test("line breaks, controls, separators and unusual spaces are shown escaped", () => {
    assert.equal(presentName("a\nb"), "\"a\\u{000A}b\"");
    assert.equal(presentName("a\tb"), "\"a\\u{0009}b\"");
    assert.equal(presentName(`a${cp(0x1)}`), "\"a\\u{0001}\"");
    assert.equal(presentName(`a${cp(0x7F)}`), "\"a\\u{007F}\"");
    assert.equal(presentName(`a${cp(0x85)}`), "\"a\\u{0085}\"");
    assert.equal(presentName(`a${cp(0x2028)}b`), "\"a\\u{2028}b\"");
    assert.equal(presentName(`a${cp(0xA0)}b`), "\"a\\u{00A0}b\"");
    assert.equal(presentName(`a${cp(0x3000)}b`), "\"a\\u{3000}b\"");
});

test("a space at either end of any component is shown in quotes, so it can be seen", () => {
    assert.equal(presentName(" a"), "\" a\"");
    assert.equal(presentName("a "), "\"a \"");
    assert.equal(presentPath("/Users/ you/x"), "\"/Users/ you/x\"");
    assert.equal(presentPath("/Users/you /x"), "\"/Users/you /x\"");
    assert.equal(presentPath("/Users/y ou/x"), "/Users/y ou/x", "a space inside a name is ordinary");
});

test("inside quotes, a quote and a backslash are escaped, so the quotes stay whole", () => {
    assert.equal(presentName("\"a\\b\n"), "\"\\\"a\\\\b\\u{000A}\"");
    assert.equal(presentName("\"a"), "\"\\\"a\"");
});

test("a quote anywhere but the start is ordinary text", () => {
    assert.equal(presentName("a\""), "a\"");
    assert.equal(presentName("say \"hi\""), "say \"hi\"");
});

test("a location is the item's name and the folder it is in, each shown", () => {
    assert.deepEqual(presentLocation("/Users/you/Downloads/Projects"), { name: "Projects", parent: "/Users/you/Downloads" });
    assert.deepEqual(presentLocation("/top"), { name: "top", parent: "/" });
    assert.deepEqual(presentLocation("/a\nb/c"), { name: "c", parent: "\"/a\\u{000A}b\"" });
});
