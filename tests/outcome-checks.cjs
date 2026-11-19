"use strict";

const assert = require("node:assert/strict");
const { isRefusal } = require("../src/core/outcomes.js");

function assertRefused(outcome, kind, params) {
    assert.equal(outcome.kind, "refused");
    assert.ok(isRefusal(outcome.refusal));
    assert.equal(outcome.refusal.kind, kind);
    assert.deepEqual(outcome.refusal.params, params);
}

module.exports = { assertRefused };
