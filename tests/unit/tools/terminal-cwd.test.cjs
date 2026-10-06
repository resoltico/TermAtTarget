"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const load = () => import("../../integration/terminal-cwd.mjs");

test("lsof names preserve literal Unicode and decode escaped UTF-8 bytes", async () => {
    const { decodeLsofName } = await load();
    assert.equal(decodeLsofName("/work/😀"), "/work/😀");
    assert.equal(decodeLsofName(String.raw`/work/\xf0\x9f\x98\x80`), "/work/😀");
    assert.equal(decodeLsofName(String.raw`/work/😀 \x41`), "/work/😀 A");
    assert.equal(decodeLsofName("/work/é"), "/work/é");
});
