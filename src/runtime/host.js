"use strict";

const { createFoundation } = require("./foundation.js");
const { createDialogs } = require("./dialogs.js");
const { createLauncher } = require("./launcher.js");

/*
 * The real host: the macOS answers the planning core asks for, built from the
 * JXA globals once per run.
 */

// A fresh Objective-C out-parameter. Why this is $() and not Ref() is in
// bridge.js: the Ref() form crashes osascript on macOS.
function outParameter() {
    return $();
}

// Seconds since the Mac started: a clock no wall-clock change can move.
function now() {
    return $.NSProcessInfo.processInfo.systemUptime;
}

function createMacHost() {
    ObjC.import("Foundation");

    const app = Application.currentApplication();

    app.includeStandardAdditions = true;

    const bridge = { ns: $, objc: ObjC, outParameter, now };
    const files = createFoundation(bridge);
    const dialogs = createDialogs(app, files);

    return {
        pathOf: files.pathOf,
        inspect: files.inspect,
        resolveAlias: files.resolveAlias,
        readLink: files.readLink,
        validateDirectory: files.validateDirectory,
        chooseFolder: dialogs.chooseFolder,
        chooseLink: dialogs.chooseLink,
        chooseFolderMode: dialogs.chooseFolderMode,
        launch: createLauncher(bridge, files)
    };
}

module.exports = { createMacHost };
