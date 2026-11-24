"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { execute } = require("../../../src/core/workflow.js");
const { fault } = require("../../../src/core/outcomes.js");
const { assertRefused } = require("../../outcome-checks.cjs");
const { fixture, hostFor, calls } = require("../../helpers.cjs");

const UNSAFE = "/work/$HOME project";
const NO_TARGET = "/work/absent";
const ALIAS = "/work/alias";
const LINK = "/work/link";

function native(path, operation = "inspect") {
    return { operation, path, domain: "NSCocoaErrorDomain", code: 260, description: "missing" };
}

function kitty(entries, overrides = {}, folder = "ask") {
    return fixture({ [UNSAFE]: { kind: "directory" }, ...entries }, overrides, { terminal: "kitty", folder });
}

function kittyRefusal(io, input, usable) {
    assertRefused(execute(input, hostFor(io)), "terminalReadsVariables", {
        terminal: "kitty", path: UNSAFE, parentOfferedAndUsable: usable
    });
    assert.equal(calls(io).includes("launch"), false);
}

test("a kitty run can suggest the parent only after an offered and usable alternative", () => {
    kittyRefusal(kitty({}), UNSAFE, true);
    kittyRefusal(kitty({}, {
        canEnter(path) {
            if (path === "/work") {
                throw fault("native", { ...native(path), code: 257 });
            }
            return true;
        }
    }), UNSAFE, false);
});

test("kitty file, chooser and fixed folder policies never offer a parent remedy", () => {
    kittyRefusal(kitty({ [`${UNSAFE}/file`]: { kind: "file" } }), `${UNSAFE}/file`, false);
    kittyRefusal(kitty({}, { chooseFolder: () => UNSAFE }), null, false);
    kittyRefusal(kitty({}, {}, "inside"), UNSAFE, false);
    kittyRefusal(kitty({ [`${UNSAFE}/child`]: { kind: "directory" } }, {}, "parent"), `${UNSAFE}/child`, false);
});

test("a broken alias offers a rerun choice only when the alias question was asked", () => {
    for (const policy of ["ask", "follow", "stay"]) {
        const details = native(ALIAS, "resolveAlias");
        const io = fixture({ [ALIAS]: { kind: "alias" } }, {
            resolveAlias() { throw fault("aliasUnresolved", details); }
        }, { link: policy });
        const result = execute(ALIAS, hostFor(io));

        if (policy === "stay") {
            assert.deepEqual(result, { kind: "opened", terminal: "terminal", path: "/work" });
        } else {
            assertRefused(result, "aliasTargetMissing", { native: details, stayOffered: policy === "ask" });
            assert.equal(calls(io).includes("launch"), false);
        }
    }
});

function missingSelectionIO(error) {
    return fixture({}, { inspect() { throw error; } });
}

function missingTargetIO(policy) {
    const io = fixture({ [LINK]: { kind: "symlink", target: NO_TARGET } }, {}, { link: policy });
    const { inspect } = io;
    io.inspect = (path) => {
        if (path === NO_TARGET) {
            throw fault("fileMissing", native(path));
        }

        return inspect(path);
    };

    return io;
}

test("a missing selection is refused with the received path and native details", () => {
    const io = missingSelectionIO(fault("fileMissing", native(NO_TARGET)));

    assertRefused(execute(NO_TARGET, hostFor(io)), "selectionMissing", { path: NO_TARGET, native: native(NO_TARGET) });
    assert.equal(calls(io).includes("launch"), false);
});

test("following a dangling link identifies the link and failing target", () => {
    for (const [input, policy, stayOffered] of [[LINK, "ask", true], [LINK, "follow", false], [`${LINK}/`, "ask", false]]) {
        const io = missingTargetIO(policy);

        assertRefused(execute(input, hostFor(io)), "linkTargetMissing", { path: LINK, native: native(NO_TARGET), stayOffered });
        assert.equal(calls(io).includes("launch"), false);
    }
});

test("a folder that vanishes after it is offered is refused as a missing destination", () => {
    const io = fixture({}, {
        ask(question) {
            delete io.items["/work"];
            return question.usual;
        },
        inspect(path) {
            if (io.items[path] === undefined) {
                throw fault("fileMissing", native(path));
            }
            return io.items[path];
        }
    });

    assertRefused(execute("/work", hostFor(io)), "destinationMissing", { path: "/work", native: native("/work") });
    assert.equal(calls(io).includes("launch"), false);
});

test("permission and unexpected native failures propagate without a terminal request", () => {
    for (const [domain, code] of [["NSCocoaErrorDomain", 257], ["OtherDomain", 260]]) {
        const error = fault("native", { ...native(NO_TARGET), domain, code });
        const io = missingSelectionIO(error);

        assert.throws(() => execute(NO_TARGET, hostFor(io)), (caught) => caught === error);
        assert.equal(calls(io).includes("launch"), false);
    }
});

test("a permission fault or an unexpected error during link following keeps its identity", () => {
    const errors = [
        fault("native", { ...native(LINK, "readLink"), code: 257 }),
        Object.assign(new Error("unexpected"), { kind: "aliasUnresolved" })
    ];

    for (const error of errors) {
        const io = fixture({ [LINK]: { kind: "symlink" } }, {
            readLink() { throw error; }
        });

        assert.throws(() => execute(LINK, hostFor(io)), (caught) => caught === error);
        assert.equal(calls(io).includes("launch"), false);
    }
});
