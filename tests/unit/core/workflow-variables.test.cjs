"use strict";

/*
 * An app that expands environment variables in the folder it is given is
 * never given a folder whose path holds a "$": it would open somewhere else.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { execute } = require("../../../src/core/workflow.js");
const { fixture, hostFor, calls } = require("../../helpers.cjs");

const DOLLAR = "/work/dollar $HOME";

test("kitty is refused a folder with a \"$\" in its path, after it is checked and before it is opened", () => {
    const io = fixture({ [DOLLAR]: { kind: "directory" } }, {}, { terminal: "kitty", folder: "inside" });

    assert.throws(() => execute([DOLLAR], hostFor(io)), (error) => {
        assert.equal(error.summary, "kitty can't open this folder");
        assert.equal(error.message, "kitty reads \"$\" in a folder's path as the start of a variable, so it would open " +
            "somewhere other than \"/work/dollar $HOME\". Its parent folder has no \"$\", so kitty can open that: choose " +
            "Open in Parent, or choose another terminal app. Run Term At Target with nothing selected to change its settings.");

        return true;
    });
    assert.deepEqual(calls(io).slice(-2), ["inspect", "validate"]);
});

test("when the parent has a \"$\" too, kitty is only pointed at another app", () => {
    const deep = "/w$x/inner";
    const io = fixture({ "/w$x": { kind: "directory" }, [deep]: { kind: "directory" } }, {}, { terminal: "kitty", folder: "inside" });

    assert.throws(() => execute([deep], hostFor(io)), (error) => {
        assert.match(error.message, /"\/w\$x\/inner"\. Choose another terminal app for this folder\. Run Term At Target/u);

        return true;
    });
});

test("kitty opens any other folder", () => {
    const io = fixture({}, {}, { terminal: "kitty", folder: "inside" });

    execute(["/work"], hostFor(io));
    assert.deepEqual(io.events.at(-1), ["launch", "/work", "kitty"]);
});

test("an app that reads no variables is given a \"$\" as a name", () => {
    for (const terminal of ["terminal", "ghostty", "iterm2"]) {
        const io = fixture({ [DOLLAR]: { kind: "directory" } }, {}, { terminal, folder: "inside" });

        execute([DOLLAR], hostFor(io));
        assert.deepEqual(io.events.at(-1), ["launch", DOLLAR, terminal], terminal);
    }
});
