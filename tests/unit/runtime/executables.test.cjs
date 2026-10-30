"use strict";

/*
 * Everything the action runs, asks for or writes to. The gate refuses an
 * executable path named anywhere else under src/, so this list is the whole
 * of it.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const executables = require("../../../src/runtime/executables.js");
const { TERMINALS } = require("../../../src/core/vocabulary.js");

test("the action runs open, from where macOS ships it, and writes one preferences domain", () => {
    assert.deepEqual(Object.keys(executables), ["OPEN", "TERMINAL_BUNDLES", "PREFERENCES_DOMAIN"]);
    assert.equal(executables.OPEN, "/usr/bin/open");
    assert.equal(executables.PREFERENCES_DOMAIN, "com.resoltico.TermAtTarget");
});

test("every terminal app the core knows has a bundle identifier, and no other app has one", () => {
    assert.deepEqual(executables.TERMINAL_BUNDLES, {
        terminal: "com.apple.Terminal", ghostty: "com.mitchellh.ghostty", iterm2: "com.googlecode.iterm2",
        kitty: "net.kovidgoyal.kitty"
    });
    assert.deepEqual(Object.keys(executables.TERMINAL_BUNDLES), TERMINALS.map((terminal) => terminal.id));
    assert.ok(Object.isFrozen(executables.TERMINAL_BUNDLES));
});
