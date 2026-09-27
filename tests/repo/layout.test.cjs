"use strict";

/*
 * What the repository is made of: no runtime dependency, a toolchain pinned
 * exactly, the configuration valid, and the documents a release ships present
 * and linked correctly.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { readFile, access } = require("node:fs/promises");
const path = require("node:path");
const pkg = require("../../package.json");

const ROOT = path.resolve(__dirname, "../..");
const read = (name) => readFile(path.join(ROOT, name), "utf8");

test("the package declares no runtime dependency at all", () => {
    // The artifact is one self-contained script: nothing is installed at run
    // time, so there is nothing for the package to depend on.
    assert.equal(pkg.dependencies, undefined);
    assert.equal(pkg.license, "MIT");
});

test("the development toolchain is pinned exactly, and the lockfile agrees", async () => {
    // A range would let `npm install` change what the gate is made of.
    const lock = JSON.parse(await read("package-lock.json"));

    for (const [name, version] of Object.entries(pkg.devDependencies)) {
        assert.match(version, /^\d+\.\d+\.\d+$/u, `${name} is pinned exactly`);
    }

    assert.deepEqual(lock.packages[""].devDependencies, pkg.devDependencies);
});

test("the committed configuration is valid", async () => {
    const { validateConfig } = require("../../src/core/config.js");

    const config = JSON.parse(await read("config.json"));

    assert.doesNotThrow(() => validateConfig(config));
});

test("Node resolves #metadata and #config to what the bundle embeds", async () => {
    // The artifact inlines the object tools/repository.mjs derives; Node reads
    // tools/metadata.cjs through package.json "imports". They must be one.
    const { metadata } = await import("../../tools/repository.mjs");

    assert.deepEqual(require("#metadata"), await metadata());
    assert.deepEqual(require("#config"), JSON.parse(await read("config.json")));
});

test("the documents a release carries are all present", async () => {
    const documents = ["QA.md", "README.md", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md", "INSTALL.txt", "LICENSE"];

    await Promise.all(documents.map((name) => assert.doesNotReject(access(path.join(ROOT, name)), name)));
});

const LINK = /\]\((?<target>[^)]+)\)/gu;
const EXTERNAL = /^[a-z]+:/iu;

// Every local link in a Markdown document, as the path it points at.
function localLinks(name, text) {
    return [...text.matchAll(LINK)]
        .map((match) => match.groups.target.split("#")[0])
        .filter((target) => target !== "" && !EXTERNAL.test(target))
        .map((target) => path.resolve(ROOT, path.dirname(name), target));
}

test("every local link in a document resolves inside the repository", async () => {
    const { filesBelow } = await import("../../tools/repository.mjs");
    const documents = (await filesBelow()).filter((name) => name.endsWith(".md"));
    const links = (await Promise.all(documents.map(async (name) => localLinks(name, await read(name))))).flat();

    assert.ok(links.length > 0, "the documents link to something");

    for (const resolved of links) {
        assert.ok(resolved.startsWith(`${ROOT}${path.sep}`), `${resolved} is inside the repository`);
    }

    await Promise.all(links.map((resolved) => assert.doesNotReject(access(resolved), resolved)));
});
