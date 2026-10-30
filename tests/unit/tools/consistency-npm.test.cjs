"use strict";

/*
 * npm writes the lockfile, so the npm CI installs (packageManager) and the
 * floor engines enforces locally must name the same version.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { fakeRepo, packageJson, loadConsistency } = require("./fake-repo.cjs");

test("matching npm pins agree and are reported", async () => {
    const { checkNpmVersion } = await loadConsistency();

    assert.equal(await checkNpmVersion(fakeRepo()), "12.2.1");
});

test("a packageManager and engines floor that disagree are refused, naming both", async () => {
    const { checkNpmVersion } = await loadConsistency();
    const repo = fakeRepo({ "package.json": packageJson({ packageManager: "npm@12.3.0" }) });

    await assert.rejects(() => checkNpmVersion(repo), (error) => {
        assert.equal(error.message, "npm versions disagree between files:\n" +
            "  package.json packageManager: 12.3.0\n  package.json engines.npm: 12.2.1");

        return true;
    });
});

test("a pin that is not an exact npm version, or a floor that is not >=, is not read as one", async () => {
    const { checkNpmVersion } = await loadConsistency();

    await Promise.all(["pnpm@9.0.0", "npm@12", "npm@^12.2.1", undefined].map((packageManager) => assert.rejects(
        () => checkNpmVersion(fakeRepo({ "package.json": packageJson({ packageManager }) })),
        /could not find the declared value in package\.json packageManager/u, String(packageManager)
    )));

    await assert.rejects(() => checkNpmVersion(fakeRepo({ "package.json": packageJson({ engines: { node: ">=26.8.1", npm: "12.2.1" } }) })),
        /could not find the declared value in package\.json engines\.npm/u);
});
