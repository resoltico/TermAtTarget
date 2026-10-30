"use strict";

/*
 * A cancellation is the core's own kind of error, made by the runtime when a
 * host says a person cancelled; every other failure keeps its own message.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { cancelled, isCancellation, refusal, summaryOf, messageOf } = require("../../../src/core/errors.js");

test("a cancellation is an Error that says so", () => {
    const error = cancelled();

    assert.ok(error instanceof Error);
    assert.equal(error.message, "Cancelled.");
    assert.equal(isCancellation(error), true);
    assert.notEqual(cancelled(), error, "each is its own");
});

test("nothing else is, however close it looks", () => {
    // Standard Additions' -128 is a host's way of saying it, which the runtime
    // translates; to the core it is just another failure.
    const lookalikes = [
        null, undefined, 0, false, "", {}, new Error("Cancelled."),
        { errorNumber: -128 }, Object.assign(new Error("User canceled."), { errorNumber: -128 })
    ];

    for (const value of lookalikes) {
        assert.equal(isCancellation(value), false, JSON.stringify(value));
    }
});

test("a refusal is an Error with a summary a person can act on", () => {
    const error = refusal("Ghostty isn't installed", "Install it.");

    assert.ok(error instanceof Error);
    assert.equal(error.message, "Install it.");
    assert.equal(summaryOf(error), "Ghostty isn't installed");
    assert.equal(isCancellation(error), false);
});

test("anything else has no summary", () => {
    for (const value of [new Error("x"), { summary: 3 }, null, undefined, "text", 0]) {
        assert.equal(summaryOf(value), null, String(value));
    }
});

test("a message is the error's own text, when it has text", () => {
    assert.equal(messageOf(new Error("native")), "native");
    assert.equal(messageOf({ message: "" }), "");
});

test("anything else is described as a string rather than lost", () => {
    assert.equal(messageOf({ message: 2 }), "[object Object]");
    assert.equal(messageOf(null), "null");
    assert.equal(messageOf(undefined), "undefined");
    assert.equal(messageOf("text"), "text");
    assert.equal(messageOf(0), "0");
});
