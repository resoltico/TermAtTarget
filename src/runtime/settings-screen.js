"use strict";

const { terminalApp } = require("../core/vocabulary.js");
const { presentName } = require("../core/present.js");
const { describeSaved } = require("../core/settings.js");
const { pick } = require("./standard-additions.js");

/*
 * The settings, as Standard Additions lists show them: one list of every
 * setting with what it is set to, the one picked last selected, and for the
 * one picked, a list of its values with the current one selected. "Done"
 * leaves the first list and "Back" the second, neither of them a cancellation.
 *
 * Every value the core offers has words here, or a test fails: a value added
 * to the core without them could not be shown.
 */

const TITLE = "Term At Target Settings";

const SETTINGS = {
    terminal: { label: "Terminal app", prompt: "Open folders in:" },
    folder: { label: "When a folder is selected", prompt: "When a folder is selected:" },
    // Shortcuts resolves a selected symbolic link before the action sees it
    // (measured), so from Finder this setting only ever meets Finder aliases.
    link: { label: "When a Finder alias is selected", prompt: "When a Finder alias is selected:" }
};

const VALUES = {
    folder: { ask: "Ask each time", inside: "Open inside", parent: "Open in parent" },
    link: { ask: "Ask each time", follow: "Follow the alias", stay: "Open where it is" }
};

function valueLabel(key, value) {
    return key === "terminal" ? terminalApp(value).name : VALUES[key][value];
}

// A saved value that is not recognised, shown as text when it is text.
function unrecognised(saved) {
    return typeof saved === "string" ? presentName(saved) : describeSaved(saved);
}

function rowLabel(row) {
    const value = row.value === null ? `not recognised (${unrecognised(row.saved)})` : valueLabel(row.key, row.value);
    const shown = row.available ? value : `${value} (not installed)`;

    return `${SETTINGS[row.key].label}: ${shown}`;
}

// Every setting, with the one picked last (or the first) selected.
function pickSetting(app, rows, focus) {
    const items = rows.map(rowLabel);
    const selected = rows.findIndex((row) => row.key === focus);
    const answer = pick(app, items, {
        withTitle: TITLE,
        withPrompt: "Choose a setting to change:",
        defaultItems: [items[Math.max(selected, 0)]],
        okButtonName: "Change…",
        cancelButtonName: "Done"
    });

    return answer === null ? null : rows[items.indexOf(answer)].key;
}

function pickValue(app, key, values, current) {
    const items = values.map((value) => valueLabel(key, value));
    const answer = pick(app, items, {
        withTitle: SETTINGS[key].label,
        withPrompt: SETTINGS[key].prompt,
        defaultItems: values.includes(current) ? [valueLabel(key, current)] : [],
        okButtonName: "Use",
        cancelButtonName: "Back"
    });

    return answer === null ? null : values[items.indexOf(answer)];
}

function createSettingsScreen(app) {
    return {
        pickSetting: (rows, focus) => pickSetting(app, rows, focus),
        pickValue: (key, values, current) => pickValue(app, key, values, current)
    };
}

module.exports = { createSettingsScreen, SETTINGS, VALUES };
