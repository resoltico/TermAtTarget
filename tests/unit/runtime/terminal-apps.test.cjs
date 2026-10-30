"use strict";

/*
 * A terminal app, found and opened at a directory by its bundle identifier:
 * the directory as one argument with no shell in between, and every way the
 * request can end said differently, in the app's own name.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createTerminalApps } = require("../../../src/runtime/terminal-apps.js");
const { fakeTask, eventsNamed } = require("./fake-task.cjs");

function launcher(options, id = "terminal") {
    const fake = fakeTask(options);
    const apps = createTerminalApps(fake.bridge, fake.files);

    return { ...fake, launch: (path) => apps.launch(id, path) };
}

const PENDING = "Error: Terminal was asked to open \"/work\", but open had not finished after 10 seconds; " +
    "the window may still appear. Nothing was retried.";

test("open is given the app's bundle identifier and the directory, never a shell command", () => {
    const { task, launch } = launcher();
    const path = "/work/a ' \n $HOME `touch x`; & 😀";

    launch(path);
    assert.deepEqual(task.executableURL, { path: "/usr/bin/open" });
    assert.deepEqual(task.arguments, ["-b", "com.apple.Terminal", path]);

    const ghostty = launcher({}, "ghostty");

    ghostty.launch(path);
    assert.deepEqual(ghostty.task.arguments, ["-b", "com.mitchellh.ghostty", path]);
});

test("the directory is normalised the way every other path is", () => {
    const { task, launch } = launcher();

    launch("file:///work/a%20b/");
    assert.deepEqual(task.arguments, ["-b", "com.apple.Terminal", "/work/a b"]);
});

test("the directory is held to the path rules before anything runs", () => {
    const { events, launch } = launcher();

    assert.throws(() => launch("relative"), /absolute POSIX path/u);
    assert.deepEqual(events, []);
});

test("a request open accepted is done", () => {
    const { launch } = launcher({ status: 0 });

    assert.equal(launch("/work"), undefined);
});

test("a launch that fails says so with macOS's reason", () => {
    const { launch } = launcher({ start: false });

    assert.throws(() => launch("/work"), /^Error: Cannot launch Terminal at:\/work:native-error$/u);
});

test("an unsuccessful exit reports the status, and what to check", () => {
    const { launch } = launcher({ status: 1 });

    assert.throws(() => launch("/work"), (error) => {
        assert.equal(error.message, "Terminal could not be opened at \"/work\" (open exit 1). Check that Terminal opens on its own.");

        return true;
    });
});

test("a request still pending at the deadline is reported as possibly sent, and not retried", () => {
    const { events, launch } = launcher({ runsFor: Infinity });

    assert.throws(() => launch("/work"), (error) => {
        assert.equal(`Error: ${error.message}`, PENDING);

        return true;
    });
    assert.deepEqual(eventsNamed(events, "launch"), ["launch"]);
});

test("a helper that could not be seen to stop is named, with its process", () => {
    const { launch } = launcher({ runsFor: Infinity, termTakes: Infinity });

    assert.throws(() => launch("/work"), (error) => {
        assert.equal(`Error: ${error.message}`, `${PENDING} open (process 4242) was told to stop, and could not be seen to stop.`);

        return true;
    });
});

test("without its pid, it is still said that it did not stop", () => {
    const { launch } = launcher({ runsFor: Infinity, termTakes: Infinity, failsAt: { pid: 0 } });

    assert.throws(() => launch("/work"), (error) => {
        assert.equal(`Error: ${error.message}`, `${PENDING} open was told to stop, and could not be seen to stop. ` +
            "Stopping open also failed: pid failed");

        return true;
    });
});

test("a request whose progress could not be followed is also reported as possibly sent", () => {
    const { launch } = launcher({ runsFor: Infinity, failsAt: { sleep: 1 } });

    assert.throws(() => launch("/work"), (error) => {
        assert.equal(error.message, "Terminal was asked to open \"/work\", but open could not be followed (sleep failed); " +
            "the window may still appear. Nothing was retried.");

        return true;
    });
});

test("a failure while stopping it is said after what matters, not instead of it", () => {
    const { launch } = launcher({ runsFor: Infinity, terminateThrows: true });

    assert.throws(() => launch("/work"), (error) => {
        assert.equal(`Error: ${error.message}`, `${PENDING} open (process 4242) was told to stop, and could not be seen to stop. ` +
            "Stopping open also failed: terminate failed");

        return true;
    });
});

test("each app is named as itself in what is said", () => {
    const { launch } = launcher({ status: 1 }, "ghostty");

    assert.throws(() => launch("/work"), /^Error: Ghostty could not be opened at "\/work" \(open exit 1\)\. Check that Ghostty opens on its own\.$/u);
    assert.throws(() => launcher({ start: false }, "ghostty").launch("/work"), /^Error: Cannot launch Ghostty at:\/work:native-error$/u);
    assert.throws(() => launcher({ runsFor: Infinity }, "ghostty").launch("/work"), /^Error: Ghostty was asked to open "\/work", but/u);
});
