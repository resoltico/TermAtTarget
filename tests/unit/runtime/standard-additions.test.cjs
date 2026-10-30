"use strict";

/*
 * An answer is one of those offered, or a cancel. Anything else is a dialog
 * that misbehaved, and is not taken as a decision either way. A cancel is
 * Standard Additions' errorNumber -128, turned into the core's cancellation.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { ask, pick, alert, chooseFolder } = require("../../../src/runtime/standard-additions.js");
const { isCancellation } = require("../../../src/core/errors.js");

const ANSWERS = { other: "Open in Parent", usual: "Open Inside" };
const answering = (answer) => ({ displayDialog: () => answer, chooseFromList: () => answer });
const throwing = (failure) => {
    const fail = () => {
        throw failure;
    };

    return { displayDialog: fail, chooseFromList: fail, chooseFolder: fail };
};
const userCancelled = () => Object.assign(new Error("User canceled."), { errorNumber: -128 });
const QUESTIONS = [
    (app) => ask(app, "text", ANSWERS),
    (app) => pick(app, ["a"], {}),
    (app) => chooseFolder(app, "prompt")
];

test("a cancel in any of them is the core's cancellation", () => {
    for (const asked of QUESTIONS) {
        assert.throws(() => asked(throwing(userCancelled())), (error) => isCancellation(error) && error.message === "Cancelled.");
    }
});

test("anything else thrown passes through as itself, however close to a cancel it looks", () => {
    const failures = [new Error("permission denied"), { errorNumber: "-128" }, { number: -128 }, { code: -128 }, null];

    for (const failure of failures) {
        for (const asked of QUESTIONS) {
            assert.throws(() => asked(throwing(failure)), (error) => error === failure, JSON.stringify(failure));
        }
    }
});

test("a dialog's answer is one of the two buttons offered besides Cancel", () => {
    assert.equal(ask(answering({ buttonReturned: "Open Inside" }), "text", ANSWERS), "Open Inside");
    assert.equal(ask(answering({ buttonReturned: "Open in Parent" }), "text", ANSWERS), "Open in Parent");
});

test("a dialog answer that is not one of the buttons offered is refused", () => {
    const malformed = [
        null, undefined, false, "Open Inside", [], {},
        { buttonReturned: "" }, { buttonReturned: "", gaveUp: true },
        { buttonReturned: "Cancel" }, { buttonReturned: "open inside" }, { buttonReturned: ["Open Inside"] }
    ];

    for (const answer of malformed) {
        assert.throws(() => ask(answering(answer), "text", ANSWERS), /^Error: The dialog returned an invalid answer\.$/u, JSON.stringify(answer));
    }
});

test("a list offers one item, never none, with the options it is given", () => {
    const seen = [];
    const app = {
        chooseFromList(items, options) {
            seen.push([items, options]);
            return ["b"];
        }
    };

    assert.equal(pick(app, ["a", "b"], { withTitle: "T", multipleSelectionsAllowed: true }), "b");
    assert.deepEqual(seen, [[["a", "b"], { withTitle: "T", multipleSelectionsAllowed: false, emptySelectionAllowed: false }]]);
});

test("backing out of a list is no answer, not a cancellation", () => {
    assert.equal(pick(answering(false), ["a"], {}), null);
});

test("a list answer that is not exactly one item offered is refused", () => {
    for (const answer of [null, true, "a", [], ["a", "a"], ["c"], [["a"]], { 0: "a", length: 1 }]) {
        assert.throws(() => pick(answering(answer), ["a", "b"], {}), /^Error: The settings list returned an invalid answer\.$/u,
            JSON.stringify(answer));
    }
});

test("choosing a folder asks for one, and returns what was chosen", () => {
    const seen = [];
    const app = {
        chooseFolder(options) {
            seen.push(options);
            return "chosen";
        }
    };

    assert.equal(chooseFolder(app, "Where?"), "chosen");
    assert.deepEqual(seen, [{ withPrompt: "Where?", multipleSelectionsAllowed: false }]);
});

test("an alert says what went wrong, with OK as its only answer", () => {
    const seen = [];

    alert({ displayAlert: (...args) => seen.push(args) }, "Heading", "Detail.");
    assert.deepEqual(seen, [["Heading", { message: "Detail.", as: "warning", buttons: ["OK"], defaultButton: "OK" }]]);
});
