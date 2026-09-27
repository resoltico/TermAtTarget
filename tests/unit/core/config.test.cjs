"use strict";

/*
 * The two settings a person may change, and nothing else. A misspelled key or
 * a lowercase value would otherwise be ignored silently and the action would
 * behave as though it had not been configured.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { validateConfig } = require("../../../src/core/config.js");
const { DEFAULTS } = require("../../helpers.cjs");

const FOLDER_ACTIONS = ["ASK", "INSIDE", "LEVEL"];
const LINK_ACTIONS = ["ASK", "TARGET", "LINK"];

test("every valid configuration is accepted as a frozen copy", () => {
    const configurations = FOLDER_ACTIONS.flatMap((folder) =>
        LINK_ACTIONS.map((alias) => ({ defaultFolderAction: folder, defaultLinkAction: alias })));

    for (const input of configurations) {
        const copy = validateConfig(input);

        assert.deepEqual(copy, input);
        assert.notEqual(copy, input, "a copy, so the caller's object cannot change it later");
        assert.equal(Object.isFrozen(copy), true);
    }
});

test("only the two settings are copied, in a fixed shape", () => {
    // Inherited or getter-backed extras must not ride along into the copy.
    assert.deepEqual(Object.keys(validateConfig(DEFAULTS)), ["defaultFolderAction", "defaultLinkAction"]);
});

test("the settings may be written in either order", () => {
    // A configuration is a set of settings, not a sequence of them.
    const reversed = { defaultLinkAction: "LINK", defaultFolderAction: "LEVEL" };

    assert.deepEqual(validateConfig(reversed), { defaultFolderAction: "LEVEL", defaultLinkAction: "LINK" });
});

test("anything but a plain object is refused", () => {
    for (const value of [null, undefined, false, 0, 1, "ASK", []]) {
        assert.throws(() => validateConfig(value), /^Error: Configuration must be an object\.$/u, String(value));
    }
});

test("a missing, extra or misspelled key is refused", () => {
    const wrongShape = [
        {},
        { defaultFolderAction: "ASK" },
        { defaultLinkAction: "ASK" },
        { ...DEFAULTS, extra: true },
        { defaultFolderAction: "ASK", defaultlinkAction: "ASK" }
    ];

    for (const value of wrongShape) {
        assert.throws(
            () => validateConfig(value),
            /^Error: Configuration must contain only defaultFolderAction and defaultLinkAction\.$/u,
            JSON.stringify(value)
        );
    }
});

test("a folder action outside the three is refused", () => {
    for (const defaultFolderAction of ["inside", "TARGET", null, "", ["ASK"]]) {
        assert.throws(
            () => validateConfig({ ...DEFAULTS, defaultFolderAction }),
            /^Error: defaultFolderAction must be ASK, INSIDE, or LEVEL\.$/u,
            String(defaultFolderAction)
        );
    }
});

test("an alias action outside the three is refused", () => {
    for (const defaultLinkAction of ["target", "INSIDE", null, "", ["ASK"]]) {
        assert.throws(
            () => validateConfig({ ...DEFAULTS, defaultLinkAction }),
            /^Error: defaultLinkAction must be ASK, TARGET, or LINK\.$/u,
            String(defaultLinkAction)
        );
    }
});
