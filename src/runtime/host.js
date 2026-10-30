"use strict";

const { createFoundation } = require("./foundation.js");
const { createQuestions } = require("./questions.js");
const { createSettingsScreen } = require("./settings-screen.js");
const { createPreferences } = require("./preferences.js");
const { createTerminalApps } = require("./terminal-apps.js");
const { createFailureReport } = require("./failure-report.js");
const { PREFERENCES_DOMAIN } = require("./executables.js");

/*
 * The real host: the ports the core asks through, and the alert a failed run
 * is told in, built from the JXA globals once per run. AppKit is imported for NSWorkspace, which says whether a
 * terminal app is installed.
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
    ObjC.import("AppKit");

    const app = Application.currentApplication();

    app.includeStandardAdditions = true;

    const bridge = { ns: $, objc: ObjC, outParameter, now };
    const files = createFoundation(bridge);

    return {
        files,
        preferences: createPreferences(bridge, PREFERENCES_DOMAIN),
        terminals: createTerminalApps(bridge, files),
        questions: createQuestions(app, files),
        settingsScreen: createSettingsScreen(app),
        report: createFailureReport(app)
    };
}

module.exports = { createMacHost };
