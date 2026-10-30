"use strict";

/*
 * What the shipped code may reach for, and what the portable core may not.
 * Each guard is asserted to reject what it exists to reject, and to let
 * through what it must: a rule that refused every file would pass every
 * rejection test here and stop the gate.
 */

const assert = require("node:assert/strict");
const test = require("node:test");

const load = () => import("../../../tools/lint/boundary-rules.mjs");

test("each construct that would load or run outside code is named", async () => {
    const { forbiddenIn } = await load();
    const cases = [
        ["eval (text)", "eval"],
        ["new Function('x')", "new Function"],
        ["await import('./x.js')", "dynamic import"],
        ["fetch (url)", "fetch"],
        ["process.env.HOME", "Node's process"],
        ["Buffer.from(text)", "Node's Buffer"]
    ];

    for (const [code, name] of cases) {
        assert.deepEqual(forbiddenIn(code), [name], code);
    }
});

test("a word that merely contains one is not one", async () => {
    // Anchored at word boundaries: a method called on something else, or a
    // name that ends in one, is ordinary code.
    const { forbiddenIn } = await load();

    for (const code of [
        "retrieval(x)", "prefetch(url)", "task.process.x", "myBuffer.from(x)",
        "loader.import(x)", "const importance = 1;", "newFunction(x)",
        "task.eval(x)", "$process.x", "window.fetch(x)"
    ]) {
        assert.deepEqual(forbiddenIn(code), [], code);
    }
});

test("a shipped module using one is refused, with every one it uses", async () => {
    const { checkBoundaries } = await load();

    assert.throws(
        () => checkBoundaries("src/runtime/host.js", "eval(a); fetch(b);\n"),
        (error) => {
            assert.equal(error.message, "src/runtime/host.js: uses eval, fetch; " +
                "the artifact runs under osascript and loads nothing it does not carry");

            return true;
        }
    );
});

test("tools and tests may use Node, which is where they run", async () => {
    const { checkBoundaries } = await load();

    assert.doesNotThrow(() => checkBoundaries("tools/lint.mjs", "process.exit(1); await import('x');\n"));
    assert.doesNotThrow(() => checkBoundaries("tests/unit/a.test.cjs", "Buffer.from('x');\n"));
});

test("the core may not use anything JXA puts in scope to reach macOS", async () => {
    const { checkBoundaries } = await load();

    for (const [code, name] of [["ObjC.import(\"x\");", "ObjC"], ["Application(\"Finder\");", "Application"], ["$.NSTask;", "$"],
        ["const r = Ref();", "Ref"], ["new Path(p);", "Path"], ["Progress.totalUnitCount = 1;", "Progress"], ["globalThis.x;", "globalThis"],
        ["f(Library);", "Library"], ["const a = { k: $ };", "$"], ["o[Ref];", "Ref"]]) {
        assert.throws(() => checkBoundaries("src/core/plan.js", `${code}\n`), (error) => {
            assert.equal(error.message, `src/core/plan.js: uses ${name}; the core is portable, and everything that touches macOS ` +
                "belongs in src/runtime/", code);

            return true;
        });
    }
});

test("words, strings, comments and property names are not uses", async () => {
    // Parsed, not matched: the core may say "ObjC" in prose, or have a `path` key.
    const { checkBoundaries } = await load();

    for (const code of [
        "// ObjC and Application are the runtime's", "const s = \"Ref $\";", "const o = { Path: 1, Application: 2 };",
        "x.Path; y.ObjC; z.Progress;", "const Reference = 1; const NSTasks = 2;", "function f(paths) { return paths; }"
    ]) {
        assert.doesNotThrow(() => checkBoundaries("src/core/plan.js", `${code}\n`), code);
    }
});

test("the runtime may use them", async () => {
    const { checkBoundaries } = await load();

    assert.doesNotThrow(() => checkBoundaries("src/runtime/host.js", "ObjC.import('x'); $.NSTask; Application.currentApplication();\n"));
});

test("a shipped module may not write to disk, by any of the ways Foundation or libc offer", async () => {
    // The product writes no file, and INSTALL.txt says its settings are all there is.
    const { checkBoundaries, writesIn } = await load();
    const writes = [
        ["ns.mkdir(dir, 448)", "mkdir"],
        ["$.unlink (path)", "unlink"],
        ["ns.fchmod(fd, 384)", "fchmod"],
        ["ns.flock(fd, 6)", "flock"],
        ["fm.removeItemAtPathError(p, e)", "removeItemAtPathError"],
        ["fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(p)", "createDirectoryAtPathWithIntermediateDirectoriesAttributesError"],
        ["$(text).writeToFileAtomicallyEncodingError(p)", "writeToFileAtomicallyEncodingError"],
        ["data.writeToURLAtomically(u, true)", "writeToURLAtomically"],
        ["pipe.fileHandleForWriting", "fileHandleForWriting"],
        ["fm.setAttributesOfItemAtPathError(a, p, e)", "setAttributesOfItemAtPathError"],
        ["fm.trashItemAtURLResultingItemURLError(u)", "trashItemAtURLResultingItemURLError"]
    ];

    for (const [code, name] of writes) {
        assert.equal(writesIn(code), name, code);
        assert.throws(
            () => checkBoundaries("src/runtime/x.js", `${code};\n`),
            new RegExp(`^Error: src/runtime/x\\.js: calls ${name}; the action writes no file, ` +
                "and INSTALL\\.txt tells people its settings are all there is to remove$", "u"),
            code
        );
    }
});

test("prose that mentions a write, and reads that resemble one, are not writes", async () => {
    const { writesIn, checkBoundaries } = await load();

    for (const code of [
        "// another process can rename or unlink it", "fileManager(bridge)", "stderr.fileHandleForReading",
        "const mkdirs = 1;", "renamed.push(x)", "readDataOfLength(4096)"
    ]) {
        assert.equal(writesIn(code), null, code);
    }

    assert.doesNotThrow(() => checkBoundaries("tools/x.mjs", "fs.mkdir(p);\n"), "tools may write");
});

test("only the preferences module may reach the saved settings", async () => {
    const { checkBoundaries } = await load();

    assert.doesNotThrow(() => checkBoundaries("src/runtime/preferences.js", "ns.NSUserDefaults.alloc;\n"));
    assert.throws(
        () => checkBoundaries("src/runtime/host.js", "$.NSUserDefaults.standardUserDefaults;\n"),
        /^Error: src\/runtime\/host\.js: names NSUserDefaults; the saved settings are written only by src\/runtime\/preferences\.js, so what the action writes is in one place$/u
    );
    assert.doesNotThrow(() => checkBoundaries("src/runtime/host.js", "const MyNSUserDefaultsish = 1;\n"));
});
