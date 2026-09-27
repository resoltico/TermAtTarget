"use strict";

/*
 * Everything the action runs or asks for. The gate refuses an executable path named
 * anywhere else under src/, so this list is the whole of it.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const executables = require("../../../src/runtime/executables.js");

test("the action runs open, from where macOS ships it, for Terminal by its identifier, and nothing else", () => {
    assert.deepEqual(executables, { OPEN: "/usr/bin/open", TERMINAL: "com.apple.Terminal" });
});
