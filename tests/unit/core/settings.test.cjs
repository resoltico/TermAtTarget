"use strict";

/*
 * The settings and the words they share: each setting's values, the value
 * it has until one is saved, and a saved value that is not recognised refused
 * by name rather than replaced.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { SETTINGS, KEYS, knownSetting, settingsFrom } = require("../../../src/core/settings.js");
const { FOLDER, LINK, START, TERMINALS, terminalApp } = require("../../../src/core/vocabulary.js");
const { NOTHING_SAVED } = require("../../helpers.cjs");

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
    assert.throws(() => settingsFrom({ ...NOTHING_SAVED, folder: "LEVEL" }), (error) => {
        assert.equal(error.message, "The saved folder setting, \"LEVEL\", is not one of ask, inside, parent. " +
            "Run Term At Target with nothing selected to change its settings.");
        assert.equal(error.summary, "The folder setting isn't recognised");

        return true;
    });
    assert.throws(() => settingsFrom({ ...NOTHING_SAVED, terminal: 3 }), /^Error: The saved terminal setting, 3, is not one of terminal, ghostty, iterm2, kitty\./u);
    assert.throws(() => settingsFrom({ ...NOTHING_SAVED, link: ["stay"] }), /^Error: The saved link setting, \["stay"\], is not one/u);
    assert.throws(() => settingsFrom({ terminal: null, folder: null }), /^Error: The saved link setting, undefined, is not one/u);
});

test("the first unrecognised setting is the one reported", () => {
    assert.throws(() => settingsFrom({ terminal: "x", folder: "y", link: "z" }), /saved terminal setting, "x"/u);
});

test("a known setting is what a saved value stands for, or null when it stands for nothing", () => {
    assert.equal(knownSetting("folder", null), "ask");
    assert.equal(knownSetting("terminal", null), "terminal");
    assert.equal(knownSetting("folder", "inside"), "inside");
    assert.equal(knownSetting("folder", "follow"), null, "another setting's value is not this one's");
    assert.equal(knownSetting("link", ""), null);
});
