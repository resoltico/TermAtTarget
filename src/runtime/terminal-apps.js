"use strict";

const { refuse, NATIVE_OPERATIONS } = require("../core/outcomes.js");
const { isNil } = require("./bridge.js");
const { OPEN, TERMINAL_BUNDLES } = require("./executables.js");
const { supervise } = require("./supervise.js");

/*
 * The terminal apps: whether one is installed, and opening one at a directory
 * with /usr/bin/open.
 *
 * Both go through Launch Services by bundle identifier, so an app is found
 * wherever it is installed and registered -- /Applications, ~/Applications or
 * elsewhere -- and by whichever route it got there. Measured inside Shortcuts:
 * the lookup answers there too.
 *
 * The directory travels as one argument of four, never inside a command a
 * shell would read: a name with quotes, $, backticks, ; or & in it is a name.
 * Measured on macOS against a directory named with all of them, and an emoji,
 * for Terminal, Ghostty and iTerm2: the shell each starts is in that
 * directory exactly. kitty is too, unless the name holds a "$", which the
 * core never hands it (src/core/vocabulary.js says why).
 *
 * Success means the request was handed to the app, not that a shell is ready.
 * A request still pending at the deadline may yet reach it, so it is reported
 * as that -- never as a plain failure, which would invite a retry.
 */

function isInstalled(bridge, id) {
    const url = bridge.ns.NSWorkspace.sharedWorkspace.URLForApplicationWithBundleIdentifier(TERMINAL_BUNDLES[id]);

    return !isNil(url);
}

function launch(bridge, files, { terminal, path }) {
    const ran = supervise(bridge, files, {
        executable: OPEN,
        arguments: ["-b", TERMINAL_BUNDLES[terminal], path],
        operation: NATIVE_OPERATIONS.LAUNCH,
        subject: path
    });

    if (!ran.finished) {
        throw refuse("launchUnconfirmed", {
            terminal, path, cause: ran.lost, stopped: ran.stopped, pid: ran.pid, cleanup: ran.cleanup
        });
    }

    if (ran.status !== 0) {
        throw refuse("launchFailed", { terminal, path, status: ran.status });
    }
}

function createTerminalApps(bridge, files) {
    return {
        isInstalled: (id) => isInstalled(bridge, id),
        launch: (request) => launch(bridge, files, request)
    };
}

module.exports = { createTerminalApps };
