"use strict";

const { SOURCE_LOCALE } = require("../core/messages.js");
const { rowLabel, settingLabel, settingPrompt, valueLabel } = require("../core/settings.js");
const { pick } = require("./standard-additions.js");

const TITLE = "Term At Target Settings";
function pickSetting(app, rows, focus) {
    const items = rows.map((row) => rowLabel(SOURCE_LOCALE, row));
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
    const items = values.map((value) => valueLabel(SOURCE_LOCALE, key, value));
    const answer = pick(app, items, {
        withTitle: settingLabel(SOURCE_LOCALE, key),
        withPrompt: settingPrompt(SOURCE_LOCALE, key),
        defaultItems: values.includes(current) ? [valueLabel(SOURCE_LOCALE, key, current)] : [],
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

module.exports = { createSettingsScreen };
