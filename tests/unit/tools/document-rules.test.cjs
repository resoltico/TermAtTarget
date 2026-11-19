"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

/*
 * The documents were the one part of this repository nothing read, and one of
 * them was carrying its own opening twice. Each guard is asserted to reject
 * what it exists to reject, and to let through what it must.
 */

const load = () => import("../../../tools/lint/document-rules.mjs");

const GOOD = "# Title\n\n## One\n\ntext\n\n## Two\n\nmore\n";

test("a well-formed document passes", async () => {
    const { checkDocument } = await load();

    assert.doesNotThrow(() => checkDocument("README.md", GOOD));
});

test("a section repeated in the same place is refused", async () => {
    // The shape a splice takes: a document that contains part of itself twice
    // reads as if it has two of the same section.
    const { checkDocument } = await load();

    assert.throws(
        () => checkDocument("CONTRIBUTING.md", `${GOOD}\n## One\n\nagain\n`),
        (error) => {
            assert.equal(error.message, "CONTRIBUTING.md: repeats ## One in " +
                "the same place; two sections cannot be the same section, and " +
                "text spliced into a document is how that happens");

            return true;
        }
    );
    assert.throws(
        () => checkDocument("a.md", "# T\n\n## One\n\n### Same\n\n### Same\n"),
        /repeats ### Same in the same place/u
    );
});

test("the same subheading under different sections is not a repeat", async () => {
    // Keep a Changelog puts "### Fixed" under every release that fixed
    // something. Comparing headings whole would refuse the second release --
    // a gate that blocks the next change is one somebody weakens.
    const { checkDocument } = await load();

    assert.doesNotThrow(() => checkDocument("CHANGELOG.md", [
        "# Changelog",
        "",
        "## [1.2.0]",
        "",
        "### Fixed",
        "",
        "## [1.1.0]",
        "",
        "### Fixed",
        ""
    ].join("\n")));
});

test("a document has exactly one title, and opens with it", async () => {
    const { checkDocument } = await load();

    assert.throws(
        () => checkDocument("a.md", "# One\n\n# Two\n"),
        (error) => {
            assert.equal(error.message, "a.md: has 2 top-level headings; a " +
                "document is one document and says so once");

            return true;
        }
    );
    assert.throws(
        () => checkDocument("a.md", "## Section\n\n# Title\n"),
        /opens with ## Section before its title/u
    );
    assert.throws(
        () => checkDocument("a.md", "## Section\n\ntext\n"),
        /has 0 top-level headings/u
    );
});

test("a Markdown file with no headings is not a document", async () => {
    // Otherwise every rule above passes over it silently.
    const { checkDocument } = await load();

    assert.throws(() => checkDocument("a.md", "just prose\n"), /has no headings/u);
});

test("a hash that is not a heading is not counted as one", async () => {
    // A heading starts its line. Prose that mentions one, and a hash with no
    // space after it, are text -- and reading either as a heading would refuse
    // a document for saying something perfectly ordinary.
    const { checkDocument } = await load();

    assert.doesNotThrow(
        () => checkDocument("a.md", "# Title\n\n#not a heading\n\n#\n")
    );
    assert.doesNotThrow(
        () => checkDocument("a.md", "See # Title below.\n\n# Title\n\n## One\n")
    );
});

test("a shipped document that is not Markdown is held to the hygiene only", async () => {
    // INSTALL.txt is deliberately plain text and underlines its headings, so
    // it has none to check -- but it goes out with the release, and a splice
    // into it would be just as invisible.
    const { checkDocument } = await load();

    assert.doesNotThrow(
        () => checkDocument("INSTALL.txt", "STAMP IMAGES\n==================\n")
    );
    assert.throws(
        () => checkDocument("INSTALL.txt", "text \n"),
        /INSTALL\.txt: has trailing whitespace/u
    );
});

test("the same hygiene the source files are held to", async () => {
    const { checkDocument } = await load();

    assert.throws(() => checkDocument("a.md", "# T\n\ntext \n"), /trailing whitespace/u);
    assert.throws(() => checkDocument("a.md", "# T\r\n"), /carriage return/u);
    assert.throws(() => checkDocument("a.md", "# T\n\ntext"), /does not end with a newline/u);
});

test("an invisible character in a document is refused, with its line", async () => {
    const { checkDocument } = await load();

    assert.throws(
        () => checkDocument("a.md", `# T\n\nsee ${String.fromCodePoint(0x202E)}here\n`),
        /^Error: a\.md:3: has an invisible or control character, U\+202E$/u
    );
});

/*
 * A heading is where it is as much as what it says. Compared whole, a Keep a
 * Changelog file repeats "### Fixed" under every release that fixed
 * something, and those are different sections.
 */

test("a heading is placed under the headings it sits below", async () => {
    const { headingPathsIn } = await load();
    const paths = headingPathsIn("# T\n\n## A\n\n### X\n\n## B\n\n### X\n");

    assert.deepEqual(paths.map((heading) => heading.path), [
        "# T",
        "# T > ## A",
        "# T > ## A > ### X",
        "# T > ## B",
        "# T > ## B > ### X"
    ]);
});

test("a level skipped over does not put a gap in the path", async () => {
    const { headingPathsIn } = await load();
    const paths = headingPathsIn("# T\n\n#### Deep\n");

    assert.deepEqual(paths.at(-1).path, "# T > #### Deep");
});

test("a hash inside a fenced code block is not a heading", async () => {
    // A shell comment in an example starts with a hash too. Read as a
    // heading, it gives the document a second title.
    const { headingPathsIn } = await load();
    const text = "# T\n\n```sh\n# a comment\nnpm test\n```\n\n## After\n";

    assert.deepEqual(headingPathsIn(text).map((heading) => heading.path), [
        "# T",
        "# T > ## After"
    ]);
});

test("a heading with nothing above it stands alone", async () => {
    // Nothing precedes it, so nothing is above it in the path either.
    const { headingPathsIn } = await load();

    assert.deepEqual(headingPathsIn("## A\n\ntext\n"), [
        { line: "## A", path: "## A" }
    ]);
});

/*
 * Which files are documents, and what happens when two of them are broken.
 */

const DISCOVERY_TEXT = "# Title\n\n## One\n\ntext\n";

test("Markdown and the two shipped plain files are documents", async () => {
    const { isDocument } = await load();

    for (const name of ["README.md", "QA.md", "INSTALL.txt", "LICENSE"]) {
        assert.equal(isDocument(name), true, name);
    }

    // The extension ends the name: a backup or a template is not the document.
    for (const name of [
        "package.json", "notes.txt", "LICENSE.js", "readme",
        "README.md.bak", "QA.md.tmpl"
    ]) {
        assert.equal(isDocument(name), false, name);
    }
});

test("the walk is asked for documents, from the repository root", async () => {
    // Asked for by predicate rather than filtered afterwards, so a directory
    // the walk skips -- .stryker-tmp holds a copy of this whole repository --
    // is never descended into for documents either.
    const { documentNames, isDocument } = await load();
    const calls = [];
    const find = (directory, base, wanted) => {
        calls.push({ directory, base, wanted });

        return Promise.resolve(["README.md"]);
    };

    assert.deepEqual(await documentNames(find), ["README.md"]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].directory, "", "the whole tree");
    assert.equal(calls[0].wanted, isDocument);
});

test("a repository with no documents is an error, not a pass", async () => {
    // A check that finds nothing to check reports success either way.
    const { checkDocuments } = await load();

    await assert.rejects(
        () => checkDocuments(() => Promise.resolve(DISCOVERY_TEXT), () => Promise.resolve([])),
        /no documents found/u
    );
});

test("every document found is checked, and the text is handed back", async () => {
    const { checkDocuments } = await load();
    const find = () => Promise.resolve(["A.md", "B.md"]);
    const read = (file) => Promise.resolve(`# ${file}\n\n## One\n`);
    const documents = await checkDocuments(read, find);

    assert.deepEqual(documents.files, ["A.md", "B.md"]);
    assert.deepEqual(documents.texts, ["# A.md\n\n## One\n", "# B.md\n\n## One\n"]);
});

test("two broken documents always report the same one first", async () => {
    // They are read together but checked in order. Reporting whichever
    // rejected first would make the message depend on disk timing.
    const { checkDocuments } = await load();
    const find = () => Promise.resolve(["A.md", "B.md"]);
    // A is answered a turn later, so an implementation that reported whichever
    // finished first would report B.
    const later = (text) => Promise.resolve().then(() => Promise.resolve(text));
    const read = (file) => (file === "A.md"
        ? later("# T\n\ntext \n")
        : Promise.resolve("# T\n\ntext \n"));

    await assert.rejects(
        () => checkDocuments(read, find),
        /^Error: A\.md: has trailing whitespace$/u
    );
});
