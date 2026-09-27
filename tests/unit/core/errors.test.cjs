"use strict";

/*
 * Cancellation is recognised by the one number JXA reports it with, and every
 * other failure keeps its own message.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { cancelled, isCancellation, messageOf } = require("../../../src/core/errors.js");

test("a cancellation carries userCanceledErr and says so", () => {
    const error = cancelled();

    assert.ok(error instanceof Error);
    assert.equal(error.message, "Cancelled.");
    assert.equal(error.errorNumber, -128);
    assert.equal(isCancellation(error), true);
});

test("any error carrying -128 as errorNumber is a cancellation", () => {
    assert.equal(isCancellation({ errorNumber: -128 }), true);
});

test("nothing else is, however close it looks", () => {
    // A `number` or `code` property, and the number as text, are all
    // different things from errorNumber.
    const lookalikes = [
        null, undefined, 0, false, "", {},
        { errorNumber: "-128" }, { errorNumber: 128 }, { errorNumber: -129 },
        { number: -128 }, { code: -128 }
    ];

    for (const value of lookalikes) {
        assert.equal(isCancellation(value), false, JSON.stringify(value));
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
