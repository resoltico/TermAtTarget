"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

/*
 * Discovery decides what the gate is allowed to see. A file it misses is a
 * file with no size limit, no whitespace rules and no control-character
 * check — which is exactly how eslint.config.mjs once reached 173 lines.
 */
const loadDiscovery = () => import("../../../tools/lint/discovery.mjs");
const ROOT = path.resolve(__dirname, "../../..");
const SKIPPED = new Set(["node_modules", "dist", "build", ".git", ".stryker-tmp", "reports", "artifacts"]);

function everySourceFile(directory, found = []) {
    const entries = fs
        .readdirSync(path.join(ROOT, directory), { withFileTypes: true })
        .filter((entry) => !SKIPPED.has(entry.name));

    for (const entry of entries) {
        const relative = directory === "." ? entry.name : `${directory}/${entry.name}`;

        if (entry.isDirectory()) {
            everySourceFile(relative, found);
        } else if (/\.(?:js|mjs|cjs|jxa)$/u.test(entry.name)) {
            found.push(relative);
        }
    }

    return found;
}

test("no JavaScript file in the repository escapes the gate", async () => {
    const { lintableFiles } = await loadDiscovery();
    const checked = new Set(await lintableFiles());
    const missed = everySourceFile(".").filter((file) => !checked.has(file));

    assert.deepEqual(missed, [], "these files would be unchecked");
});

test("discovery reaches nested directories and root configuration", async () => {
    const { lintableFiles } = await loadDiscovery();
    const files = await lintableFiles();

    assert.ok(files.includes("eslint.config.mjs"), "root config");
    assert.ok(files.includes("tests/integration/native-body.jxa"), "the JXA the native suite runs");
    assert.ok(files.some((file) => file.startsWith("tools/lint/")), "nested tools");
    assert.ok(files.some((file) => file.startsWith("tests/unit/core/")), "nested tests");
    assert.ok(files.some((file) => file.startsWith("tests/unit/runtime/")), "nested tests");
    assert.ok(files.some((file) => file.startsWith("src/")), "source modules");
    // Each directory is walked once and the modules are listed once. Walking
    // the root instead would find src/ a second time, and every file under it
    // would be checked twice.
    assert.deepEqual(
        files.filter((file, at) => files.indexOf(file) !== at),
        [],
        "no file is listed twice"
    );
});

test("build output is not linted", async () => {
    const { lintableFiles } = await loadDiscovery();
    const files = await lintableFiles();

    assert.ok(!files.some((file) => file.startsWith("dist/")));
    assert.ok(!files.some((file) => file.includes("node_modules")));
});

test("the source-file test is anchored at the extension", async () => {
    const { isSourceFile } = await loadDiscovery();

    for (const name of ["a.js", "a.mjs", "a.cjs", "a.jxa", "deep.name.js"]) {
        assert.equal(isSourceFile(name), true, name);
    }

    // Unanchored, a backup or a template would be linted as source.
    for (const name of ["a.js.bak", "a.mjs~", "a.cjs.orig", "a.jxa.bak", "a.json", "ajs", "a.ts"]) {
        assert.equal(isSourceFile(name), false, name);
    }
});

test("the skip list covers every directory that is not ours, and no others", async () => {
    const { isSkipped } = await loadDiscovery();

    for (const name of ["node_modules", "dist", ".git", "reports", "artifacts", ".stryker-tmp"]) {
        assert.equal(isSkipped(name), true, name);
    }

    assert.equal(isSkipped("src"), false);
    assert.equal(isSkipped("tools"), false);
    assert.equal(isSkipped("tests"), false);

    // A skip entry for a directory nothing creates is not merely dead: if one
    // ever appeared, real source inside it would leave the gate silently.
    assert.equal(isSkipped("build"), false, "build/ is created by nothing here");
});

/*
 * The walk itself, driven against a fixture tree rather than observed passing
 * against a repository that already happens to be in order.
 */

function fixtureTree(files) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "discovery-"));

    for (const relative of files) {
        const target = path.join(base, relative);

        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, "\n");
    }

    test.after(() => fs.rmSync(base, { recursive: true, force: true }));

    return base;
}

test("discovery order does not depend on how the directory reads back", async () => {
    // readdir gives no ordering guarantee. "lib" sorts before "lib-extra.mjs"
    // as a directory entry, while "lib-extra.mjs" sorts before "lib/a.mjs" as
    // a path — so an unsorted walk reports a different order on a filesystem
    // that reads back differently, and the gate's own output stops being
    // reproducible.
    const { walk } = await loadDiscovery();
    const base = fixtureTree([
        "here/lib/a.mjs",
        "here/lib-extra.mjs",
        "here/notes.md"
    ]);

    assert.deepEqual(await walk("here", base), [
        "here/lib-extra.mjs",
        "here/lib/a.mjs"
    ]);
});

test("the walk skips what is not ours, at any depth", async () => {
    const { walk } = await loadDiscovery();
    const base = fixtureTree([
        "here/node_modules/x.mjs",
        "here/deep/deeper/y.cjs"
    ]);

    assert.deepEqual(await walk("here", base), ["here/deep/deeper/y.cjs"]);
});

test("the root itself is a directory the walk can be asked for", async () => {
    // Documents live at the top of the repository, so the walk has to name
    // what it finds there without a leading separator -- and must not descend
    // into the sandbox, which holds a copy of this whole repository.
    const { walk } = await loadDiscovery();
    const base = fixtureTree([
        "README.md",
        "docs/guide.md",
        "src/thing.js",
        ".stryker-tmp/README.md",
        "reports/mutation/index.md"
    ]);

    assert.deepEqual(
        await walk("", base, (name) => name.endsWith(".md")),
        ["README.md", "docs/guide.md"]
    );
});
