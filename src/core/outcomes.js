"use strict";

const { FOLDER, LINK } = require("./vocabulary.js");

const CHANGE_SETTINGS = "changeSettings";
const NATIVE_DETAILS = ["operation", "path", "domain", "code", "description"];

const REFUSALS = Object.freeze({
    pathNotText: [],
    pathNotLocalURL: [],
    pathEncodedSeparator: [],
    pathBadEncoding: [],
    pathRelative: [],
    pathDotComponent: [],
    multipleSelection: [],
    slashedFile: ["path"],
    slashedLinkToFile: ["path"],
    tooManyLinks: ["path"],
    linkThroughFile: ["path"],
    linkCycle: ["path"],
    settingUnrecognised: ["setting", "saved"],
    noTerminalInstalled: [],
    terminalMissing: ["terminal"],
    terminalReadsVariables: ["terminal", "path", "parentOfferedAndUsable"],
    selectionMissing: ["path", "native"],
    linkTargetMissing: ["path", "native", "stayOffered"],
    destinationMissing: ["path", "native"],
    itemGone: [],
    unusableInput: [],
    aliasTargetMissing: ["native", "stayOffered"],
    aliasTargetNotLocal: ["path"],
    destinationGone: ["path"],
    destinationNotEnterable: ["path"],
    launchUnconfirmed: ["terminal", "path", "cause", "stopped", "pid", "cleanup"],
    launchFailed: ["terminal", "path", "status"]
});

const FAULTS = Object.freeze({
    invalidAnswer: ["question"],
    tooManyAnswers: ["question"],
    duplicateLabels: [],
    unknownItemKind: ["path"],
    relativeResolutionPath: ["path"],
    native: NATIVE_DETAILS,
    fileMissing: NATIVE_DETAILS,
    aliasUnresolved: NATIVE_DETAILS,
    preferencesUnavailable: ["domain"],
    missingFileType: ["path"],
    missingResourceValue: ["path"]
});

const NATIVE_OPERATIONS = Object.freeze({
    INSPECT: "inspect",
    READ_METADATA: "readMetadata",
    RESOLVE_ALIAS: "resolveAlias",
    READ_LINK: "readLink",
    LAUNCH: "launch"
});

function remediesOf(refusal) {
    const { kind, params } = refusal;

    if (kind === "terminalReadsVariables") {
        return params.parentOfferedAndUsable ? [FOLDER.PARENT, CHANGE_SETTINGS] : [CHANGE_SETTINGS];
    }

    if (kind === "settingUnrecognised" || kind === "terminalMissing") {
        return [CHANGE_SETTINGS];
    }

    if (kind === "aliasTargetMissing") {
        return params.stayOffered ? [LINK.STAY, CHANGE_SETTINGS] : [CHANGE_SETTINGS];
    }

    return params.stayOffered ? [LINK.STAY] : [];
}

class Outcome extends Error {}

function detail(kind, params, declarations) {
    if (!Object.hasOwn(declarations, kind)) {
        throw new RangeError(`Undeclared outcome kind: ${kind}`);
    }

    const names = declarations[kind];

    if (Object.keys(params).length !== names.length || names.some((name) => !Object.hasOwn(params, name))) {
        throw new TypeError(`Wrong parameters for outcome kind: ${kind}`);
    }

    return { kind, params };
}

function refuse(kind, params = {}) {
    return Object.assign(new Outcome(kind), { category: "refusal" }, detail(kind, params, REFUSALS));
}

function fault(kind, params) {
    return Object.assign(new Outcome(kind), { category: "fault" }, detail(kind, params, FAULTS));
}

function cancelled() {
    return Object.assign(new Outcome("Cancelled."), { category: "cancellation" });
}

const isRefusal = (error) => error instanceof Outcome && error.category === "refusal";
const isFault = (error) => error instanceof Outcome && error.category === "fault";
const isCancellation = (error) => error instanceof Outcome && error.category === "cancellation";

function withMissingFile(action, refusalFor) {
    try {
        return action();
    } catch (error) {
        if (isFault(error) && error.kind === "fileMissing") {
            throw refusalFor(error.params);
        }

        throw error;
    }
}

module.exports = {
    REFUSALS, FAULTS, NATIVE_OPERATIONS, CHANGE_SETTINGS, remediesOf,
    refuse, fault, cancelled, isRefusal, isFault, isCancellation, withMissingFile
};
