"use strict";

/*
 * A failed run, told in Term At Target's own alert: a refusal under its own
 * summary, anything else under the general one, with the message below.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createFailureReport } = require("../../../src/runtime/failure-report.js");
const { refusal } = require("../../../src/core/errors.js");

function reported(error) {
    const seen = [];

    createFailureReport({ displayAlert: (summary, options) => seen.push([summary, options.message]) })(error);
    return seen;
}

test("a refusal is headed by its own summary", () => {
    assert.deepEqual(reported(refusal("Select one item at a time", "Select one file or folder.")),
        [["Select one item at a time", "Select one file or folder."]]);
});

test("any other failure is headed by the general summary, which stays true", () => {
    assert.deepEqual(reported(new Error("Cannot inspect \"/x\".")), [["Term At Target couldn't finish", "Cannot inspect \"/x\"."]]);
    assert.deepEqual(reported("native text"), [["Term At Target couldn't finish", "native text"]]);
});
