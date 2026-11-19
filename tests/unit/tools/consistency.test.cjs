"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { fakeRepo, loadConsistency, packageJson, lockJson } = require("./fake-repo.cjs");

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

test("checkConsistency summarises every fact it agreed", async () => {
    const { checkConsistency } = await loadConsistency();

    assert.equal(
        await checkConsistency(fakeRepo()),
        "project 1.2.3, node 26.8.1, npm 12.2.1, ES2022, https://github.com/someone/Project"
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
    const { checkVersion } = await loadConsistency();

    await assert.rejects(
        () => checkVersion(fakeRepo({ "INSTALL.txt": "no version here" })),
        /could not find the declared value in INSTALL\.txt/u
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

test("a version component with more than one digit is read whole", async () => {
    // A multi-digit value in every component detects a one-digit match.
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

test("the repository URL is one address, stated in four places", async () => {
    // The banner is generated from package.json and cannot drift; the
    // documents a user reads state it in prose, and a stale URL in the file
    // someone follows is worse than no URL at all.
    const { checkRepositoryUrl } = await loadConsistency();
    const agreed = {
        "package.json": JSON.stringify({
            homepage: "https://github.com/someone/Project",
            repository: {
                type: "git",
                url: "git+https://github.com/someone/Project.git"
            }
        }),
        "README.md": "See https://github.com/someone/Project for more.\n",
        "INSTALL.txt": "    https://github.com/someone/Project\n"
    };

    assert.equal(
        await checkRepositoryUrl((file) => Promise.resolve(agreed[file])),
        "https://github.com/someone/Project"
    );
});

test("a document naming a different repository fails the gate", async () => {
    const { checkRepositoryUrl } = await loadConsistency();
    const drifted = {
        "package.json": JSON.stringify({
            homepage: "https://github.com/someone/Project",
            repository: { url: "git+https://github.com/someone/Project.git" }
        }),
        "README.md": "See https://github.com/someone/Renamed for more.\n",
        "INSTALL.txt": "    https://github.com/someone/Project\n"
    };

    await assert.rejects(
        () => checkRepositoryUrl((file) => Promise.resolve(drifted[file])),
        (error) => {
            assert.match(error.message, /repository URLs disagree between files/u);
            assert.match(error.message, /README\.md: .*\/Renamed/u);

            return true;
        }
    );
});

test("a repository whose name ends in .io keeps its name", async () => {
    // npm states the repository as git+URL.git, and both ends have to come
    // off that exact way round. Taking the first ".git" anywhere turns
    // someone.github.io into someonehub.io, and the gate then reports a
    // disagreement between a URL and itself.
    const { checkRepositoryUrl } = await loadConsistency();
    const url = "https://github.com/someone/someone.github.io";
    const agreed = {
        "package.json": JSON.stringify({
            homepage: url,
            repository: { type: "git", url: `git+${url}.git` }
        }),
        "README.md": `See ${url} for more.\n`,
        "INSTALL.txt": `    ${url}\n`
    };

    assert.equal(
        await checkRepositoryUrl((file) => Promise.resolve(agreed[file])),
        url
    );
});

test("the disagreement names every place the URL is stated", async () => {
    // Four sources, and a message that reports the values without saying
    // which file each came from sends the reader to look through all of them.
    const { checkRepositoryUrl } = await loadConsistency();
    const drifted = {
        "package.json": JSON.stringify({
            homepage: "https://github.com/someone/Project",
            repository: { url: "git+https://github.com/someone/Renamed.git" }
        }),
        "README.md": "https://github.com/someone/Project\n",
        "INSTALL.txt": "https://github.com/someone/Project\n"
    };

    await assert.rejects(
        () => checkRepositoryUrl((file) => Promise.resolve(drifted[file])),
        (error) => {
            assert.equal(error.message, [
                "repository URLs disagree between files:",
                "  package.json homepage: https://github.com/someone/Project",
                "  package.json repository: https://github.com/someone/Renamed",
                "  README.md: https://github.com/someone/Project",
                "  INSTALL.txt: https://github.com/someone/Project"
            ].join("\n"));

            return true;
        }
    );
});
