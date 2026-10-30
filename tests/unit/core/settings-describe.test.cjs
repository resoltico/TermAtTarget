"use strict";

/*
 * A saved value that is not recognised, described so a person can recognise
 * it: text quoted, numbers and lists as written, a date as a date, and
 * anything JSON cannot show by what it is rather than as "{}".
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { describeSaved, settingsFrom } = require("../../../src/core/settings.js");
const { NOTHING_SAVED } = require("../../helpers.cjs");

test("text, numbers, truth values, lists and dictionaries are shown as written", () => {
    assert.equal(describeSaved("LEVEL"), "\"LEVEL\"");
    assert.equal(describeSaved(""), "\"\"");
    assert.equal(describeSaved(3), "3");
    assert.equal(describeSaved(true), "true");
    assert.equal(describeSaved(["inside"]), "[\"inside\"]");
    assert.equal(describeSaved({ key: "b" }), "{\"key\":\"b\"}");
    assert.equal(describeSaved(null), "null");
    assert.equal(describeSaved(undefined), "undefined");
});

test("a date is a date", () => {
    assert.equal(describeSaved(new Date("2026-01-01T00:00:00Z")), "a date, 2026-01-01T00:00:00.000Z");
});

test("anything else -- data, a native object -- is said to be not text, never {}", () => {
    class NativeData {}

    assert.equal(describeSaved(new NativeData()), "a value that is not text");
    assert.equal(describeSaved(Object.create(null)), "a value that is not text");
});

test("the refusal uses the same description", () => {
    assert.throws(() => settingsFrom({ ...NOTHING_SAVED, folder: new Date("2026-01-01T00:00:00Z") }),
        /^Error: The saved folder setting, a date, 2026-01-01T00:00:00\.000Z, is not one of/u);
});
