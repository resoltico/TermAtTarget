"use strict";

const { readSelection } = require("./shortcuts-input.js");
const { execute } = require("../core/workflow.js");
const { createMacHost } = require("./host.js");

const QUIET_OUTCOMES = new Set(["opened", "cancelled", "settingsClosed"]);

function finish(outcome) {
    if (outcome.kind === "refused") {
        throw outcome.refusal;
    }

    if (!QUIET_OUTCOMES.has(outcome.kind)) {
        throw new TypeError(`Unrecognised workflow outcome: ${outcome.kind}.`);
    }
}

/*
 * A run that fails is told in an alert and then ends, so Shortcuts has
 * nothing more to say about it. If the alert cannot be shown, the failure is
 * thrown as itself, for Shortcuts to show instead.
 */
function run(input) {
    const host = createMacHost();

    try {
        finish(execute(readSelection(input, host.files), host));
    } catch (error) {
        try {
            host.report(error);
        } catch {
            throw error;
        }
    }

    return [];
}

module.exports = { run };
