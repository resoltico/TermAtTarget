"use strict";

/*
 * The install command is stated in three places, and a copy that drifts is a
 * macOS job that quietly stops linting the workflows.
 */

const assert = require("node:assert/strict");
const test = require("node:test");

const load = () => import("../../../tools/lint/toolchain.mjs");

function repo(overrides = {}) {
    const files = {
        "CONTRIBUTING.md": "```sh\nbrew install actionlint\n```\n",
        ".github/workflows/quality.yml": "      - run: brew install actionlint\n",
        ".github/workflows/release.yml": "      - run: brew install actionlint\n",
        ...overrides
    };

    return (file) => Promise.resolve(files[file]);
}

test("agreeing install commands are accepted and returned", async () => {
    const { checkToolchain } = await load();

    assert.equal(await checkToolchain(repo()), "actionlint");
    assert.equal(await checkToolchain(repo({
        "CONTRIBUTING.md": "brew install shellcheck actionlint\n",
        ".github/workflows/quality.yml": "brew install shellcheck actionlint\n",
        ".github/workflows/release.yml": "brew install shellcheck actionlint  \n"
    })), "shellcheck actionlint", "compared trimmed");
});

test("every stated copy is compared, and named with its place", async () => {
    // Two in one file are two copies: numbered, so the one that drifted can
    // be found.
    const { checkToolchain } = await load();

    await assert.rejects(
        () => checkToolchain(repo({ "CONTRIBUTING.md": "brew install actionlint\nbrew install shellcheck\n" })),
        (error) => {
            assert.equal(error.message, [
                "install commands disagree between files:",
                "  .github/workflows/quality.yml (1): actionlint",
                "  .github/workflows/release.yml (1): actionlint",
                "  CONTRIBUTING.md (1): actionlint",
                "  CONTRIBUTING.md (2): shellcheck"
            ].join("\n"));

            return true;
        }
    );
});

test("a file that stops stating the command is an error, not a pass", async () => {
    const { checkToolchain } = await load();

    await assert.rejects(
        () => checkToolchain(repo({ ".github/workflows/release.yml": "- run: npm ci\n" })),
        /^Error: \.github\/workflows\/release\.yml no longer documents the install command$/u
    );
});

test("an install that leaves out actionlint is refused", async () => {
    // Agreement alone would accept three copies that all forgot it.
    const { checkToolchain } = await load();
    const without = "brew install shellcheck\n";

    await assert.rejects(
        () => checkToolchain(repo({
            "CONTRIBUTING.md": without,
            ".github/workflows/quality.yml": without,
            ".github/workflows/release.yml": without
        })),
        /^Error: the documented install \(shellcheck\) does not provide actionlint, so no job would ever lint the workflows$/u
    );
    await assert.rejects(
        () => checkToolchain(repo({
            "CONTRIBUTING.md": "brew install actionlint-extra\n",
            ".github/workflows/quality.yml": "brew install actionlint-extra\n",
            ".github/workflows/release.yml": "brew install actionlint-extra\n"
        })),
        /does not provide actionlint/u,
        "a formula whose name starts with it is not it"
    );
});

test("the repository's own copies agree", async () => {
    const { checkToolchain } = await load();

    assert.equal(await checkToolchain(), "actionlint");
});
