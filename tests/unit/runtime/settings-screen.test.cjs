"use strict";

/*
 * The settings as lists: every setting with what it is set to, then the
 * picked one's values with the current one selected; Done and Back leave
 * without an answer. Every value the core can offer has words here.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createSettingsScreen, SETTINGS: WORDS, VALUES } = require("../../../src/runtime/settings-screen.js");
const { SETTINGS, KEYS } = require("../../../src/core/settings.js");

// Standard Additions' list, answering with the item at `index`, or backing out.
function lists(index = 0) {
    const asked = [];

    return {
        asked,
        chooseFromList(items, options) {
            asked.push({ items, options });
            return index === null ? false : [items[index]];
        }
    };
}

const ROWS = [
    { key: "terminal", value: "ghostty", saved: "ghostty", available: true },
    { key: "folder", value: "ask", saved: null, available: true },
    { key: "link", value: "stay", saved: "stay", available: true }
];

test("every setting and every value the core offers has words", () => {
    assert.deepEqual(Object.keys(WORDS), KEYS);

    for (const key of ["folder", "link"]) {
        assert.deepEqual(Object.keys(VALUES[key]), SETTINGS[key].values, key);
    }
});

test("the list shows each setting with what it is set to, the first one selected", () => {
    const app = lists(1);

    assert.equal(createSettingsScreen(app).pickSetting(ROWS), "folder");
    assert.deepEqual(app.asked[0], {
        items: ["Terminal app: Ghostty", "When a folder is selected: Ask each time", "When a Finder alias is selected: Open where it is"],
        options: {
            withTitle: "Term At Target Settings",
            withPrompt: "Choose a setting to change:",
            defaultItems: ["Terminal app: Ghostty"],
            okButtonName: "Change…",
            cancelButtonName: "Done",
            multipleSelectionsAllowed: false,
            emptySelectionAllowed: false
        }
    });
});

test("a saved value that is not recognised is shown as that, escaped like any name", () => {
    const app = lists();

    createSettingsScreen(app).pickSetting([
        { key: "terminal", value: null, saved: "xterm", available: true },
        { key: "folder", value: null, saved: new Date("2026-01-01T00:00:00Z"), available: true },
        { key: "link", value: null, saved: "a\u202Eb", available: true }
    ]);
    assert.deepEqual(app.asked[0].items, [
        "Terminal app: not recognised (xterm)",
        "When a folder is selected: not recognised (a date, 2026-01-01T00:00:00.000Z)",
        "When a Finder alias is selected: not recognised (\"a\\u{202E}b\")"
    ]);
});

test("the setting picked last stays selected, and an unknown one selects the first", () => {
    const app = lists(null);
    const screen = createSettingsScreen(app);

    screen.pickSetting(ROWS, "link");
    screen.pickSetting(ROWS, "nothing");
    assert.deepEqual(app.asked.map(({ options }) => options.defaultItems), [
        ["When a Finder alias is selected: Open where it is"], ["Terminal app: Ghostty"]
    ]);
});

test("a terminal app that is not installed says so in its row", () => {
    const app = lists(null);

    createSettingsScreen(app).pickSetting([{ ...ROWS[0], value: "iterm2", saved: "iterm2", available: false }, ...ROWS.slice(1)]);
    assert.equal(app.asked[0].items[0], "Terminal app: iTerm2 (not installed)");
});

test("Done is no setting", () => {
    assert.equal(createSettingsScreen(lists(null)).pickSetting(ROWS), null);
});

test("a setting's values are listed in its words, the current one selected", () => {
    const app = lists(2);

    assert.equal(createSettingsScreen(app).pickValue("folder", ["ask", "inside", "parent"], "inside"), "parent");
    assert.deepEqual(app.asked[0], {
        items: ["Ask each time", "Open inside", "Open in parent"],
        options: {
            withTitle: "When a folder is selected",
            withPrompt: "When a folder is selected:",
            defaultItems: ["Open inside"],
            okButtonName: "Use",
            cancelButtonName: "Back",
            multipleSelectionsAllowed: false,
            emptySelectionAllowed: false
        }
    });
});

test("terminal apps are listed by name, and a link's values in a link's words", () => {
    const terminal = lists(1);
    const link = lists(0);
    const screen = createSettingsScreen(terminal);

    assert.equal(screen.pickValue("terminal", ["terminal", "ghostty"], "terminal"), "ghostty");
    assert.deepEqual(terminal.asked[0].items, ["Terminal", "Ghostty"]);
    assert.equal(terminal.asked[0].options.withPrompt, "Open folders in:");
    assert.equal(createSettingsScreen(link).pickValue("link", ["ask", "follow", "stay"], "ask"), "ask");
    assert.deepEqual(link.asked[0].items, ["Ask each time", "Follow the alias", "Open where it is"]);
    assert.equal(link.asked[0].options.withPrompt, "When a Finder alias is selected:");
});

test("with no current value among those offered, nothing is selected", () => {
    const app = lists(0);

    createSettingsScreen(app).pickValue("terminal", ["terminal"], "ghostty");
    createSettingsScreen(app).pickValue("link", ["ask", "follow", "stay"], null);
    assert.deepEqual(app.asked.map(({ options }) => options.defaultItems), [[], []]);
});

test("Back is no value", () => {
    assert.equal(createSettingsScreen(lists(null)).pickValue("folder", ["ask"], "ask"), null);
});
