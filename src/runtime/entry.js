"use strict";

const { execute } = require("../core/workflow.js");
const { createMacHost } = require("./host.js");
const { createFoundation } = require("./foundation.js");
const { createPreferences } = require("./preferences.js");
const { supervise } = require("./supervise.js");
const { createQuestions } = require("./questions.js");
const { createFailureReport } = require("./failure-report.js");
const { presentName } = require("../core/present.js");

/*
 * A run that fails is told in an alert and then ends, so Shortcuts has
 * nothing more to say about it. If the alert cannot be shown, the failure is
 * thrown as itself, for Shortcuts to show instead.
 */
function run(input) {
    const host = createMacHost();

    try {
        return execute(input, host);
    } catch (error) {
        try {
            host.report(error);
        } catch {
            throw error;
        }

        return [];
    }
}

/*
 * createMacHost, and the parts under `forNativeTests`, are for the native
 * suite, which appends its own entry point to a temporary copy and drives the
 * real adapters: the package question (asked only by a dialog), saved
 * settings in a domain of its own, so a person's own settings are never
 * touched, the supervisor with commands other than open, the questions and
 * the failure alert themselves, shown by Standard Additions with a time limit
 * so nobody has to answer, and the name presentation, whose Unicode tables are the engine's
 * own. Nothing in a production run reaches them except through run().
 */
module.exports = {
    run, createMacHost, execute,
    forNativeTests: { createFoundation, createPreferences, supervise, createQuestions, createFailureReport, presentName }
};
