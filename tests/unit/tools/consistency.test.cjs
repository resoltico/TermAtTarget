"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { fakeRepo, packageJson, loadConsistency } = require("./fake-repo.cjs");

test("agreeing values are accepted and returned", async () => {
    const { assertAll } = await loadConsistency();

    assert.equal(
        assertAll("versions", [
            ["package.json", "0.3.0"],
            ["INSTALL.txt", "0.3.0"],
            ["CHANGELOG.md", "0.3.0"]
        ]),
        "0.3.0"
    );
});

test("a single disagreement is rejected and located", async () => {
    const { assertAll } = await loadConsistency();

    assert.throws(
        () => assertAll("versions", [
            ["package.json", "0.3.0"],
            ["INSTALL.txt", "0.2.0"]
        ]),
        (error) => {
            // One file per line: run together they read as a single value
            // rather than as a disagreement between two.
            assert.equal(
                error.message,
                "versions disagree between files:\n"
                + "  package.json: 0.3.0\n"
                + "  INSTALL.txt: 0.2.0"
            );

            return true;
        }
    );
});

test("agreeing version declarations are accepted", async () => {
    const { checkVersion } = await loadConsistency();

    assert.equal(await checkVersion(fakeRepo()), "1.2.3");
});

test("each file that states the Node version is compared", async () => {
    const { checkNodeVersion } = await loadConsistency();
    const disagreements = {
        ".node-version": "24.0.0\n",
        "mise.toml": '[tools]\nnode = "24.0.0"\n',
        "package.json": packageJson({ engines: { node: ">=24.0.0" } })
    };

    await Promise.all(Object.entries(disagreements).map(([file, content]) =>
        assert.rejects(
            () => checkNodeVersion(fakeRepo({ [file]: content })),
            /Node versions disagree between files/u,
            `${file} disagreeing must be caught`
        )));
});

test("checkConsistency summarises every fact it agreed", async () => {
    const { checkConsistency } = await loadConsistency();

    assert.equal(
        await checkConsistency(fakeRepo()),
        "project 1.2.3, node 26.8.1, ES2022, https://github.com/someone/Project"
    );
});

test("the agreed version must have dated release notes to publish", async () => {
    // Agreement alone would pass a version bumped everywhere and described
    // nowhere, and the release would fail at its last step.
    const { checkConsistency } = await loadConsistency();

    await assert.rejects(
        () => checkConsistency(fakeRepo({ "CHANGELOG.md": "# Changelog\n\n## [1.2.3] - 2026-01-01\n" })),
        /release notes section is empty/u
    );
    await assert.rejects(
        () => checkConsistency(fakeRepo({ "CHANGELOG.md": "# Changelog\n\n## [1.2.3]\n\n- A thing.\n" })),
        /exactly one section for 1\.2\.3/u
    );
});

test("a file that no longer states the fact is an error", async () => {
    const { checkVersion, checkNodeVersion } = await loadConsistency();

    await assert.rejects(
        () => checkVersion(fakeRepo({ "INSTALL.txt": "no version here" })),
        /could not find the declared value in INSTALL\.txt/u
    );
    await assert.rejects(
        () => checkNodeVersion(fakeRepo({ "mise.toml": "[tools]\n" })),
        /could not find the declared value in mise\.toml/u
    );
});

test("a file the gate depends on going missing is explained, not thrown raw", async () => {
    // Renaming INSTALL.txt to Markdown used to surface as a bare ENOENT stack,
    // which is a confusing way to discover a convention.
    const { readFromDisk } = await loadConsistency();

    await assert.rejects(
        () => readFromDisk("INSTALL.md"),
        (error) => {
            // Whole: the point is to say what to do next, and the last
            // clause is the reason the file is not simply renamed.
            assert.equal(error.message,
                "INSTALL.md is missing, and the gate checks it for a fact " +
                "other files state too. If it was renamed, update " +
                "tools/lint/consistency.mjs as well; INSTALL.txt in " +
                "particular is deliberately plain text.");
            assert.ok(!/ENOENT/u.test(error.message));
            // The filesystem's own answer is kept, for whoever needs it.
            assert.equal(error.cause.code, "ENOENT");

            return true;
        }
    );
    // Text, not bytes. readFile with a missing encoding hands back a Buffer
    // instead of throwing, and most callers coerce it without noticing —
    // until one of them calls a string method on it.
    const text = await readFromDisk("INSTALL.txt");

    assert.equal(typeof text, "string");
    assert.match(text, /TERM AT TARGET/u);
});
