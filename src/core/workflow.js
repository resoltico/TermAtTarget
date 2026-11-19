"use strict";

const { selectedPath } = require("./paths.js");
const { isCancellation, isRefusal, refuse, withMissingFile } = require("./outcomes.js");
const { askAnswer, startQuestion } = require("./questions.js");
const { destination } = require("./plan.js");
const { START, SETUP, terminalApp } = require("./vocabulary.js");
const { KEYS, knownSetting, settingsFrom } = require("./settings.js");
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
 * saved settings; `terminals`, the apps; `ask` and `chooseFolder`, the questions; and
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
    return askAnswer(startQuestion(terminal?.name ?? null, setup), host.ask) === START.SETTINGS;
}

function installed(id, terminals) {
    const terminal = terminalApp(id);

    if (!terminals.isInstalled(id)) {
        throw refuse("terminalMissing", { terminal: id });
    }

    return terminal;
}

// An alternative is advice only. If its validation fails, omit the advice.
function usableParent(path, files) {
    if (path === null || path.includes("$")) {
        return false;
    }

    try {
        files.validateDirectory(path);
        return true;
    } catch {
        return false;
    }
}

function assertLiteral(terminal, plan, files) {
    if (terminal.readsVariables && plan.path.includes("$")) {
        throw refuse("terminalReadsVariables", {
            terminal: terminal.id, path: plan.path, parentOfferedAndUsable: usableParent(plan.offeredParent, files)
        });
    }
}

function open(selection, saved, host) {
    const settings = settingsFrom(saved);
    const terminal = installed(settings.terminal, host.terminals);
    const request = { terminal: terminal.name, ask: host.ask, chooseFolder: () => host.chooseFolder(terminal.name) };
    const plan = destination(selection, settings, host.files, request);
    const { path } = plan;

    withMissingFile(() => host.files.validateDirectory(path), (native) => refuse("destinationMissing", { path, native }));
    assertLiteral(terminal, plan, host.files);
    host.terminals.launch(terminal.id, path);
    return { kind: "opened", terminal: terminal.id, path };
}

function runSelection(input, host) {
    const selection = selectedPath(input, (value) => host.files.pathOf(value));
    const saved = host.preferences.load();

    if (selection === null && wantsSettings(saved, host)) {
        editSettings(saved, host.settingsScreen, host.preferences, host.terminals);
        return { kind: "settingsClosed" };
    }

    return open(selection, saved, host);
}

function execute(input, host) {
    try {
        return runSelection(input, host);
    } catch (error) {
        if (isCancellation(error)) {
            return { kind: "cancelled" };
        }

        if (isRefusal(error)) {
            return { kind: "refused", refusal: error };
        }

        throw error;
    }
}

module.exports = { execute };
