"use strict";

/*
 * Characters a source file may not hold literally: controls, and anything
 * invisible or that moves the text around it. Each must be written as an
 * escape, since the artifact is pasted into an editor that shows none of them.
 */

const assert = require("node:assert/strict");
const test = require("node:test");

const loadRules = () => import("../../../tools/lint/source-rules.mjs");
const NUL = String.fromCharCode(0);
const DEL = String.fromCharCode(127);

test("a literal control character is rejected, with its position", async () => {
    // Invisible here, corrupting when pasted into the Shortcuts editor.
    const { checkContent } = await loadRules();

    assert.throws(
        () => checkContent("a.js", `const a = "x";\nconst b = "${NUL}";\n`),
        /a\.js:2: literal invisible or control character U\+0000/u
    );
    assert.throws(
        () => checkContent("a.js", `const a = "${DEL}";\n`),
        /literal invisible or control character U\+007F/u
    );
});

test("characters that hide or move text are rejected too, with their position", async () => {
    // Direction overrides and zero-width marks are how source that reads one
    // way compiles another. Built here from code points, so this file holds none.
    const { checkContent } = await loadRules();

    for (const code of [0x202E, 0x2066, 0x200B, 0x200F, 0x061C, 0x2028, 0x2029, 0x2060, 0xFEFF, 0x00A0, 0x0085, 0x3000]) {
        const hex = code.toString(16).toUpperCase().padStart(4, "0");

        assert.throws(
            () => checkContent("a.js", `const a = 1;\nconst b = "x${String.fromCodePoint(code)}";\n`),
            new RegExp(`^Error: a\\.js:2: literal invisible or control character U\\+${hex}; write it as an escape instead$`, "u"),
            hex
        );
    }
});

test("visible Unicode is ordinary text", async () => {
    const { checkContent } = await loadRules();

    assert.doesNotThrow(() => checkContent("a.js", `const a = "caf${String.fromCodePoint(0xE9)} ${String.fromCodePoint(0x1F600)}";\n`));
});

test("tabs and newlines are not treated as control characters", async () => {
    const { checkContent } = await loadRules();

    assert.doesNotThrow(() => checkContent("a.js", "if (x) {\n\treturn 1;\n}\n"));
});
