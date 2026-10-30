"use strict";

const { absolutePath, displayPath } = require("../core/paths.js");
const { terminalApp } = require("../core/vocabulary.js");
const { isNil } = require("./bridge.js");
const { OPEN, TERMINAL_BUNDLES } = require("./executables.js");
const { supervise, DEADLINE_SECONDS } = require("./supervise.js");

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

function pending(name, directory, ran) {
    const cause = ran.lost === null
        ? `open had not finished after ${DEADLINE_SECONDS} seconds`
        : `open could not be followed (${ran.lost})`;
    const said = [`${name} was asked to open ${displayPath(directory)}, but ${cause}; ` +
        "the window may still appear. Nothing was retried."];

    if (!ran.stopped) {
        said.push(ran.pid === null
            ? "open was told to stop, and could not be seen to stop."
            : `open (process ${ran.pid}) was told to stop, and could not be seen to stop.`);
    }

    return [...said, ...ran.cleanup.map((failure) => `Stopping open also failed: ${failure}`)].join(" ");
}

function launch(bridge, files, id, path) {
    const { name } = terminalApp(id);
    const directory = absolutePath(path);
    const ran = supervise(bridge, files, {
        executable: OPEN,
        arguments: ["-b", TERMINAL_BUNDLES[id], directory],
        failure: `Cannot launch ${name} at`,
        subject: directory
    });

    if (!ran.finished) {
        throw new Error(pending(name, directory, ran));
    }

    if (ran.status !== 0) {
        throw new Error(`${name} could not be opened at ${displayPath(directory)} (open exit ${ran.status}). ` +
            `Check that ${name} opens on its own.`);
    }
}

function createTerminalApps(bridge, files) {
    return {
        isInstalled: (id) => isInstalled(bridge, id),
        launch: (id, path) => launch(bridge, files, id, path)
    };
}

module.exports = { createTerminalApps };
