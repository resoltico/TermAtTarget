"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fc = require("fast-check");
const { render } = require("../../../src/core/messages.js");

test("interpolation inserts values verbatim, even when they contain placeholders or dollar signs", () => {
    fc.assert(fc.property(fc.string(), fc.string(), (terminal, path) => {
        assert.equal(render("en", "launchFailed.message", { terminal, path, status: 3 }),
            `${terminal} could not be opened at ${path} (open exit 3). Check that ${terminal} opens on its own.`);
    }));
    assert.equal(render("en", "terminalMissing.summary", { terminal: "{terminal}$&" }), "{terminal}$& isn't installed");
});
