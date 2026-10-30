import { createHash } from "node:crypto";
import path from "node:path";
import { build } from "esbuild";
import { read, root, metadata, artifactName, filesBelow } from "./repository.mjs";
import { dependencies, verifyGraph } from "./module-graph.mjs";

/*
 * The release artifact: the modules under src/, bundled by esbuild into one
 * script, with comments stripped and whitespace removed, behind a header that
 * says what it is, whose it is and where its source is.
 *
 * Names are kept, so an error from the field still names the function it came
 * from. Comments are stripped -- the sources they came from are at the address
 * the header gives -- except a `/*! ... *\/` notice, which esbuild keeps at the
 * end of the file: the Unicode data notice the tables must travel with.
 *
 * Safari 15.4 is the JavaScriptCore of macOS 12.3, the floor; built-ins newer
 * than that are refused separately (tools/lint/language-target.mjs), since a
 * target year adds no polyfills.
 *
 * The builder and the verifier both render through here, so they cannot
 * disagree about what the artifact should be.
 */

const ENTRY = "src/runtime/entry.js";
const GLOBAL = "__TermAtTarget";

export const BUNDLE_OPTIONS = Object.freeze({
    bundle: true,
    platform: "neutral",
    format: "iife",
    globalName: GLOBAL,
    target: "safari15.4",
    minifyWhitespace: true,
    minifyIdentifiers: false,
    legalComments: "eof",
    write: false,
    metafile: true,
    logLevel: "silent"
});

export function digestOf(text) {
    return createHash("sha256").update(text).digest("hex");
}

// The graph rules hold for every module under src/ before anything is built.
async function checkGraph(base) {
    const modules = (await filesBelow("src", base)).filter((name) => name.endsWith(".js"));
    const sources = await Promise.all(modules.map((id) => read(id, base)));

    verifyGraph(Object.fromEntries(modules.map((id, index) => [id, dependencies(sources[index], id, modules)])));

    return modules;
}

// Every module under src/ is in the bundle, or a module nothing reaches would
// pass every check and never ship.
export function assertBundled(modules, inputs) {
    const omitted = modules.filter((id) => !inputs.includes(id));

    if (omitted.length > 0) {
        throw new Error(`Source modules the bundle does not reach: ${omitted.join(", ")}`);
    }
}

async function bundle(base) {
    const result = await build({ ...BUNDLE_OPTIONS, absWorkingDir: base, entryPoints: [ENTRY] });
    const inputs = Object.keys(result.metafile.inputs).map((name) => path.posix.normalize(name));

    return { code: result.outputFiles[0].text, inputs };
}

function headerFor(meta) {
    return `/*
 * ${meta.title} ${meta.version}
 * ${meta.homepage}
 *
 * Copyright (c) ${meta.copyright}
 * SPDX-License-Identifier: ${meta.license}
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Source Code Form: ${meta.homepage}/tree/v${meta.version}
 *
 * Generated file; do not edit. Comments are stripped on build: the sources
 * they came from are at the address above. The notice the Unicode data tables
 * carry is kept at the end of this file. Settings are changed by running it
 * with nothing selected. Requires macOS ${meta.minimumMacOS} or later.
 */

`;
}

export async function renderRelease(base = root) {
    const modules = await checkGraph(base);
    const meta = await metadata(base);
    const bundled = await bundle(base);

    assertBundled(modules, bundled.inputs);

    return `${headerFor(meta)}${bundled.code}function run(input, parameters) {\n    return ${GLOBAL}.run(input);\n}\n`;
}

export function renderManifest(artifact) {
    return `${digestOf(artifact)}  ${artifactName}\n`;
}
