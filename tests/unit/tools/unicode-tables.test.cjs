"use strict";

/*
 * The gate's check that the committed Unicode tables are what their data
 * generates -- shown able to fail, not only observed passing.
 */

const assert = require("node:assert/strict");
const test = require("node:test");

const load = () => import("../../../tools/lint/unicode-tables.mjs");

test("tables that match what the data generates pass", async () => {
    const { checkUnicodeTables } = await load();

    assert.equal(await checkUnicodeTables(() => Promise.resolve("same"), () => Promise.resolve("same")), "Unicode tables current");
});

test("tables that differ in any way fail, saying how to regenerate", async () => {
    const { checkUnicodeTables } = await load();

    await assert.rejects(
        checkUnicodeTables(() => Promise.resolve("generated"), () => Promise.resolve("edited")),
        /^Error: src\/core\/unicode-tables\.js is not what tools\/unicode\/data generates; run node tools\/unicode\/generate\.mjs$/u
    );
});
