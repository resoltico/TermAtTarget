"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { SETTINGS, KEYS, knownSetting, settingsFrom, formatSaved } = require("../../../src/core/settings.js");
const { FOLDER, LINK, START, TERMINALS, terminalApp } = require("../../../src/core/vocabulary.js");
const { NOTHING_SAVED } = require("../../helpers.cjs");

/*
 * The settings and the words they share: each setting's values, the value
 * it has until one is saved, and a saved value that is not recognised refused
 * by name rather than replaced.
 */

test("the values are the stored format, spelled once", () => {
    // Renaming one would turn every saved copy into an unrecognised value.
    assert.deepEqual(FOLDER, { ASK: "ask", INSIDE: "inside", PARENT: "parent" });
    assert.deepEqual(LINK, { ASK: "ask", FOLLOW: "follow", STAY: "stay" });
    assert.deepEqual(START, { CHOOSE: "choose", SETTINGS: "settings" });
    assert.deepEqual(TERMINALS, [
        { id: "terminal", name: "Terminal", readsVariables: false },
        { id: "ghostty", name: "Ghostty", readsVariables: false },
        { id: "iterm2", name: "iTerm2", readsVariables: false },
        { id: "kitty", name: "kitty", readsVariables: true }
    ]);
    assert.deepEqual(KEYS, ["terminal", "folder", "link"]);
});

test("each setting takes the values its vocabulary gives, and none is shared by accident", () => {
    assert.deepEqual(SETTINGS.terminal.values, ["terminal", "ghostty", "iterm2", "kitty"]);
    assert.deepEqual(SETTINGS.folder.values, ["ask", "inside", "parent"]);
    assert.deepEqual(SETTINGS.link.values, ["ask", "follow", "stay"]);
});

test("the vocabulary cannot be changed by whoever reads it", () => {
    for (const frozen of [FOLDER, LINK, START, TERMINALS, TERMINALS[0], SETTINGS, SETTINGS.folder, SETTINGS.folder.values, KEYS]) {
        assert.ok(Object.isFrozen(frozen));
    }
});

test("a terminal app is found by its id, and anything else is none", () => {
    assert.equal(terminalApp("ghostty").name, "Ghostty");
    assert.equal(terminalApp("Ghostty"), null);
    assert.equal(terminalApp(null), null);
});

test("with nothing saved, Terminal opens and every choice is asked", () => {
    const settings = settingsFrom(NOTHING_SAVED);

    assert.deepEqual(settings, { terminal: "terminal", folder: "ask", link: "ask" });
    assert.ok(Object.isFrozen(settings));
});

test("a saved value is taken as saved", () => {
    assert.deepEqual(settingsFrom({ terminal: "ghostty", folder: "parent", link: "stay" }),
        { terminal: "ghostty", folder: "parent", link: "stay" });
});

test("a value that is not one of the setting's is refused with the setting, the value and the way out", () => {
    assert.throws(() => settingsFrom({ ...NOTHING_SAVED, folder: "LEVEL" }), { kind: "settingUnrecognised", params: { setting: "folder", saved: "LEVEL" } });
    assert.throws(() => settingsFrom({ ...NOTHING_SAVED, terminal: 3 }), { kind: "settingUnrecognised", params: { setting: "terminal", saved: 3 } });
    assert.throws(() => settingsFrom({ ...NOTHING_SAVED, link: ["stay"] }), { kind: "settingUnrecognised", params: { setting: "link", saved: ["stay"] } });
    assert.throws(() => settingsFrom({ terminal: null, folder: null }), { kind: "settingUnrecognised", params: { setting: "link", saved: undefined } });
});

test("the first unrecognised setting is the one reported", () => {
    assert.throws(() => settingsFrom({ terminal: "x", folder: "y", link: "z" }), { kind: "settingUnrecognised", params: { setting: "terminal", saved: "x" } });
});

test("a known setting is what a saved value stands for, or null when it stands for nothing", () => {
    assert.equal(knownSetting("folder", null), "ask");
    assert.equal(knownSetting("terminal", null), "terminal");
    assert.equal(knownSetting("folder", "inside"), "inside");
    assert.equal(knownSetting("folder", "follow"), null, "another setting's value is not this one's");
    assert.equal(knownSetting("link", ""), null);
});

/*
 * A saved value that is not recognised, described so a person can recognise
 * it: text quoted, numbers and lists as written, a date as a date, and
 * anything JSON cannot show by what it is rather than as "{}".
 */

test("text, numbers, truth values, lists and dictionaries are shown as written", () => {
    assert.equal(formatSaved("LEVEL"), "\"LEVEL\"");
    assert.equal(formatSaved(""), "\"\"");
    assert.equal(formatSaved(3), "3");
    assert.equal(formatSaved(true), "true");
    assert.equal(formatSaved(["inside"]), "[\"inside\"]");
    assert.equal(formatSaved({ key: "b" }), "{\"key\":\"b\"}");
    assert.equal(formatSaved(null), "null");
    assert.equal(formatSaved(undefined), "undefined");
});

test("a date is a date", () => {
    assert.equal(formatSaved(new Date("2026-01-01T00:00:00Z")), "a date, 2026-01-01T00:00:00.000Z");
});

test("anything else -- data, a native object -- is said to be not text, never {}", () => {
    class NativeData {}

    assert.equal(formatSaved(new NativeData()), "a value that is not text");
    assert.equal(formatSaved(Object.create(null)), "a value that is not text");
});

test("the refusal uses the same description", () => {
    const saved = new Date("2026-01-01T00:00:00Z");
    assert.throws(() => settingsFrom({ ...NOTHING_SAVED, folder: saved }), { kind: "settingUnrecognised", params: { setting: "folder", saved } });
});

test("malformed saved text stays quoted and distinguishable after escaping", () => {
    for (const [saved, expected] of [
        ["123", '"123"'],
        [123, "123"],
        ["", '""'],
        ["a\u202Eb", '"a\\u{202E}b"'],
        ["a\\u{202E}b", '"a\\\\u{202E}b"'],
        [["a\u202Eb"], '["a\\u{202E}b"]']
    ]) {
        assert.equal(formatSaved(saved, "en"), expected);
    }
});
