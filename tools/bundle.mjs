import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { read, root, metadata, artifactName, filesBelow } from "./repository.mjs";
import { modules } from "./module-order.mjs";
import { dependencies, verifyGraph } from "./module-graph.mjs";

/*
 * The release artifact: every module in the manifest as a scoped factory, a
 * declared dependency graph, and a loader that resolves only what the graph
 * declares. Nothing is flattened into one scope, so a module's names stay its
 * own, and a require the graph did not declare fails rather than finding
 * something by accident.
 *
 * The builder and the verifier both render through here, so they cannot
 * disagree about what the artifact should be.
 */

const require = createRequire(import.meta.url);
const { validateConfig } = require("../src/core/config.js");

const CONFIG_INDENT = 4;

export function digestOf(text) {
    return createHash("sha256").update(text).digest("hex");
}

// The tree under src/ and the manifest name the same modules, or nothing ships.
async function assertManifest(base) {
    const discovered = (await filesBelow("src", base)).filter((name) => name.endsWith(".js"));

    if (JSON.stringify(discovered) !== JSON.stringify([...modules].sort())) {
        throw new Error("The production source tree and module manifest disagree.");
    }
}

async function factoriesOf(base) {
    const sources = await Promise.all(modules.map((id) => read(id, base)));
    const graph = Object.fromEntries(modules.map((id, index) => [id, dependencies(sources[index], id)]));
    const sections = modules.map((id, index) =>
        `${JSON.stringify(id)}: function (require, module, exports) {\n${sources[index]}\n}`);

    verifyGraph(graph);

    return { graph, sections };
}

function headerFor(meta, license) {
    return `/*\n${meta.title} ${meta.version}\n` +
        "Generated from src/. Edit config.json and rebuild for source-controlled changes.\n" +
        "For a personal pasted copy only, edit TERM_AT_TARGET_CONFIG below.\n" +
        "Native macOS verification status is recorded in QA.md. No Node runtime required.\n\n" +
        `${license.trimEnd()}\n*/\n\n`;
}

function loaderFor(factories, meta) {
    return `var __TermAtTarget = (function () {
    "use strict";
    var factories = {
${factories.sections.join(",\n\n")},
"#config": function (require, module) { module.exports = TERM_AT_TARGET_CONFIG; },
"#metadata": function (require, module) { module.exports = ${JSON.stringify(meta)}; }
    };
    var graph = ${JSON.stringify(factories.graph)};
    var cache = Object.create(null);
    function load(id) {
        if (Object.prototype.hasOwnProperty.call(cache, id)) { return cache[id].exports; }
        if (!Object.prototype.hasOwnProperty.call(factories, id)) { throw new Error("Unknown embedded module: " + id); }
        var module = { exports: {} };
        cache[id] = module;
        function localRequire(specifier) {
            if (!graph[id] || !Object.prototype.hasOwnProperty.call(graph[id], specifier)) {
                throw new Error("Undeclared embedded dependency: " + specifier);
            }
            return load(graph[id][specifier]);
        }
        factories[id](localRequire, module, module.exports);
        return module.exports;
    }
    return load("src/runtime/entry.js");
}());

function run(input, parameters) {
    return __TermAtTarget.run(input);
}
`;
}

export async function renderRelease(base = root) {
    await assertManifest(base);

    const meta = await metadata(base);
    const config = validateConfig(JSON.parse(await read("config.json", base)));
    const factories = await factoriesOf(base);

    return `${headerFor(meta, await read("LICENSE", base))}` +
        `var TERM_AT_TARGET_CONFIG = ${JSON.stringify(config, null, CONFIG_INDENT)};\n\n${loaderFor(factories, meta)}`;
}

export function renderManifest(artifact) {
    return `${digestOf(artifact)}  ${artifactName}\n`;
}
