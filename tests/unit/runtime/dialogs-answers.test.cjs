"use strict";

/*
 * An answer is one of the buttons offered, or a cancel. Anything else is a
 * dialog that misbehaved, and is not taken as a decision either way.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createDialogs } = require("../../../src/runtime/dialogs.js");
const { isCancellation } = require("../../../src/core/errors.js");

const answering = (answer) => createDialogs({ displayDialog: () => answer }, { isPackage: () => false });
const QUESTIONS = [(ui) => ui.chooseFolderMode("/work", null), (ui) => ui.chooseLink("/work/a", "alias")];

test("Cancel is thrown by Standard Additions, and passes through as a cancellation", () => {
    const cancel = Object.assign(new Error("User canceled."), { errorNumber: -128 });
    const ui = createDialogs({
        displayDialog() {
            throw cancel;
        }
    }, { isPackage: () => false });

    for (const ask of QUESTIONS) {
        assert.throws(() => ask(ui), (error) => error === cancel && isCancellation(error));
    }
});

test("an answer that is not one of the buttons offered is refused", () => {
    const malformed = [
        null, undefined, false, "Open Inside", [], {},
        { buttonReturned: "" }, { buttonReturned: "", gaveUp: true },
        { buttonReturned: "Cancel" }, { buttonReturned: "open inside" }, { buttonReturned: ["Open Inside"] }
    ];

    for (const answer of malformed) {
        for (const ask of QUESTIONS) {
            assert.throws(() => ask(answering(answer)), /^Error: The location dialog returned an invalid answer\.$/u, JSON.stringify(answer));
        }
    }
});

test("a button from the other question is not an answer to this one", () => {
    assert.throws(() => answering({ buttonReturned: "Follow Alias" }).chooseFolderMode("/work", null), /invalid answer/u);
    assert.throws(() => answering({ buttonReturned: "Open Inside" }).chooseLink("/a", "alias"), /invalid answer/u);
    assert.throws(() => answering({ buttonReturned: "Follow Link" }).chooseLink("/a", "alias"), /invalid answer/u);
});

test("a dialog that fails is reported as itself", () => {
    const failure = new Error("permission denied");
    const ui = createDialogs({
        displayDialog() {
            throw failure;
        }
    }, { isPackage: () => false });

    assert.throws(() => ui.chooseLink("/a", "alias"), (error) => error === failure);
});
