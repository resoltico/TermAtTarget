"use strict";

const { selectionOf } = require("./shortcuts-input.js");
const { execute } = require("../core/workflow.js");
const { createMacHost } = require("./host.js");

/*
 * A run that fails is told in an alert and then ends, so Shortcuts has
 * nothing more to say about it. If the alert cannot be shown, the failure is
 * thrown as itself, for Shortcuts to show instead.
 */
function run(input) {
    const host = createMacHost();

    try {
        const outcome = execute(selectionOf(input), host);

        if (outcome.kind === "refused") {
            throw outcome.refusal;
        }
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
