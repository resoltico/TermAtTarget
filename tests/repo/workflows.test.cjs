"use strict";

/*
 * The release workflow qualifies before it builds, and publishes only what it
 * qualified. Pinning and syntax are the gate's (tools/lint/workflow-rules.mjs);
 * this is the order of the steps, which no linter knows to care about.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { readFile, access } = require("node:fs/promises");
const path = require("node:path");
const pkg = require("../../package.json");

const ROOT = path.resolve(__dirname, "../..");
const read = (name) => readFile(path.join(ROOT, `.github/workflows/${name}`), "utf8");
const SCRIPT = /npm run (?<script>[\w:-]+)/gu;

test("every script a workflow runs exists", async () => {
    const workflows = await Promise.all(["quality.yml", "release.yml"].map(read));

    for (const workflow of workflows) {
        for (const match of workflow.matchAll(SCRIPT)) {
            assert.ok(Object.hasOwn(pkg.scripts, match.groups.script), `unknown script: ${match.groups.script}`);
        }
    }
});

test("both workflows check out without credentials, on the pinned Node, and run the native suite", async () => {
    const workflows = await Promise.all(["quality.yml", "release.yml"].map(read));

    for (const workflow of workflows) {
        assert.match(workflow, /persist-credentials: false/u);
        assert.match(workflow, /node-version-file: \.node-version/u);
        assert.match(workflow, /runs-on: macos-15/u);
        assert.match(workflow, /npm run test:integration:macos/u);
    }
});

test("a release checks the committed artifact before it rebuilds, and the rebuild must not differ", async () => {
    const release = await read("release.yml");
    const build = release.indexOf("npm run build");

    assert.ok(build > 0);
    assert.ok(release.indexOf("npm run quality") < build, "quality first");
    assert.ok(release.indexOf("npm run test:integration:macos") < build, "native suite first");
    assert.ok(release.indexOf("git diff --exit-code -- dist/") > build, "then the rebuild is compared");
});

test("publication waits for qualification, verifies what it publishes, and writes its own notes", async () => {
    const release = await read("release.yml");

    assert.match(release, /needs: qualify/u);
    assert.match(release, /gh attestation verify/u);
    assert.match(release, /node tools\/release-notes\.mjs/u);
    assert.doesNotMatch(release, /--generate-notes|--clobber/u);
});

test("there is no second copy of the release notes", async () => {
    await assert.rejects(access(path.join(ROOT, ".github/release-notes")));
});
