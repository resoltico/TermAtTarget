"use strict";

/*
 * The release qualifies and reproduces the artifact before publication. Pinning and syntax are the gate's (tools/lint/workflow-rules.mjs);
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

function job(workflow, name) {
    const section = workflow.split(/^ {2}(?=[a-z][a-z-]*:$)/mu).find((part) => part.startsWith(`${name}:\n`));

    assert.ok(section, name);
    return section;
}

function checkReleaseJobs(release) {
    const reproduce = job(release, "reproduce");
    const publish = job(release, "publish");
    const permissions = reproduce.match(/^ {4}permissions:\n(?<scope>(?: {6}[^\n]+\n)+)/mu);

    assert.equal(permissions?.groups.scope.trim(), "contents: read", "reproduce must have read-only contents permissions");
    assert.doesNotMatch(publish, /\bnpm\s+(?:ci|install|i|exec)\b|\bnpx\b|\b(?:brew|apt-get|apt|yarn|pnpm)\s+install\b/u,
        "publish must perform no dependency installation");
}

test("qualification runs the gate, build and native suite before it uploads", async () => {
    const qualify = job(await read("release.yml"), "qualify");
    const steps = ["npm run quality", "npm run build", "npm run test:integration:macos", "npm run package", "actions/upload-artifact"];
    const locations = steps.map((step) => qualify.indexOf(step));

    assert.ok(locations.every((location) => location >= 0));
    assert.deepEqual(locations, [...locations].sort((left, right) => left - right));
});

test("a minimal Linux job rebuilds the same commit and compares both macOS artifacts", async () => {
    const release = await read("release.yml");
    const reproduce = job(release, "reproduce");

    checkReleaseJobs(release);
    assert.match(reproduce, /needs: qualify/u);
    assert.match(reproduce, /runs-on: ubuntu-latest/u);
    assert.match(reproduce, /ref: \$\{\{ github.sha \}\}/u);
    assert.match(reproduce, /npm ci --ignore-scripts/u);
    assert.match(reproduce, /npm run build/u);
    assert.match(reproduce, /name: qualified-release/u);
    assert.ok(["Term-At-Target.jxa", "SHA256SUMS"].every((name) => reproduce.includes(`cmp dist/${name} qualified/dist/${name}`)),
        "both files are compared");
});

test("the release job checks reject write access for reproduction and installs during publish", async () => {
    const release = await read("release.yml");
    const writeGrant = release.replace("    permissions:\n      contents: read", "    permissions:\n      contents: write");
    const installs = release.replace("      - name: Verify downloaded bytes", "      - run: npm ci --ignore-scripts\n      - name: Verify downloaded bytes");

    assert.throws(() => checkReleaseJobs(writeGrant), /reproduce must have read-only contents permissions/u);
    assert.throws(() => checkReleaseJobs(installs), /publish must perform no dependency installation/u);
});

test("publication waits for qualification, verifies what it publishes, and writes its own notes", async () => {
    const publish = job(await read("release.yml"), "publish");

    assert.match(publish, /needs: \[qualify, reproduce\]/u);
    assert.match(publish, /gh attestation verify/u);
    assert.match(publish, /node tools\/release-notes\.mjs/u);
    assert.doesNotMatch(publish, /--generate-notes|--clobber/u);
});

test("there is no second copy of the release notes", async () => {
    await assert.rejects(access(path.join(ROOT, ".github/release-notes")));
});
