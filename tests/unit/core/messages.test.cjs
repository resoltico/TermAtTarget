"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { CATALOG, SOURCE_LOCALE, render } = require("../../../src/core/messages.js");

test("English is the source and the fallback for unrecognised locales", () => {
    assert.equal(SOURCE_LOCALE, "en");
    assert.deepEqual(Object.keys(CATALOG), ["en"]);
    for (const locale of ["en", "en-GB", "__proto__", undefined]) {
        assert.equal(render(locale, "terminalMissing.summary", { terminal: "Ghostty" }), "Ghostty isn't installed");
    }
});

test("a message needs its exact named parameters", () => {
    assert.throws(() => render("en", "unknown"), /^RangeError: Unknown message: unknown$/u);
    assert.throws(() => render("en", "constructor"), /^RangeError: Unknown message: constructor$/u);
    assert.throws(() => render("en", "terminalMissing.summary"), /^TypeError: Missing parameter terminal for message terminalMissing.summary$/u);
    assert.throws(() => render("en", "terminalMissing.summary", Object.create({ terminal: "Ghostty" })), /Missing parameter terminal/u);
    assert.throws(() => render("en", "terminalMissing.summary", { terminal: "Ghostty", path: "/x" }),
        /^TypeError: Unused parameter for message terminalMissing.summary$/u);
    assert.equal(render("en", "launchFailed.message", { terminal: "kitty", path: "/Test", status: 42 }),
        "kitty could not be opened at /Test (open exit 42). Check that kitty opens on its own.");
});
