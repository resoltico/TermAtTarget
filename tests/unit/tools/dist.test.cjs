"use strict";

/*
 * Whether the committed artifact is what the source renders to, shown able to
 * fail on a copy of the repository with one thing changed at a time. That the
 * real one passes is in tests/repo, since a mutation sandbox alters src/.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { mkdtemp, mkdir, cp, writeFile, readFile, rm } = require("node:fs/promises");
const path = require("node:path");
const { tmpdir } = require("node:os");

const ROOT = path.resolve(__dirname, "../../..");
const COPIED = ["src", "package.json"];

// A copy whose dist is freshly built from it, so the one change made after is
// the only thing wrong with it -- whatever state the committed dist is in.
async function builtCopy() {
    const { renderRelease, renderManifest } = await import("../../../tools/bundle.mjs");
    const temp = await mkdtemp(path.join(tmpdir(), "term-at-target-dist-test-"));

    test.after(() => rm(temp, { recursive: true, force: true }));
    await Promise.all(COPIED.map((name) => cp(path.join(ROOT, name), path.join(temp, name), { recursive: true })));

    const artifact = await renderRelease(temp);

    await mkdir(path.join(temp, "dist"));
    await writeFile(path.join(temp, "dist/Term-At-Target.jxa"), artifact);
    await writeFile(path.join(temp, "dist/SHA256SUMS"), renderManifest(artifact));

    return temp;
}

async function copyWith(relative, content) {
    const temp = await builtCopy();

    await writeFile(path.join(temp, relative), content);

    return temp;
}

const load = () => import("../../../tools/dist.mjs");

test("a freshly built copy passes, so each change below is what fails it", async () => {
    const { checkDist } = await load();

    await assert.doesNotReject(checkDist(await builtCopy()));
});

test("an edited artifact is stale", async () => {
    const { checkDist } = await load();

    await assert.rejects(
        checkDist(await copyWith("dist/Term-At-Target.jxa", "edited\n")),
        /^Error: dist is stale or edited\. Rebuild from source with npm run build\.$/u
    );
});

test("an edited manifest is refused", async () => {
    const { checkDist } = await load();

    await assert.rejects(
        checkDist(await copyWith("dist/SHA256SUMS", "wrong\n")),
        /^Error: The artifact checksum manifest is stale or invalid\.$/u
    );
});

test("a changed source module makes the committed artifact stale", async () => {
    const { checkDist } = await load();
    const changed = (await readFile(path.join(ROOT, "src/core/vocabulary.js"), "utf8")).replace("\"Ghostty\"", "\"Ghost\"");

    await assert.rejects(checkDist(await copyWith("src/core/vocabulary.js", changed)), /dist is stale/u);
});

test("a source module nothing reaches stops the render", async () => {
    const { checkDist } = await load();

    await assert.rejects(
        checkDist(await copyWith("src/core/extra.js", "\"use strict\";\n")),
        /^Error: Source modules the bundle does not reach: src\/core\/extra\.js$/u
    );
});

test("a module whose requires break the graph rules stops the render before anything is built", async () => {
    const { checkDist } = await load();

    await assert.rejects(
        checkDist(await copyWith("src/core/extra.js", "\"use strict\";\nrequire(\"../runtime/host.js\");\n")),
        /^Error: The portable core may not import a host adapter\.$/u
    );
});
