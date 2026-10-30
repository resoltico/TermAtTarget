"use strict";

const { selectedPath, parentPath } = require("./paths.js");
const { selectionOf } = require("./invocation.js");
const { isCancellation, refusal } = require("./errors.js");
const { destination } = require("./plan.js");
const { START, SETUP, terminalApp } = require("./vocabulary.js");
const { KEYS, HOW_TO_CHANGE, knownSetting, settingsFrom } = require("./settings.js");
const { editSettings } = require("./settings-editor.js");

/*
 * One run: read what was selected and the saved settings, decide where the
 * terminal app opens, check it is still a folder that can be entered, and ask
 * the app to open there. A run given nothing first asks whether to choose a
 * folder or change the settings -- or, when a saved setting is not recognised
 * or the chosen app is not installed, says so and offers only the settings,
 * which is how either is put right.
 *
 * The host is a set of ports: `files`, the filesystem; `preferences`, the
 * saved settings; `terminals`, the apps; `questions(name)`, the questions,
 * worded for the app they are about (null when it is not known yet); and
 * `settingsScreen`, the settings list.
 *
 * Runs are independent apart from the settings: nothing else is written and
 * no state is kept. A cancelled question ends the run quietly; anything else
 * thrown is thrown on as itself, even a value that is falsy.
 */

function setupOf(saved, terminals) {
    if (KEYS.some((key) => knownSetting(key, saved[key]) === null)) {
        return SETUP.UNRECOGNISED;
    }

    return terminals.isInstalled(knownSetting("terminal", saved.terminal)) ? SETUP.READY : SETUP.MISSING;
}

function wantsSettings(saved, host) {
    const setup = setupOf(saved, host.terminals);
    const terminal = terminalApp(knownSetting("terminal", saved.terminal));
    const choice = host.questions(terminal?.name ?? null).start(setup);
    const offered = setup === SETUP.READY ? [START.CHOOSE, START.SETTINGS] : [START.SETTINGS];

    if (!offered.includes(choice)) {
        throw new Error("Invalid start choice.");
    }

    return choice === START.SETTINGS;
}

function installed(id, terminals) {
    const terminal = terminalApp(id);

    if (!terminals.isInstalled(id)) {
        throw refusal(`${terminal.name} isn't installed`, `${terminal.name} is the terminal app in Term At Target's ` +
            `settings, but macOS cannot find it. Install it, or choose another app. ${HOW_TO_CHANGE} If you've just ` +
            "installed it, open it once from Applications, then try again.");
    }

    return terminal;
}

/*
 * A folder an app that expands variables would read as somewhere else. When
 * the folder it is in has no "$", that one would open, and the message says so.
 */
function assertLiteral(terminal, path) {
    if (terminal.readsVariables && path.includes("$")) {
        const way = parentPath(path).includes("$")
            ? `Choose another terminal app for this folder. ${HOW_TO_CHANGE}`
            : `Its parent folder has no "$", so ${terminal.name} can open that: choose Open in Parent, or choose another terminal app. ${HOW_TO_CHANGE}`;

        throw refusal(`${terminal.name} can't open this folder`, `${terminal.name} reads "$" in a folder's path as the ` +
            `start of a variable, so it would open somewhere other than ${JSON.stringify(path)}. ${way}`);
    }
}

function open(selection, saved, host) {
    const settings = settingsFrom(saved);
    const terminal = installed(settings.terminal, host.terminals);
    const path = destination(selection, settings, host.files, host.questions(terminal.name));

    host.files.validateDirectory(path);
    assertLiteral(terminal, path);
    host.terminals.launch(terminal.id, path);
}

function execute(input, host) {
    const selection = selectedPath(selectionOf(input), (value) => host.files.pathOf(value));
    const saved = host.preferences.load();

    try {
        if (selection === null && wantsSettings(saved, host)) {
            editSettings(saved, host.settingsScreen, host.preferences, host.terminals);
        } else {
            open(selection, saved, host);
        }
    } catch (error) {
        if (isCancellation(error)) {
            return [];
        }

        throw error;
    }

    return [];
}

module.exports = { execute };
