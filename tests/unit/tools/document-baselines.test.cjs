"use strict";

/*
 * AGENTS.md is a baseline shared across repositories and quoted unchanged.
 * Its backticked names are examples of naming, not files in this one.
 */

const assert = require("node:assert/strict");
const test = require("node:test");

const load = () => import("../../../tools/lint/document-references.mjs");

test("the shared agent baseline's examples are not references to resolve", async () => {
    const { missingReferences } = await load();
    const documents = {
        files: ["AGENTS.md", "README.md"],
        texts: ["Prefer `api/v2` to `Parser`.\n", "See `api/v2`.\n"]
    };

    assert.deepEqual(await missingReferences(documents, () => Promise.resolve(false)), [
        "api/v2 (named by README.md)"
    ]);
});
