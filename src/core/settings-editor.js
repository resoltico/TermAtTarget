"use strict";

const { SETTINGS, KEYS, knownSetting } = require("./settings.js");

/*
 * Changing the settings, one at a time, until the person is done.
 *
 * Each turn shows every setting with what it stands for -- null for a saved
 * value that is not recognised, so it can be shown as that and replaced --
 * with the one last picked still selected, and a change is saved as soon as
 * it is made. Only an installed terminal app
 * is offered. Every answer is checked against what was offered before anything
 * is saved: what is saved outlives the run.
 */

// Each setting, with whether its value can be used: a terminal app must be installed.
function rowsOf(saved, terminals) {
    return KEYS.map((key) => {
        const value = knownSetting(key, saved[key]);
        const available = key !== "terminal" || value === null || terminals.isInstalled(value);

        return { key, value, saved: saved[key], available };
    });
}

function valuesFor(key, terminals) {
    if (key !== "terminal") {
        return SETTINGS[key].values;
    }

    const installed = SETTINGS.terminal.values.filter((id) => terminals.isInstalled(id));

    if (installed.length === 0) {
        throw new Error("None of the terminal apps Term At Target can open is installed.");
    }

    return installed;
}

function invalidAnswer() {
    return new Error("The settings list returned an invalid answer.");
}

// One setting changed and saved, or left as it was when the person backs out.
function change(key, current, ports) {
    if (!KEYS.includes(key)) {
        throw invalidAnswer();
    }

    const values = valuesFor(key, ports.terminals);
    const value = ports.screen.pickValue(key, values, knownSetting(key, current[key]));

    if (value === null) {
        return;
    }

    if (!values.includes(value)) {
        throw invalidAnswer();
    }

    ports.preferences.save(key, value);
    current[key] = value;
}

function editSettings(saved, screen, preferences, terminals) {
    const current = { ...saved };

    const rows = () => rowsOf(current, terminals);

    for (let key = screen.pickSetting(rows(), KEYS[0]); key !== null; key = screen.pickSetting(rows(), key)) {
        change(key, current, { screen, preferences, terminals });
    }
}

module.exports = { editSettings };
