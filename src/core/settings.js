"use strict";

const { FOLDER, LINK, TERMINALS, terminalApp } = require("./vocabulary.js");
const { escapeInvisible } = require("./present.js");
const { refuse } = require("./outcomes.js");
const { render } = require("./messages.js");

/*
 * The settings: each one's values, and the value it has until one is saved.
 *
 * What was saved arrives as found -- null where nothing is saved, otherwise
 * whatever the preferences held, which need not be text. A value that is not
 * one of a setting's own is an error, not a reason to fall back silently: the
 * run says which setting it is and how to change it.
 */

const optionLabel = (locale, value) => render(locale, `answer.${value}.option`);

const SETTINGS = Object.freeze({
    terminal: Object.freeze({
        values: Object.freeze(TERMINALS.map((terminal) => terminal.id)),
        initial: "terminal",
        requiresInstalled: true,
        valueLabel: (locale, value) => terminalApp(value).name
    }),
    folder: Object.freeze({
        values: Object.freeze(Object.values(FOLDER)), initial: FOLDER.ASK, requiresInstalled: false, valueLabel: optionLabel
    }),
    link: Object.freeze({
        values: Object.freeze(Object.values(LINK)), initial: LINK.ASK, requiresInstalled: false, valueLabel: optionLabel
    })
});

const KEYS = Object.freeze(Object.keys(SETTINGS));

// What a saved value stands for, or null when it is not one of the setting's.
function knownSetting(key, saved) {
    if (saved === null) {
        return SETTINGS[key].initial;
    }

    return SETTINGS[key].values.includes(saved) ? saved : null;
}

/*
 * A saved value as a person can recognise it: text quoted, numbers and lists
 * as written, a date as a date, and anything JSON cannot show -- data, say --
 * by what it is rather than as "{}".
 */
function describeSaved(saved, locale) {
    if (saved instanceof Date) {
        return render(locale, "saved.date", { value: saved.toISOString() });
    }

    const plain = saved === null || ["undefined", "string", "number", "boolean"].includes(typeof saved) || Array.isArray(saved) ||
        Object.getPrototypeOf(saved) === Object.prototype;

    return plain ? String(JSON.stringify(saved)) : render(locale, "saved.opaque");
}

// Every setting, from what was saved, or the first one that is not recognised.
function settingsFrom(saved) {
    return Object.freeze(Object.fromEntries(KEYS.map((key) => {
        const value = knownSetting(key, saved[key]);

        if (value === null) {
            throw refuse("settingUnrecognised", { setting: key, saved: saved[key] });
        }

        return [key, value];
    })));
}

function formatSaved(saved, locale) {
    return escapeInvisible(describeSaved(saved, locale));
}

const settingLabel = (locale, key) => render(locale, `settings.${key}.label`);
const valueLabel = (locale, key, value) => SETTINGS[key].valueLabel(locale, value);

module.exports = { SETTINGS, KEYS, knownSetting, settingsFrom, formatSaved, settingLabel, valueLabel };
