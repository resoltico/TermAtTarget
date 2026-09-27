"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { execFileSync } = require("node:child_process");

const loadRules = () => import("../../../tools/lint/source-rules.mjs");

test("well-formed content passes", async () => {
    const { checkContent } = await loadRules();

    assert.doesNotThrow(() => checkContent("a.js", "const a = 1;\n"));
});

test("a missing final newline is rejected", async () => {
    const { checkContent } = await loadRules();

    assert.throws(
        () => checkContent("a.js", "const a = 1;"),
        /a\.js: missing final newline/u
    );
});

test("trailing whitespace is rejected", async () => {
    const { checkContent } = await loadRules();

    assert.throws(
        () => checkContent("a.js", "const a = 1; \nconst b = 2;\n"),
        /trailing whitespace/u
    );
    assert.throws(
        () => checkContent("a.js", "const a = 1;\t\n"),
        /trailing whitespace/u
    );
});

test("carriage returns are rejected", async () => {
    const { checkContent } = await loadRules();

    assert.throws(
        () => checkContent("a.js", "const a = 1;\r\n"),
        /CR characters are forbidden/u
    );
});

test("a file over the size limit is rejected", async () => {
    const { checkContent, MAXIMUM_FILE_LINES } = await loadRules();
    const justUnder = `${"const a = 1;\n".repeat(MAXIMUM_FILE_LINES)}`;
    const justOver = `${"const a = 1;\n".repeat(MAXIMUM_FILE_LINES + 1)}`;

    assert.doesNotThrow(() => checkContent("a.js", justUnder));
    assert.throws(
        () => checkContent("a.js", justOver),
        /exceeds the 150-line limit; split it rather than raising the limit/u
    );
});

test("the file that is read is the file that is parsed", async () => {
    // Two paths built separately could diverge, and the gate would then be
    // parsing one file and applying its structural rules to another.
    const { checkSourceFile } = await loadRules();
    const read = [];
    const parsed = [];

    await checkSourceFile(
        "src/core/paths.js",
        (...args) => parsed.push(args),
        (absolute, encoding) => {
            read.push([absolute, encoding]);

            return Promise.resolve("const value = 1;\n");
        }
    );

    assert.equal(read.length, 1);
    assert.match(read[0][0], /\/src\/core\/paths\.js$/u);
    assert.equal(read[0][1], "utf8", "text, not bytes");
    // Inherited, so a syntax error is printed where the person running the
    // gate can read it; the running Node, so the parse is the one that counts.
    assert.deepEqual(parsed, [[process.execPath, ["--check", read[0][0]], { stdio: "inherit" }]]);
});

test("a .jxa file is handed to Node as a script, by its text", async () => {
    // Node refuses to guess at the extension, so asked for the path it fails
    // before parsing anything. The text it parses is the text that was read.
    const { checkSourceFile, syntaxCheck } = await loadRules();
    const parsed = [];
    const text = "function run() {}\n";

    await checkSourceFile("tests/integration/body.jxa", (...args) => parsed.push(args), () => Promise.resolve(text));

    assert.deepEqual(parsed, [[
        process.execPath,
        ["--check", "--input-type=commonjs"],
        { input: text, stdio: ["pipe", "inherit", "inherit"] }
    ]]);
    assert.deepEqual(syntaxCheck("/a/b.js", text), [["--check", "/a/b.js"], { stdio: "inherit" }]);
});

test("a .jxa file with a syntax error fails the real parse", async () => {
    // The injected runs above prove the arguments; this proves Node honours them.
    // Node's own report is kept off the test output; the exit status is what
    // is asserted.
    const { checkSourceFile } = await loadRules();
    const quietly = (file, args, options) => execFileSync(file, args, { ...options, stdio: ["pipe", "ignore", "ignore"] });

    await assert.rejects(
        () => checkSourceFile("tests/integration/body.jxa", quietly, () => Promise.resolve("function (\n")),
        /Command failed/u
    );
    await assert.doesNotReject(
        () => checkSourceFile("tests/integration/body.jxa", quietly, () => Promise.resolve("function run() {}\n"))
    );
});

test("the structural rules are applied to what was read", async () => {
    const { checkSourceFile } = await loadRules();

    await assert.rejects(
        () => checkSourceFile(
            "src/core/paths.js",
            () => undefined,
            () => Promise.resolve('const tool = "/bin/cp";\n')
        ),
        /names \/bin\/cp directly/u
    );
});
