"use strict";

/*
 * Every way a run can stop short: cancelled by the person, or failing at a
 * step. A cancel is quiet; a failure is thrown as itself, whatever it is.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { execute } = require("../../../src/core/workflow.js");
const { fixture, calls, DEFAULTS } = require("../../helpers.cjs");

// The shape JXA's Standard Additions throw when the person clicks Cancel.
function userCancelled() {
    throw Object.assign(new Error("User canceled."), { errorNumber: -128 });
}

test("a cancel at any question returns quietly and launches nothing", () => {
    const stages = [
        [[], {}, "chooseFolder"],
        [["/work"], {}, "chooseFolderMode"],
        [["/a"], { "/a": { kind: "alias" } }, "chooseLink"]
    ];

    for (const [input, entries, stage] of stages) {
        const io = fixture(entries, { [stage]: userCancelled });

        assert.deepEqual(execute(input, DEFAULTS, io), [], stage);
        assert.equal(calls(io).includes("launch"), false, stage);
    }
});

test("a failure at any step is thrown as itself, and nothing after it runs", () => {
    for (const stage of ["inspect", "resolveAlias", "validateDirectory", "launch"]) {
        const failure = new Error(stage);
        const io = fixture({ "/a": { kind: "alias", target: "/work" } }, {
            [stage]() {
                throw failure;
            }
        });

        assert.throws(() => execute(["/a"], DEFAULTS, io), (error) => error === failure, stage);
    }
});

test("a failed validation launches nothing", () => {
    const io = fixture({}, {
        validateDirectory() {
            throw new Error("gone");
        }
    });

    assert.throws(() => execute(["/work"], DEFAULTS, io), /^Error: gone$/u);
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
            execute(["/work"], DEFAULTS, io);
        } catch (error) {
            thrown.push(error);
        }

        assert.deepEqual(thrown, [failure], String(failure));
    }
});

test("a thrown object that only resembles a cancellation is a failure", () => {
    const failure = { errorNumber: "-128" };
    const io = fixture({}, {
        inspect() {
            throw failure;
        }
    });

    assert.throws(() => execute(["/work"], DEFAULTS, io), (error) => error === failure);
});
