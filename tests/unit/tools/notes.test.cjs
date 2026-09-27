"use strict";

/*
 * A release's notes: the one CHANGELOG section for its version, dated with a
 * real date and saying something -- and a tag that names the version the
 * repository declares.
 */

const assert = require("node:assert/strict");
const test = require("node:test");

const load = () => import("../../../tools/notes.mjs");
const SAMPLE = "# Changelog\n\n## [1.1.0] - 2026-09-21\n\n### Added\n\n- One.\n\n## [1.0.0] - 2025-01-01\n\n- First.\n";

test("a section runs from its heading to the next, trimmed", async () => {
    const { extractNotes } = await load();

    assert.equal(extractNotes(SAMPLE, "1.1.0"), "## [1.1.0] - 2026-09-21\n\n### Added\n\n- One.\n");
    assert.equal(extractNotes(SAMPLE, "1.0.0"), "## [1.0.0] - 2025-01-01\n\n- First.\n");
});

test("a version with no section, or with two, is refused", async () => {
    const { extractNotes } = await load();

    for (const changelog of ["# Empty\n", SAMPLE + SAMPLE, "## [1.1.0]\n\n- Undated.\n", "## [1.1.01] - 2026-01-01\nText"]) {
        assert.throws(
            () => extractNotes(changelog, "1.1.0"),
            /^Error: CHANGELOG must contain exactly one section for 1\.1\.0\.$/u,
            changelog
        );
    }
});

test("a section with nothing in it is refused", async () => {
    const { extractNotes } = await load();

    for (const changelog of ["## [1.1.0] - 2026-09-21\n", "## [1.1.0] - 2026-09-21\n\n  \n## [1.0.0] - 2025-01-01\n- x\n"]) {
        assert.throws(() => extractNotes(changelog, "1.1.0"), /^Error: The release notes section is empty\.$/u);
    }
});

test("a heading dated with anything but an ISO date is refused", async () => {
    const { extractNotes } = await load();

    for (const heading of ["## [1.1.0] - today", "## [1.1.0] - 2026-9-21", "## [1.1.0] - 2026-09-21 (draft)"]) {
        assert.throws(
            () => extractNotes(`${heading}\nText`, "1.1.0"),
            /^Error: The release heading must have an ISO date\.$/u,
            heading
        );
    }
});

test("a date that is not on the calendar is refused", async () => {
    const { extractNotes } = await load();

    for (const date of ["2026-02-30", "2026-13-01", "2026-00-10", "2025-02-29"]) {
        assert.throws(
            () => extractNotes(`## [1.1.0] - ${date}\nText`, "1.1.0"),
            /^Error: The release heading must have a real calendar date\.$/u,
            date
        );
    }

    assert.doesNotThrow(() => extractNotes("## [1.1.0] - 2028-02-29\nText", "1.1.0"), "a leap day is a date");
});

test("the release date is read from the notes' heading", async () => {
    const { extractNotes, releaseDate } = await load();

    assert.equal(releaseDate(extractNotes(SAMPLE, "1.0.0")), "2025-01-01");
});

test("a tag must be v and the declared version exactly", async () => {
    const { checkTag } = await load();
    const { version } = require("../../../package.json");

    const refused = new RegExp(`^Error: The tag must equal v${version.replaceAll(".", "\\.")}\\.$`, "u");

    await Promise.all(["v0.9.0", version, `V${version}`, `v${version}-rc`, undefined]
        .map((tag) => assert.rejects(checkTag(tag), refused, String(tag))));

    assert.match(await checkTag(`v${version}`), new RegExp(`^## \\[${version.replaceAll(".", "\\.")}\\] - `, "u"));
});
