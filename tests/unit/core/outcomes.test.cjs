"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { refuse, fault, cancelled, isCancellation, isRefusal, isFault, remediesOf } = require("../../../src/core/outcomes.js");

test("refusals, faults and cancellation are distinct errors with stacks", () => {
    const entries = [
        [refuse("slashedFile", { path: "/file/" }), "slashedFile", { path: "/file/" }, isRefusal],
        [fault("invalidAnswer", { question: "start" }), "invalidAnswer", { question: "start" }, isFault],
        [cancelled(), undefined, undefined, isCancellation]
    ];

    for (const [error, kind, params, predicate] of entries) {
        assert.ok(error instanceof Error);
        assert.match(error.stack, /outcomes\.test\.cjs/u);
        assert.equal(error.kind, kind);
        assert.deepEqual(error.params, params);
        assert.deepEqual([isCancellation, isRefusal, isFault].filter((matches) => matches(error)), [predicate]);
    }

    for (const input of [null, {}, new Error("Cancelled."), { category: "refusal" }]) {
        assert.equal(isCancellation(input) || isRefusal(input) || isFault(input), false);
    }
});

test("construction rejects undeclared kinds and missing, inherited or extra parameters", () => {
    assert.throws(() => refuse("invalidAnswer", { question: "start" }), /^RangeError: Undeclared outcome kind: invalidAnswer$/u);
    assert.throws(() => fault("toString", {}), /^RangeError: Undeclared outcome kind: toString$/u);
    assert.throws(() => refuse("slashedFile"), /^TypeError: Wrong parameters for outcome kind: slashedFile$/u);
    for (const params of [{ path: "/x", other: true }, { other: "/x" }, Object.assign(Object.create({ path: "/x" }), { other: true })]) {
        assert.throws(() => refuse("slashedFile", params), /^TypeError: Wrong parameters for outcome kind: slashedFile$/u);
    }
});

test("a refusal declares the remedies appropriate to its facts", () => {
    assert.deepEqual(remediesOf(refuse("multipleSelection")), []);
    assert.deepEqual(remediesOf(refuse("terminalMissing", { terminal: "kitty" })), ["changeSettings"]);
    assert.deepEqual(remediesOf(refuse("settingUnrecognised", { setting: "link", saved: 1 })), ["changeSettings"]);
    assert.deepEqual(remediesOf(refuse("terminalReadsVariables", { terminal: "kitty", path: "/a/$x", parentUsable: true })),
        ["parent", "changeSettings"]);
    assert.deepEqual(remediesOf(refuse("terminalReadsVariables", { terminal: "kitty", path: "/$a/$x", parentUsable: false })),
        ["changeSettings"]);
    assert.deepEqual(remediesOf(refuse("aliasTargetMissing", { native: {} })), ["stay"]);
});
