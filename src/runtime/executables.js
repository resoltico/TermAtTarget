"use strict";

/*
 * Everything outside this script the action runs or asks for, and nothing
 * else.
 *
 * The action's whole external surface is this file: tools/lint refuses an
 * absolute executable path named anywhere else under src/. The program ships
 * with macOS, so nothing here is installed, downloaded or looked up on PATH.
 */

// Opens an application at a directory, given as an argument, not a command.
const OPEN = "/usr/bin/open";

// Terminal, named by its bundle identifier: a display name could match some
// other application called Terminal.
const TERMINAL = "com.apple.Terminal";

module.exports = { OPEN, TERMINAL };
