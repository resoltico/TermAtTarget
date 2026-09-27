"use strict";

const { messageOf } = require("../core/errors.js");
const { perform } = require("./bridge.js");

/*
 * One helper process, run to its end or to a deadline, whichever comes first.
 *
 * It reads nothing from the helper: stdin, stdout and stderr are the null
 * device. A pipe was the one thing that could hold a run past its deadline --
 * a helper blocked writing to it, or a descendant keeping it open after the
 * helper exited (measured: 25 s past a 10 s deadline) -- and JXA cannot read
 * one without risking exactly that, since making it non-blocking needs the
 * variadic fcntl(). The exit status is what is kept.
 *
 * The deadline is elapsed time on a monotonic clock, fixed before launch and
 * re-read after every sleep, so an overlong sleep ends the wait at the next
 * check instead of adding to it. It bounds waiting for the helper -- not a
 * launch call the system stalls inside, and not time the Mac is asleep.
 *
 * Once launched, the request may already have reached its target, so nothing
 * that happens afterwards escapes as a plain failure. If the helper outlives
 * the deadline, or watching it fails, it is abandoned: told to stop with
 * SIGTERM through the task object, watched for a second, and reported as
 * stopped or not. It is never signalled by pid -- NSTask reaps its child as
 * soon as it exits, so a pid read a moment ago may already name something
 * else -- which means a helper that ignores SIGTERM is reported, with its pid,
 * rather than killed.
 */

const DEADLINE_SECONDS = 10;
const POLL_SECONDS = 0.05;
const STOP_GRACE_SECONDS = 1;

function taskFor(bridge, command) {
    const { ns, objc } = bridge;
    const task = ns.NSTask.alloc.init;
    const nothing = ns.NSFileHandle.fileHandleWithNullDevice;

    task.executableURL = ns.NSURL.fileURLWithPath(command.executable);
    task.arguments = objc.wrap(command.arguments);
    task.standardInput = nothing;
    task.standardOutput = nothing;
    task.standardError = nothing;

    return task;
}

// Whether the task ended before the clock reached `until`.
function endedBy(bridge, task, until) {
    while (task.running) {
        const left = until - bridge.now();

        if (left <= 0) {
            return false;
        }

        bridge.ns.NSThread.sleepForTimeInterval(Math.min(POLL_SECONDS, left));
    }

    return true;
}

// A step whose failure is kept, never thrown over the outcome.
function attempt(action, failures) {
    try {
        return action();
    } catch (error) {
        failures.push(messageOf(error));
        return null;
    }
}

// Told to stop, watched for a bounded while, and reported either way.
function abandon(bridge, task, lost) {
    const cleanup = [];

    attempt(() => perform(task, "terminate"), cleanup);

    const stopped = attempt(() => endedBy(bridge, task, bridge.now() + STOP_GRACE_SECONDS), cleanup) === true;
    const pid = attempt(() => Number(task.processIdentifier), cleanup);

    return { finished: false, lost, stopped, pid, cleanup };
}

function supervise(bridge, files, command) {
    const expiry = bridge.now() + DEADLINE_SECONDS;
    const task = taskFor(bridge, command);
    const error = bridge.outParameter();

    if (!task.launchAndReturnError(error)) {
        throw files.nativeFailure(command.failure, command.subject, error);
    }

    try {
        if (endedBy(bridge, task, expiry)) {
            return { finished: true, status: Number(task.terminationStatus) };
        }
    } catch (failure) {
        return abandon(bridge, task, messageOf(failure));
    }

    return abandon(bridge, task, null);
}

module.exports = { supervise, DEADLINE_SECONDS, STOP_GRACE_SECONDS };
