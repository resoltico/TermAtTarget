"use strict";

/*
 * Everything outside this script the action runs, asks for or writes to, and
 * nothing else.
 *
 * The action's whole external surface is this file: tools/lint refuses an
 * absolute executable path named anywhere else under src/. The program ships
 * with macOS, so nothing here is installed, downloaded or looked up on PATH.
 */

// Opens an application at a directory, given as an argument, not a command.
const OPEN = "/usr/bin/open";

/*
 * Each terminal app in src/core/vocabulary.js, by its bundle identifier. A
 * display name could match some other application with the same name; an
 * identifier is the vendor's, and stays the same however the app was
 * installed -- from the vendor, or by a Homebrew cask, which installs the
 * vendor's own app -- and wherever it was put.
 */
const TERMINAL_BUNDLES = Object.freeze({
    terminal: "com.apple.Terminal",
    ghostty: "com.mitchellh.ghostty",
    iterm2: "com.googlecode.iterm2",
    kitty: "net.kovidgoyal.kitty"
});

// Where the settings are saved: the preferences domain `defaults` reads.
const PREFERENCES_DOMAIN = "com.resoltico.TermAtTarget";

module.exports = { OPEN, TERMINAL_BUNDLES, PREFERENCES_DOMAIN };
