"use strict";

/*
 * The artifact: the same text from the same source, carrying its licence, and
 * loadable with nothing from Node or macOS in reach.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { fixture, calls } = require("../../helpers.cjs");

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
    assert.match(artifact, /Permission is hereby granted/u);
});

test("the configuration is inlined where a pasted copy can edit it", async () => {
    const { renderRelease } = await load();

    assert.match(await renderRelease(), /\nvar TERM_AT_TARGET_CONFIG = \{\n {4}"defaultFolderAction": "[A-Z]+",\n/u);
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

    for (const [folder, expected] of [["ASK", "/work"], ["INSIDE", "/work"], ["LEVEL", "/"]]) {
        const io = fixture({ "/work/a": { kind: "alias", target: "/work" } });
        const config = { defaultFolderAction: folder, defaultLinkAction: "TARGET" };

        // An array from the artifact's own realm, so compared by what it holds.
        assert.equal(context[ARTIFACT].execute(["/work/a"], config, io).length, 0);
        assert.deepEqual(io.events.filter(([name]) => name === "launch"), [["launch", expected]], folder);
    }
});

test("the loaded artifact refuses what the source refuses, before touching anything", async () => {
    const context = await loaded();
    const io = fixture();

    assert.throws(
        () => context[ARTIFACT].execute(["/a", "/b"], { defaultFolderAction: "ASK", defaultLinkAction: "ASK" }, io),
        /one selected item at a time/u
    );
    assert.deepEqual(calls(io), []);
});

test("the manifest is the artifact's SHA-256 and its published name", async () => {
    const { renderManifest, digestOf } = await load();

    assert.equal(digestOf("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    assert.equal(renderManifest("abc"), `${digestOf("abc")}  Term-At-Target.jxa\n`);
});
