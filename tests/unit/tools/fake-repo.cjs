"use strict";

/*
 * A fake repository, so the consistency checks are exercised against
 * controlled contents rather than only against the real tree.
 *
 * Every default here uses single-digit version components, which is what most
 * cases want; the width cases in consistency-versions.test.cjs override them.
 */
function packageJson(overrides = {}) {
    return JSON.stringify({
        name: "project",
        version: "1.2.3",
        engines: { node: ">=26.8.1" },
        homepage: "https://github.com/someone/Project",
        repository: { type: "git", url: "git+https://github.com/someone/Project.git" },
        termAtTarget: { runtimeLanguage: "ES2022", minimumMacOS: "12.3" },
        ...overrides
    });
}

function lockJson(version = "1.2.3", name = "project", rootOverrides = {}) {
    return JSON.stringify({
        name,
        version,
        packages: { "": { name, version, ...rootOverrides } }
    });
}

function fakeRepo(overrides = {}) {
    const files = {
        "package.json": packageJson(),
        "package-lock.json": lockJson(),
        "INSTALL.txt":
            "TERM AT TARGET 1.2.3 — SHORTCUTS INSTALLATION\nhttps://github.com/someone/Project\n",
        "CHANGELOG.md": "# Changelog\n\n## [1.2.3] - 2026-01-01\n\n### Fixed\n\n- A thing.\n",
        ".node-version": "26.8.1\n",
        "mise.toml": '[tools]\nnode = "26.8.1"\n',
        "eslint.config.mjs": "const JXA_ECMA_VERSION = 2022;\n",
        "README.md": "Source: https://github.com/someone/Project\n",
        ...overrides
    };

    return (relative) => Promise.resolve(files[relative]);
}

const loadConsistency = () => import("../../../tools/lint/consistency.mjs");

module.exports = { fakeRepo, packageJson, lockJson, loadConsistency };
