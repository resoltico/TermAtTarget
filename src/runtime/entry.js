"use strict";

const { execute } = require("../core/workflow.js");
const { createMacHost } = require("./host.js");
const { createFoundation } = require("./foundation.js");
const { supervise } = require("./supervise.js");
const { createDialogs } = require("./dialogs.js");
const { presentName } = require("../core/present.js");
const config = require("#config");

function run(input) {
    return execute(input, config, createMacHost());
}

/*
 * createMacHost, and the parts under `forNativeTests`, are for the native
 * suite, which appends its own entry point to a temporary copy and drives the
 * real adapters: the package question (asked only by a dialog), the
 * supervisor with commands other than open, the questions themselves, shown
 * by Standard Additions with a time limit so nobody has to answer, and the
 * name presentation, whose Unicode tables are the engine's own. Nothing in a
 * production run reaches them except through run().
 */
module.exports = { run, createMacHost, execute, forNativeTests: { createFoundation, supervise, createDialogs, presentName } };
