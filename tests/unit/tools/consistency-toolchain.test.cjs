"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { fakeRepo, packageJson, loadConsistency } = require("./fake-repo.cjs");

/*
 * The Node pin and the language year each appear in two places.
 * A disagreement names both declarations.
 */

test("agreeing Node declarations are accepted", async () => {
    const { checkNodeVersion } = await loadConsistency();

    assert.equal(await checkNodeVersion(fakeRepo()), "26.8.1");
});

test("the Node pin is read whole as well", async () => {
    const { checkNodeVersion } = await loadConsistency();
    const wide = {
        "package.json": packageJson({ engines: { node: ">=26.11.100" } }),
        ".node-version": "26.11.100\n"
    };

    assert.equal(await checkNodeVersion(fakeRepo(wide)), "26.11.100");
});

test("a Node pin disagreement names the file that disagrees", async () => {
    // An error that says the pins disagree without saying where sends you
    // through both files by hand.
    const { checkNodeVersion } = await loadConsistency();
    const disagreements = [
        [".node-version", "26.9.9\n", ".node-version: 26.9.9"],
        ["package.json", packageJson({ engines: { node: ">=26.9.9" } }), "package.json engines: 26.9.9"]
    ];

    await Promise.all(disagreements.map(([name, content, label]) =>
        assert.rejects(
            () => checkNodeVersion(fakeRepo({ [name]: content })),
            (error) => {
                assert.match(error.message, /Node versions disagree/u);
                assert.ok(error.message.includes(label), `the error must read "${label}", not: ${error.message}`);

                return true;
            }
        )));
});

test("the language year is stated once for the artifact and once for ESLint", async () => {
    // Raising one without the other would let src/ use syntax the artifact
    // says it does not, or hold src/ to a year the artifact no longer claims.
    const { checkLanguageYear } = await loadConsistency();

    assert.equal(await checkLanguageYear(fakeRepo()), "2022");

    await assert.rejects(
        () => checkLanguageYear(fakeRepo({ "eslint.config.mjs": "const JXA_ECMA_VERSION = 2024;\n" })),
        (error) => {
            assert.equal(error.message, [
                "language targets disagree between files:",
                "  package.json runtimeLanguage: 2022",
                "  eslint.config.mjs: 2024"
            ].join("\n"));

            return true;
        }
    );
});

test("a language that is not an ECMAScript year is not a target", async () => {
    const { checkLanguageYear } = await loadConsistency();

    await Promise.all(["ES22", "ES2022x", "2022", "es2022"].map((runtimeLanguage) => assert.rejects(
        () => checkLanguageYear(fakeRepo({ "package.json": packageJson({ termAtTarget: { runtimeLanguage } }) })),
        /could not find the declared value in package\.json runtimeLanguage/u,
        runtimeLanguage
    )));

    await assert.rejects(
        () => checkLanguageYear(fakeRepo({ "eslint.config.mjs": "const OTHER = 2022;\n" })),
        /could not find the declared value in eslint\.config\.mjs/u
    );
});

/*
 * npm writes the lockfile, so the npm CI installs (packageManager) and the
 * floor engines enforces locally must name the same version.
 */

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
