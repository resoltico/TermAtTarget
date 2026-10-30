"use strict";

/*
 * Every way a run can stop short: cancelled by the person, or failing at a
 * step. A cancel is quiet; a failure is thrown as itself, whatever it is.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { execute } = require("../../../src/core/workflow.js");
const { cancelled } = require("../../../src/core/errors.js");
const { fixture, hostFor, calls } = require("../../helpers.cjs");

function userCancelled() {
    throw cancelled();
}

test("a cancel at any question returns quietly and launches nothing", () => {
    const stages = [
        [[], {}, "start"],
        [[], {}, "chooseFolder"],
        [["/work"], {}, "chooseFolderMode"],
        [["/a"], { "/a": { kind: "alias" } }, "chooseLink"]
    ];

    for (const [input, entries, stage] of stages) {
        const io = fixture(entries, { [stage]: userCancelled });

        assert.deepEqual(execute(input, hostFor(io)), [], stage);
        assert.equal(calls(io).includes("launch"), false, stage);
    }
});

test("a cancel in the settings returns quietly too", () => {
    const io = fixture({}, { start: () => "settings", pickSetting: userCancelled });

    assert.deepEqual(execute([], hostFor(io)), []);
});

test("a failure at any step is thrown as itself, and nothing after it runs", () => {
    for (const stage of ["load", "isInstalled", "inspect", "resolveAlias", "validateDirectory", "launch"]) {
        const failure = new Error(stage);
        const io = fixture({ "/a": { kind: "alias", target: "/work" } }, {
            [stage]() {
                throw failure;
            }
        });

        assert.throws(() => execute(["/a"], hostFor(io)), (error) => error === failure, stage);
    }
});

test("a failed validation launches nothing", () => {
    const io = fixture({}, {
        validateDirectory() {
            throw new Error("gone");
        }
    });

    assert.throws(() => execute(["/work"], hostFor(io)), /^Error: gone$/u);
    assert.equal(calls(io).includes("launch"), false);
});

test("anything thrown is a failure, including values that are falsy", () => {
    for (const failure of [null, false, 0, undefined, "", "native text"]) {
        const io = fixture({}, {
            inspect() {
                throw failure;
            }
        });
        const thrown = [];

        try {
            execute(["/work"], hostFor(io));
        } catch (error) {
            thrown.push(error);
        }

        assert.deepEqual(thrown, [failure], String(failure));
    }
});

test("a thrown object that only resembles a cancellation is a failure", () => {
    // Standard Additions' own number is the runtime's to translate, not the core's.
    for (const failure of [{ errorNumber: -128 }, Object.assign(new Error("User canceled."), { errorNumber: -128 })]) {
        const io = fixture({}, {
            inspect() {
                throw failure;
            }
        });

        assert.throws(() => execute(["/work"], hostFor(io)), (error) => error === failure);
    }
});
