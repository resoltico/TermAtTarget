"use strict";

/*
 * Where each version declaration is read from, how it is reported when they
 * disagree, and version numbers wider than one digit per component -- every
 * other fixture uses 1.2.3, where a per-component `\d` and `\d+` cannot be
 * told apart.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { fakeRepo, packageJson, lockJson, loadConsistency } = require("./fake-repo.cjs");

test("a version component with more than one digit is read whole", async () => {
    // Every component, not just one: with 1.20.30 the leading \d and \d+
    // behave identically and the first component goes unchecked. 0.10.0 will
    // happen, and truncating it to 0.1.0 would compare the wrong numbers
    // while appearing to agree.
    const { checkVersion } = await loadConsistency();
    const wide = {
        "package.json": packageJson({ version: "10.20.30" }),
        "package-lock.json": lockJson("10.20.30"),
        "INSTALL.txt": "TERM AT TARGET 10.20.30 — SHORTCUTS INSTALLATION",
        "CHANGELOG.md": "# Changelog\n\n## [10.20.30] - 2026-01-01\n"
    };

    assert.equal(await checkVersion(fakeRepo(wide)), "10.20.30");
});

test("a disagreement in a later digit is still a disagreement", async () => {
    const { checkVersion } = await loadConsistency();

    await assert.rejects(
        () => checkVersion(fakeRepo({
            "INSTALL.txt": "TERM AT TARGET 1.2.30 — SHORTCUTS INSTALLATION"
        })),
        /versions disagree/u
    );
});

/*
 * One row per version declaration: the file, a value that disagrees with the
 * rest of the fixture, and the label the error is required to use for it.
 */
const DISAGREEMENTS = [
    ["INSTALL.txt", "TERM AT TARGET 9.9.9 — SHORTCUTS INSTALLATION", "INSTALL.txt: 9.9.9"],
    ["CHANGELOG.md", "# Changelog\n\n## [9.9.9] - 2026-01-01\n", "CHANGELOG.md (newest entry): 9.9.9"],
    ["package-lock.json", lockJson("9.9.9", "project", { version: "1.2.3" }), "package-lock.json: 9.9.9"],
    ["package-lock.json", lockJson("1.2.3", "project", { version: "9.9.9" }),
        "package-lock.json (root package): 9.9.9"],
    ["package.json", packageJson({ version: "9.9.9" }), "package.json: 9.9.9"]
];

test("each file that states the version is compared, and named", async () => {
    // The label matters as much as the detection: an error that says the
    // versions disagree without saying where sends you looking through five
    // files by hand.
    const { checkVersion } = await loadConsistency();

    await Promise.all(DISAGREEMENTS.map(([name, content, label]) =>
        assert.rejects(
            () => checkVersion(fakeRepo({ [name]: content })),
            (error) => {
                assert.match(error.message, /versions disagree between files/u);
                assert.ok(error.message.includes(label), `the error must read "${label}", not: ${error.message}`);

                return true;
            },
            `${name} disagreeing must be caught`
        )));
});

test("only a bracketed top-level heading states the version", async () => {
    const { checkVersion } = await loadConsistency();

    // Two things must not be read as the newest release: a "### [9.9.9]"
    // subheading, which contains "## [9.9.9]" without the line-start anchor,
    // and the Unreleased section that Keep a Changelog puts above it.
    await assert.doesNotReject(() => checkVersion(fakeRepo({
        "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n\n### [9.9.9] draft\n\n" +
            "## [1.2.3] - 2026-01-01\n"
    })));
});

test("the package name is compared between the manifest and its lockfile", async () => {
    // A rename that skips the lockfile leaves `npm ci` installing against a
    // lockfile written for some other package.
    const { checkPackageName } = await loadConsistency();

    assert.equal(await checkPackageName(fakeRepo()), "project");

    await Promise.all([
        [lockJson("1.2.3", "renamed", { name: "project" }), "package-lock.json: renamed"],
        [lockJson("1.2.3", "project", { name: "renamed" }), "package-lock.json (root package): renamed"]
    ].map(([lock, label]) => assert.rejects(
        () => checkPackageName(fakeRepo({ "package-lock.json": lock })),
        (error) => {
            assert.match(error.message, /^package names disagree between files:/u);
            assert.ok(error.message.includes(label), label);

            return true;
        }
    )));
});
