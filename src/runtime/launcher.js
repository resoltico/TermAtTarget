"use strict";

const { absolutePath, displayPath } = require("../core/paths.js");
const { OPEN, TERMINAL } = require("./executables.js");
const { supervise, DEADLINE_SECONDS } = require("./supervise.js");

/*
 * Terminal, opened at a directory by /usr/bin/open.
 *
 * The directory travels as one argument of four, never inside a command a
 * shell would read: a name with quotes, $, backticks, ; or & in it is a name.
 * Measured on macOS against a directory named with all of them, and an emoji:
 * the shell Terminal starts is in that directory exactly.
 *
 * Success means the request was handed to Terminal, not that a shell is ready.
 * A request still pending at the deadline may yet reach Terminal, so it is
 * reported as that -- never as a plain failure, which would invite a retry.
 */

function pending(directory, ran) {
    const cause = ran.lost === null
        ? `open had not finished after ${DEADLINE_SECONDS} seconds`
        : `open could not be followed (${ran.lost})`;
    const said = [`Terminal was asked to open ${displayPath(directory)}, but ${cause}; ` +
        "the window may still appear. Nothing was retried."];

    if (!ran.stopped) {
        said.push(ran.pid === null
            ? "open was told to stop, and could not be seen to stop."
            : `open (process ${ran.pid}) was told to stop, and could not be seen to stop.`);
    }

    return [...said, ...ran.cleanup.map((failure) => `Stopping open also failed: ${failure}`)].join(" ");
}

function launch(bridge, files, path) {
    const directory = absolutePath(path);
    const ran = supervise(bridge, files, {
        executable: OPEN,
        arguments: ["-b", TERMINAL, directory],
        failure: "Cannot launch Terminal at",
        subject: directory
    });

    if (!ran.finished) {
        throw new Error(pending(directory, ran));
    }

    if (ran.status !== 0) {
        throw new Error(`Terminal could not be opened at ${displayPath(directory)} (open exit ${ran.status}). ` +
            "Check that Terminal opens on its own.");
    }
}

function createLauncher(bridge, files) {
    return (path) => launch(bridge, files, path);
}

module.exports = { createLauncher };
