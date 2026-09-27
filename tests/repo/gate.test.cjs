"use strict";

/*
 * The gate applied to the real repository, through the same entry points
 * `npm run lint` calls, so a break in the wiring -- not just in a rule -- is
 * caught here too.
 */

const assert = require("node:assert/strict");
const test = require("node:test");

test("the artifact runs exactly the executables the source names", async () => {
    // The external surface is written down in one module. The artifact is a
    // render of src/, so it must name what that module names and nothing else.
    const { OPEN } = require("../../src/runtime/executables.js");
    const { executablePathsIn } = await import("../../tools/lint/source-rules.mjs");
    const { renderRelease } = await import("../../tools/bundle.mjs");

    assert.deepEqual(executablePathsIn(await renderRelease()), [OPEN]);
});

test("every file the gate discovers passes the source rules", async () => {
    const { lintableFiles } = await import("../../tools/lint/discovery.mjs");
    const { checkContent } = await import("../../tools/lint/source-rules.mjs");
    const { read } = await import("../../tools/repository.mjs");
    const files = await lintableFiles();
    const texts = await Promise.all(files.map((file) => read(file)));

    files.forEach((file, index) => assert.doesNotThrow(() => checkContent(file, texts[index]), file));
});

test("the repository's facts agree, its documents hold, and its ignore file is right", async () => {
    const { checkConsistency } = await import("../../tools/lint/consistency.mjs");
    const { checkDocumentReferences } = await import("../../tools/lint/document-references.mjs");
    const { checkIgnores } = await import("../../tools/lint/ignore-rules.mjs");

    assert.match(await checkConsistency(), /^term-at-target-macos \d+\.\d+\.\d+, node /u);
    assert.ok(await checkDocumentReferences() > 0);
    assert.ok(await checkIgnores() > 0);
});

test("the committed artifact and its manifest match the source", async () => {
    const { checkDist } = await import("../../tools/dist.mjs");

    await assert.doesNotReject(checkDist());
});

test("the committed Unicode tables are what the vendored data generates", async () => {
    const { checkUnicodeTables } = await import("../../tools/lint/unicode-tables.mjs");

    assert.equal(await checkUnicodeTables(), "Unicode tables current");
});
