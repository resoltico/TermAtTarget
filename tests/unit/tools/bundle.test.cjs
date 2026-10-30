"use strict";

/*
 * The artifact: the same text from the same source, carrying its licence, and
 * loadable with nothing from Node or macOS in reach.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { fixture, hostFor, calls } = require("../../helpers.cjs");

const load = () => import("../../../tools/bundle.mjs");
// The global the artifact defines, which a native harness reaches into.
const ARTIFACT = "__TermAtTarget";

async function loaded() {
    const { renderRelease } = await load();
    const context = vm.createContext({});

    vm.runInContext(await renderRelease(), context);

    return context;
}

test("the same source renders the same artifact", async () => {
    const { renderRelease } = await load();

    assert.equal(await renderRelease(), await renderRelease());
});

test("the artifact opens with its name, version and the whole licence", async () => {
    const { renderRelease } = await load();
    const artifact = await renderRelease();

    assert.match(artifact, /^\/\*\nTerm At Target \d+\.\d+\.\d+\n/u);
    assert.match(artifact, /SPDX-License-Identifier: MPL-2.0/u);
    assert.match(artifact, /Copyright \(c\) 2026 Ervins Strauhmanis/u);
    assert.ok(artifact.includes(`Source Code Form: https://github.com/resoltico/TermAtTarget/tree/v${require("../../../package.json").version}`));
    assert.match(artifact, /Mozilla Public License Version 2.0/u);
});

test("nothing in it is meant to be edited: there is no configuration to inline", async () => {
    // Settings are saved by the action itself, so every installed copy is
    // byte-identical to the release and its checksum always verifies.
    const { renderRelease } = await load();
    const artifact = await renderRelease();

    assert.match(artifact, /\nGenerated from src\/; do not edit\. Settings are changed by running it with nothing selected\.\n/u);
    assert.doesNotMatch(artifact, /CONFIG|#config|#metadata/u);
});

test("loading it needs no Node and no macOS, and declares run() for osascript", async () => {
    const context = await loaded();

    assert.equal(typeof context.run, "function");
    assert.equal(typeof context[ARTIFACT].createMacHost, "function");
    assert.equal(context.require, undefined);
    assert.equal(context.process, undefined);
    assert.equal(context.ObjC, undefined);
});

test("the loaded artifact makes the same decisions the source does", async () => {
    const context = await loaded();

    for (const [folder, expected] of [[null, "/work"], ["inside", "/work"], ["parent", "/"]]) {
        const io = fixture({ "/work/a": { kind: "alias", target: "/work" } }, {
            load: () => ({ terminal: "ghostty", folder, link: "follow" })
        });

        // An array from the artifact's own realm, so compared by what it holds.
        assert.equal(context[ARTIFACT].execute(["/work/a"], hostFor(io)).length, 0);
        assert.deepEqual(io.events.filter(([name]) => name === "launch"), [["launch", expected, "ghostty"]], folder);
    }
});

test("the loaded artifact refuses what the source refuses, before touching anything", async () => {
    const context = await loaded();
    const io = fixture();

    assert.throws(
        () => context[ARTIFACT].execute(["/a", "/b"], hostFor(io)),
        /one selected item at a time/u
    );
    assert.deepEqual(calls(io), []);
});

test("the manifest is the artifact's SHA-256 and its published name", async () => {
    const { renderManifest, digestOf } = await load();

    assert.equal(digestOf("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    assert.equal(renderManifest("abc"), `${digestOf("abc")}  Term-At-Target.jxa\n`);
});
