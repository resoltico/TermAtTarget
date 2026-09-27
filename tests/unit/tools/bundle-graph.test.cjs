"use strict";

/*
 * What a module may require, and the graph those requires make: only listed
 * local modules and the two embedded values, nothing from the core into the
 * host, and no cycles.
 */

const assert = require("node:assert/strict");
const test = require("node:test");

const load = () => import("../../../tools/module-graph.mjs");

test("a local require resolves to the listed module it names, however it is quoted", async () => {
    const { dependencies } = await load();
    const source = "const a = require(\"../core/paths.js\");\nconst b = require( './bridge.js' );";

    assert.deepEqual(dependencies(source, "src/runtime/links.js"), {
        "../core/paths.js": "src/core/paths.js",
        "./bridge.js": "src/runtime/bridge.js"
    });
});

test("the embedded values are dependencies the runtime may have", async () => {
    const { dependencies } = await load();

    assert.deepEqual(
        dependencies("require(\"#config\"); require(\"#metadata\");", "src/runtime/entry.js"),
        { "#config": "#config", "#metadata": "#metadata" }
    );
});

test("a module that requires nothing has no dependencies", async () => {
    const { dependencies } = await load();

    assert.deepEqual(dependencies("\"use strict\";\n", "src/core/errors.js"), {});
});

test("a require that is not a literal string is refused", async () => {
    const { dependencies } = await load();

    for (const source of ["require(name)", "require(`./a.js`)", "require (\"./paths.js\" + x)"]) {
        assert.throws(
            () => dependencies(source, "src/core/plan.js"),
            /^Error: Only literal local module imports are allowed: src\/core\/plan\.js$/u,
            source
        );
    }
});

test("a package or a built-in is refused, since nothing is installed on the Mac", async () => {
    const { dependencies } = await load();

    for (const specifier of ["node:fs", "fast-check", "/abs.js"]) {
        assert.throws(
            () => dependencies(`require("${specifier}")`, "src/core/plan.js"),
            new RegExp(`^Error: External runtime dependency in src/core/plan\\.js: ${specifier}$`, "u")
        );
    }
});

test("a module the manifest does not list is refused", async () => {
    const { dependencies } = await load();

    assert.throws(
        () => dependencies("require(\"./missing.js\")", "src/core/plan.js"),
        /^Error: Unlisted module dependency in src\/core\/plan\.js: src\/core\/missing\.js$/u
    );
    assert.throws(() => dependencies("require(\"../../outside.js\")", "src/core/plan.js"), /Unlisted module/u);
});

test("the core may not reach the host, or its configuration", async () => {
    const { dependencies } = await load();

    assert.throws(
        () => dependencies("require(\"../runtime/host.js\")", "src/core/plan.js"),
        /^Error: The portable core may not import a host adapter\.$/u
    );
    assert.throws(
        () => dependencies("require(\"#config\")", "src/core/plan.js"),
        /^Error: The portable core may not read embedded application configuration\.$/u
    );
    assert.deepEqual(dependencies("require(\"../core/paths.js\")", "src/runtime/links.js"),
        { "../core/paths.js": "src/core/paths.js" }, "the host may reach the core");
});

test("an acyclic graph with embedded values passes", async () => {
    const { verifyGraph } = await load();

    assert.doesNotThrow(() => verifyGraph({
        entry: { host: "host", config: "#config" },
        host: { meta: "#metadata" },
        other: { host: "host" }
    }));
});

test("a cycle is refused, at whatever depth it closes", async () => {
    const { verifyGraph } = await load();

    assert.throws(() => verifyGraph({ one: { two: "two" }, two: { one: "one" } }), /^Error: Circular module dependency: one$/u);
    assert.throws(
        () => verifyGraph({ one: { two: "two" }, two: { three: "three" }, three: { two: "two" } }),
        /Circular module dependency: two/u
    );
    assert.throws(() => verifyGraph({ one: { self: "one" } }), /Circular module dependency: one/u);
});

test("a dependency missing from the graph is refused", async () => {
    const { verifyGraph } = await load();

    assert.throws(() => verifyGraph({ one: { gone: "missing" } }), /^Error: Missing module in graph: missing$/u);
    assert.throws(() => verifyGraph({ one: { name: "toString" } }), /Missing module in graph: toString/u,
        "an inherited name is not a module");
});

test("a module reached twice is checked once, and a diamond is not a cycle", async () => {
    const { verifyGraph } = await load();

    assert.doesNotThrow(() => verifyGraph({
        top: { left: "left", right: "right" },
        left: { bottom: "bottom" },
        right: { bottom: "bottom" },
        bottom: {}
    }));
});
