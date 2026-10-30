"use strict";

const { FOLDER, LINK, TERMINALS } = require("./vocabulary.js");
const { refusal } = require("./errors.js");

/*
 * The settings: each one's values, and the value it has until one is saved.
 *
 * What was saved arrives as found -- null where nothing is saved, otherwise
 * whatever the preferences held, which need not be text. A value that is not
 * one of a setting's own is an error, not a reason to fall back silently: the
 * run says which setting it is and how to change it.
 */

const SETTINGS = Object.freeze({
    terminal: Object.freeze({ values: Object.freeze(TERMINALS.map((terminal) => terminal.id)), initial: "terminal" }),
    folder: Object.freeze({ values: Object.freeze(Object.values(FOLDER)), initial: FOLDER.ASK }),
    link: Object.freeze({ values: Object.freeze(Object.values(LINK)), initial: LINK.ASK })
});

const KEYS = Object.freeze(Object.keys(SETTINGS));

// How a person reaches the settings, said wherever a setting needs changing.
const HOW_TO_CHANGE = "Run Term At Target with nothing selected to change its settings.";

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
function describeSaved(saved) {
    if (saved instanceof Date) {
        return `a date, ${saved.toISOString()}`;
    }

    const plain = saved === null || ["undefined", "string", "number", "boolean"].includes(typeof saved) || Array.isArray(saved) ||
        Object.getPrototypeOf(saved) === Object.prototype;

    return plain ? String(JSON.stringify(saved)) : "a value that is not text";
}

function unrecognised(key, saved) {
    return refusal(`The ${key} setting isn't recognised`, `The saved ${key} setting, ${describeSaved(saved)}, ` +
        `is not one of ${SETTINGS[key].values.join(", ")}. ${HOW_TO_CHANGE}`);
}

// Every setting, from what was saved, or the first one that is not recognised.
function settingsFrom(saved) {
    return Object.freeze(Object.fromEntries(KEYS.map((key) => {
        const value = knownSetting(key, saved[key]);

        if (value === null) {
            throw unrecognised(key, saved[key]);
        }

        return [key, value];
    })));
}

module.exports = { SETTINGS, KEYS, HOW_TO_CHANGE, knownSetting, settingsFrom, describeSaved };
