"use strict";

/*
 * The Node pin, which three files state, and the language year, which two
 * do: each must agree across all of them and, when it does not, say which
 * one is the odd one out.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { fakeRepo, packageJson, loadConsistency } = require("./fake-repo.cjs");

test("agreeing Node declarations are accepted", async () => {
    const { checkNodeVersion } = await loadConsistency();

    assert.equal(await checkNodeVersion(fakeRepo()), "26.8.1");
});

test("the Node pin is read whole as well", async () => {
    const { checkNodeVersion } = await loadConsistency();
    const wide = {
        "package.json": packageJson({ engines: { node: ">=26.11.100" } }),
        ".node-version": "26.11.100\n",
        "mise.toml": '[tools]\nnode = "26.11.100"\n'
    };

    assert.equal(await checkNodeVersion(fakeRepo(wide)), "26.11.100");
});

test("a Node pin disagreement names the file that disagrees", async () => {
    // An error that says the pins disagree without saying where sends you
    // through three files by hand.
    const { checkNodeVersion } = await loadConsistency();
    const disagreements = [
        [".node-version", "26.9.9\n", ".node-version: 26.9.9"],
        ["mise.toml", '[tools]\nnode = "26.9.9"\n', "mise.toml: 26.9.9"],
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
