"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { spawnSync } = require("node:child_process");
const { mkdtemp, writeFile, rm } = require("node:fs/promises");
const path = require("node:path");
const { tmpdir } = require("node:os");

const verifier = path.resolve(__dirname, "../../tools/verify-native.mjs");
const commit = "05c5604e28447f43e1613d5d66ab6f65c262c20c";
const supervisor = {
    quiet: { finished: true, status: 0 },
    failing: { finished: true, status: 3 },
    lingering: { finished: true, status: 1 },
    flood: { finished: false, stopped: true },
    stubborn: { finished: false, stopped: false },
    unstartable: "native"
};
const { HEADLESS_CASE_IDS } = require("../../tests/integration/headless-cases.mjs");
const { EXPECTED, NAMES } = require("../../tests/integration/presentation-corpus.mjs");
const presentation = {
    paritySamples: NAMES.length,
    expectedSamples: EXPECTED.length,
    parityInputs: NAMES,
    expectedInputs: EXPECTED.map(([input]) => input)
};
const evidence = {
    source: { commit, clean: true },
    artifactSha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    os: "Version 15.6.1 (Build 24G90)",
    architecture: "arm64",
    result: "passed",
    scope: ["headless"],
    compiled: true,
    aliasVolumeStayedDetached: true,
    passed: HEADLESS_CASE_IDS,
    count: HEADLESS_CASE_IDS.length,
    preferences: true,
    overlappingPreferences: true,
    presentation,
    supervisor
};

async function rejectsChanges(temp, run) {
    const invalid = [
        { source: { commit: "other", clean: true } },
        { source: { ...evidence.source, clean: false } },
        { artifactSha256: "other" },
        { result: "cancelled" },
        { architecture: "x64" },
        { os: "Version 27.2.1 (Build 26B131)" },
        { scope: null },
        { scope: ["dialogs"] },
        { passed: null },
        { passed: [] },
        { count: 0 },
        { passed: [null], supervisor: undefined, presentation: undefined, preferences: undefined },
        { passed: ["one placeholder case"], count: 1, presentation: { paritySamples: 1, expectedSamples: 1 } },
        { passed: HEADLESS_CASE_IDS.slice(1), count: HEADLESS_CASE_IDS.length - 1 },
        { passed: ["substitute", ...HEADLESS_CASE_IDS.slice(1)] },
        { passed: HEADLESS_CASE_IDS.map(() => HEADLESS_CASE_IDS[0]) },
        { presentation: { ...presentation, parityInputs: NAMES.slice(1) } },
        { presentation: { ...presentation, expectedInputs: ["placeholder", ...presentation.expectedInputs.slice(1)] } },
        { compiled: false },
        { aliasVolumeStayedDetached: false },
        { preferences: undefined },
        { overlappingPreferences: undefined },
        { presentation: undefined },
        { presentation: { ...presentation, expectedSamples: 0 } },
        { presentation: { ...presentation, paritySamples: "29" } },
        { supervisor: undefined },
        { supervisor: { ...supervisor, quiet: { finished: false, status: 0 } } },
        { supervisor: { ...supervisor, quiet: { finished: true, status: 1 } } },
        { supervisor: { ...supervisor, flood: undefined } },
        { supervisor: { ...supervisor, flood: { finished: false, stopped: false } } },
        { supervisor: { ...supervisor, stubborn: undefined } },
        { supervisor: { ...supervisor, stubborn: { finished: false, stopped: true } } },
        { supervisor: { ...supervisor, unstartable: null } }
    ];

    assert.notEqual(run(undefined, "").status, 0, "missing expected commit");

    await Promise.all(invalid.map(async (change, index) => {
        const report = path.join(temp, `invalid-${index}.json`);

        await writeFile(report, JSON.stringify({ ...evidence, ...change }));
        assert.notEqual(run(report).status, 0, JSON.stringify(change));
    }));
}

test("the release checks native evidence from the claimed source, artifact and runner", async () => {
    const temp = await mkdtemp(path.join(tmpdir(), "term-at-target-evidence-"));
    const artifact = path.join(temp, "artifact");
    const run = (file = path.join(temp, "report.json"), expected = commit) =>
        spawnSync(process.execPath, [verifier, file, artifact, expected], { encoding: "utf8" });

    try {
        await writeFile(artifact, "hello");
        assert.notEqual(run().status, 0, "missing report");
        await writeFile(path.join(temp, "report.json"), JSON.stringify(evidence));
        assert.equal(run().status, 0);
        await rejectsChanges(temp, run);
    } finally {
        await rm(temp, { recursive: true, force: true });
    }
});
