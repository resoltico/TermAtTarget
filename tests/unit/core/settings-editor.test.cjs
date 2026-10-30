"use strict";

/*
 * Changing the settings: every setting listed with what it stands for, the
 * picked one's values offered, a change saved at once, and every answer
 * checked before anything is saved.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { editSettings } = require("../../../src/core/settings-editor.js");
const { fixture, calls, NOTHING_SAVED } = require("../../helpers.cjs");

// A person who picks each of `turns` in order: [setting, value], then Done.
function picking(turns, overrides = {}) {
    const queue = [...turns];
    let picked = null;

    return fixture({}, {
        pickSetting(rows, focus) {
            this.events.push(["pickSetting", rows, focus]);

            if (queue.length === 0) {
                return null;
            }

            const [key, value] = queue.shift();

            picked = value;
            return key;
        },
        pickValue(key, values, current) {
            this.events.push(["pickValue", key, values, current]);
            return picked;
        },
        ...overrides
    });
}

const edit = (io, saved = NOTHING_SAVED) => editSettings(saved, io, io, io);

test("the list opens on the first setting, and comes back to the one last picked", () => {
    const io = picking([["link", "stay"], ["folder", null]]);

    edit(io);
    assert.deepEqual(io.events.filter(([name]) => name === "pickSetting").map((event) => event[2]), ["terminal", "link", "folder"]);
});

test("Done straight away saves nothing", () => {
    const io = picking([]);

    edit(io);
    assert.deepEqual(calls(io).filter((name) => name !== "installed"), ["pickSetting"]);
});

test("every setting is listed with what it stands for and what was saved", () => {
    const io = picking([]);

    edit(io, { terminal: "ghostty", folder: null, link: "LINK" });
    assert.deepEqual(io.events.find(([name]) => name === "pickSetting")[1], [
        { key: "terminal", value: "ghostty", saved: "ghostty", available: true },
        { key: "folder", value: "ask", saved: null, available: true },
        { key: "link", value: null, saved: "LINK", available: true }
    ]);
});

test("a terminal app that is not installed is listed as unavailable", () => {
    const io = picking([], { isInstalled: (id) => id !== "ghostty" });

    edit(io, { terminal: "ghostty", folder: null, link: null });
    assert.equal(io.events.find(([name]) => name === "pickSetting")[1][0].available, false);
});

test("only a known terminal app can be unavailable: other rows, and an unrecognised app, never are", () => {
    const io = picking([], { isInstalled: () => false });

    edit(io, { terminal: "xterm", folder: null, link: null });
    assert.deepEqual(io.events.find(([name]) => name === "pickSetting")[1].map((row) => row.available), [true, true, true]);
});

test("a change is saved, and the list shows it next time round", () => {
    const io = picking([["folder", "parent"]]);

    edit(io);
    assert.deepEqual(io.events.filter(([name]) => name === "save"), [["save", "folder", "parent"]]);
    assert.deepEqual(io.events.at(-1)[1][1], { key: "folder", value: "parent", saved: "parent", available: true });
});

test("the picked setting's values are offered, with the current one", () => {
    const io = picking([["link", null]]);

    edit(io, { ...NOTHING_SAVED, link: "follow" });
    assert.deepEqual(io.events.find(([name]) => name === "pickValue"), ["pickValue", "link", ["ask", "follow", "stay"], "follow"]);
});

test("an unrecognised value is offered with no current one, and can be replaced", () => {
    const io = picking([["link", "stay"]]);

    edit(io, { ...NOTHING_SAVED, link: "TARGET" });
    assert.equal(io.events.find(([name]) => name === "pickValue")[3], null);
    assert.deepEqual(io.events.filter(([name]) => name === "save"), [["save", "link", "stay"]]);
});

test("only installed terminal apps are offered", () => {
    const io = picking([["terminal", "terminal"]], { isInstalled: (id) => id === "terminal" });

    edit(io, { ...NOTHING_SAVED, terminal: "ghostty" });
    assert.deepEqual(io.events.find(([name]) => name === "pickValue"), ["pickValue", "terminal", ["terminal"], "ghostty"]);
});

test("with no terminal app installed there is nothing to offer, and that is said", () => {
    const io = picking([["terminal", "terminal"]], { isInstalled: () => false });

    assert.throws(() => edit(io), /^Error: None of the terminal apps Term At Target can open is installed\.$/u);
});

test("Back from the values saves nothing and returns to the list", () => {
    const io = picking([["folder", null], ["link", "stay"]]);

    edit(io);
    assert.deepEqual(calls(io).filter((name) => name !== "installed"),
        ["pickSetting", "pickValue", "pickSetting", "pickValue", "save", "pickSetting"]);
});

test("an answer that was not offered is refused, and nothing is saved", () => {
    for (const turn of [["colour", "red"], ["folder", "follow"], ["terminal", "xterm"]]) {
        const io = picking([turn]);

        assert.throws(() => edit(io), /^Error: The settings list returned an invalid answer\.$/u, turn.join());
        assert.equal(calls(io).includes("save"), false, turn.join());
    }
});

test("a terminal app that is not installed is not an answer, though it is a value", () => {
    const io = picking([["terminal", "ghostty"]], { isInstalled: (id) => id === "terminal" });

    assert.throws(() => edit(io), /invalid answer/u);
});
