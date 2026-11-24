"use strict";

const { SOURCE_LOCALE, render } = require("./messages.js");
const { CHANGE_SETTINGS, isFault, isRefusal, remediesOf } = require("./outcomes.js");
const { FOLDER, LINK, terminalApp } = require("./vocabulary.js");
const { answerLabel } = require("./questions.js");
const { SETTINGS, formatSaved, valueLabel } = require("./settings.js");
const { presentName, presentPath } = require("./present.js");

const say = (id, params) => render(SOURCE_LOCALE, id, params);

function externalDetail(error) {
    const text = error && typeof error.message === "string" ? error.message : String(error);
    return presentName(text);
}

function nativeMessage({ operation, path, domain, code, description }) {
    const message = say(`native.${operation}.message`, { path: presentPath(path) });
    const detail = description === null
        ? say("native.noDetails")
        : say("native.message", { domain: presentName(domain), code, description: presentName(description) });

    return `${message} ${detail}`;
}

function launchPending({ terminal, path, cause, stopped, pid, cleanup }) {
    const detail = cause === null
        ? say("launchUnconfirmed.deadline")
        : say("launchUnconfirmed.lost", { cause: externalDetail(cause.failure) });
    const sentences = [say("launchUnconfirmed.message", { terminal, path }), detail];

    if (!stopped) {
        sentences.push(pid === null ? say("launchUnconfirmed.unstopped") : say("launchUnconfirmed.pid", { pid }));
    }

    return [...sentences, ...cleanup.map((failure) =>
        say("launchUnconfirmed.cleanup", { detail: externalDetail(failure) }))].join(" ");
}

// Prepare only the named values each catalog entry requires.
const REFUSAL_MESSAGES = {
    settingUnrecognised({ setting, saved }) {
        return say("settingUnrecognised.message", {
            setting,
            saved: formatSaved(saved, SOURCE_LOCALE),
            values: SETTINGS[setting].values.join(", ")
        });
    },
    terminalReadsVariables({ terminal, path }) {
        return say("terminalReadsVariables.message", { terminal, path });
    },
    aliasTargetMissing({ native }) {
        const option = valueLabel(SOURCE_LOCALE, "link", LINK.STAY);
        return `${nativeMessage(native)} ${say("aliasTargetMissing.message", { option })}`;
    },
    selectionMissing: ({ path, native }) => `${say("selectionMissing.message", { path })} ${nativeMessage(native)}`,
    linkTargetMissing: ({ path, native }) => `${say("linkTargetMissing.message", { path })} ${nativeMessage(native)}`,
    destinationMissing: ({ path, native }) => `${say("destinationMissing.message", { path })} ${nativeMessage(native)}`,
    launchUnconfirmed: launchPending
};

const FAULT_MESSAGES = {
    native: nativeMessage,
    fileMissing: nativeMessage,
    aliasUnresolved: nativeMessage,
    invalidAnswer: () => say("invalidAnswer.message"),
    tooManyAnswers: () => say("tooManyAnswers.message")
};

function presentParams(params) {
    const shown = { ...params };

    if (Object.hasOwn(shown, "path")) {
        shown.path = presentPath(shown.path);
    }

    if (Object.hasOwn(shown, "terminal")) {
        shown.terminal = terminalApp(shown.terminal).name;
    }

    return shown;
}

function refusalHeading(kind, params) {
    switch (kind) {
        case "settingUnrecognised":
            return say(`${kind}.summary`, { setting: params.setting });
        case "terminalMissing":
        case "terminalReadsVariables":
        case "launchFailed":
            return say(`${kind}.summary`, { terminal: params.terminal });
        default:
            return say(`${kind}.summary`);
    }
}

const REMEDY_MESSAGES = {
    [FOLDER.PARENT]: ({ terminal }) => say("terminalReadsVariables.parent", {
        terminal, action: answerLabel(SOURCE_LOCALE, FOLDER.PARENT)
    }),
    [LINK.STAY]: () => say("rerunWithLinkLocation", { action: answerLabel(SOURCE_LOCALE, LINK.STAY) }),
    [CHANGE_SETTINGS]: () => say("settings.changeHint")
};

function refusalDetails(refusal) {
    const { kind } = refusal;
    const params = presentParams(refusal.params);
    const message = Object.hasOwn(REFUSAL_MESSAGES, kind)
        ? REFUSAL_MESSAGES[kind](params)
        : say(`${kind}.message`, params);
    const remedies = remediesOf(refusal).map((remedy) => REMEDY_MESSAGES[remedy](params));

    return { heading: refusalHeading(kind, params), message: [message, ...remedies].join(" ") };
}

function failureReport(error) {
    if (isRefusal(error)) {
        return refusalDetails(error);
    }

    if (isFault(error)) {
        const { kind, params } = error;
        const message = Object.hasOwn(FAULT_MESSAGES, kind)
            ? FAULT_MESSAGES[kind](params)
            : say(`${kind}.message`, presentParams(params));

        return { heading: say("failure.heading"), message };
    }

    return { heading: say("failure.heading"), message: externalDetail(error) };
}

module.exports = { failureReport };
