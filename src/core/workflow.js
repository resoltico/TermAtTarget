"use strict";

const { validateConfig } = require("./config.js");
const { selectedPath } = require("./paths.js");
const { selectionOf } = require("./invocation.js");
const { isCancellation } = require("./errors.js");
const { destination } = require("./plan.js");

/*
 * One run: read what was selected, decide where Terminal opens, check it is
 * still a folder that can be entered, and ask Terminal to open there.
 *
 * Runs are independent. Nothing is shared between them -- no file is written
 * and no state is kept -- so there is nothing for one run to wait on or guard
 * against another. A cancelled question ends the run quietly; anything else
 * thrown is thrown on as itself, even a value that is falsy.
 */
function execute(input, rawConfig, host) {
    const config = validateConfig(rawConfig);
    const selection = selectedPath(selectionOf(input), (value) => host.pathOf(value));

    try {
        const path = destination(selection, config, host);

        host.validateDirectory(path);
        host.launch(path);
    } catch (error) {
        if (isCancellation(error)) {
            return [];
        }

        throw error;
    }

    return [];
}

module.exports = { execute };
