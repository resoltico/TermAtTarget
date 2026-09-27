"use strict";

/*
 * The release workflow's publishing job installs nothing.
 *
 * It holds the write and signing permissions, so the less code that runs there
 * the better -- and all it needs is the release notes, which come out of
 * CHANGELOG.md. Asserted from the import graph rather than by running it, so
 * the answer does not depend on whether node_modules happens to be present.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

// Entry points the publishing job runs without `npm ci`.
const DEPENDENCY_FREE = ["tools/release-notes.mjs"];
const IMPORT = /^import[^;]*?from\s+"(?<from>[^"]+)";/gmu;

function importsIn(relative) {
    const source = fs.readFileSync(path.join(ROOT, relative), "utf8");

    return [...source.matchAll(IMPORT)]
        .map((match) => match.groups.from)
        .filter((specifier) => !specifier.startsWith("node:"));
}

function reach(relative, seen, bare) {
    if (seen.has(relative)) {
        return;
    }

    seen.add(relative);

    for (const specifier of importsIn(relative)) {
        if (specifier.startsWith(".")) {
            reach(path.join(path.dirname(relative), specifier), seen, bare);
        } else {
            bare.set(specifier, relative);
        }
    }
}

function packagesReached(entry) {
    const seen = new Set();
    const bare = new Map();

    reach(entry, seen, bare);

    return { seen, bare };
}

test("the publishing job's entry points reach no installed package", () => {
    for (const entry of DEPENDENCY_FREE) {
        const { seen, bare } = packagesReached(entry);

        assert.deepEqual([...bare].map(([specifier, from]) => `${specifier} (from ${from})`), [],
            `${entry} must run without node_modules`);
        assert.ok(seen.size > 1, `${entry} imports something`);
    }
});

test("the graph walk sees a package when there is one", () => {
    // Otherwise the assertion above passes because nothing was looked at.
    const { bare } = packagesReached("tools/lint.mjs");

    assert.ok([...bare.keys()].includes("acorn"), `the gate does reach acorn: ${[...bare.keys()]}`);
});
