"use strict";

/*
 * NSTask, NSThread and kill() as the supervisor uses them, on a fake clock.
 *
 * The task runs until the clock reaches the earliest of: `runsFor` (Infinity:
 * never on its own), `termTakes` after SIGTERM, `killTakes` after SIGKILL
 * (Infinity: that signal is ignored), or `exitsAt`, a moment on the clock that
 * the task reaches only once the clock has been read there. Each sleep
 * advances the clock by `sleepTakes` -- the seconds asked for, or longer, to
 * model a sleep that overshoots. `failsAt` makes a call throw once the clock
 * has reached a moment: `{ sleep: 3 }` breaks every sleep from 3 s on. Every
 * call that matters is recorded.
 */

// Throws if the named call is set to fail from a moment the clock has reached.
function failIfDue(options, state, call) {
    if (state.clock.now >= (options.failsAt[call] ?? Infinity)) {
        throw new Error(`${call} failed`);
    }
}

function scriptedTask(options, state, events) {
    return {
        get processIdentifier() {
            failIfDue(options, state, "pid");
            return "4242";
        },
        get terminationStatus() {
            failIfDue(options, state, "status");
            return options.status;
        },
        launchAndReturnError(error) {
            error.detail = "native-error";
            events.push("launch");
            return options.start;
        },
        get running() {
            failIfDue(options, state, "running");
            return state.clock.now < Math.min(options.runsFor, state.endsAt);
        },
        get terminate() {
            events.push("terminate");

            if (options.terminateThrows) {
                throw new Error("terminate failed");
            }

            state.endsAt = Math.min(state.endsAt, state.clock.now + options.termTakes);
            return undefined;
        }
    };
}

function namespace(task, options, state, events) {
    return {
        NSTask: { alloc: { init: task } },
        NSURL: { fileURLWithPath: (path) => ({ path }) },
        NSFileHandle: { fileHandleWithNullDevice: "null-device" },
        NSThread: {
            sleepForTimeInterval(seconds) {
                failIfDue(options, state, "sleep");
                events.push(["sleep", seconds]);
                state.clock.now += options.sleepTakes ?? seconds;
            }
        },
        kill(pid, signal) {
            events.push(["kill", pid, signal]);
            state.endsAt = Math.min(state.endsAt, state.clock.now + options.killTakes);
            return 0;
        }
    };
}

function fakeTask(given = {}) {
    const options = {
        start: true, status: 0, runsFor: 0.1, sleepTakes: null, exitsAt: Infinity,
        termTakes: 0, killTakes: 0, terminateThrows: false, failsAt: {}, ...given
    };
    const events = [];
    const state = { clock: { now: 0 }, endsAt: Infinity };
    const task = scriptedTask(options, state, events);
    const objc = { wrap: (value) => value, import: (name) => events.push(["import", name]) };
    const files = { nativeFailure: (operation, path, error) => new Error(`${operation}:${path}:${error.detail}`) };
    // Reading the clock at `exitsAt` or later is when that exit happens.
    const now = () => {
        failIfDue(options, state, "clock");

        if (state.clock.now >= options.exitsAt) {
            state.endsAt = Math.min(state.endsAt, options.exitsAt);
        }

        return state.clock.now;
    };
    const bridge = { ns: namespace(task, options, state, events), objc, outParameter: () => ({}), now };

    return { task, events, clock: state.clock, bridge, files };
}

// The recorded events of one kind.
const eventsNamed = (events, name) => events.filter((event) => (Array.isArray(event) ? event[0] : event) === name);

module.exports = { fakeTask, eventsNamed };
