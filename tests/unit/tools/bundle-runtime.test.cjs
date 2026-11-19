"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { jxaWorld } = require("../runtime/fake-jxa.cjs");
const { box } = require("../runtime/fake-foundation.cjs");

const ARTIFACT = "__TermAtTarget";
const load = () => import("../../../tools/bundle.mjs");

function launchBridge(world, folder) {
    const { $: ns, ObjC } = world.globals;
    const bundleIds = [];
    const task = { launchAndReturnError: () => true, running: false, terminationStatus: 0 };

    Object.assign(ns, {
        NSWorkspace: { sharedWorkspace: {
            URLForApplicationWithBundleIdentifier(id) {
                bundleIds.push(id);
                return box("installed");
            }
        } },
        NSTask: { alloc: { init: task } },
        NSFileTypeDirectory: "Directory",
        NSFileTypeSymbolicLink: "SymbolicLink",
        NSFileTypeRegular: "Regular"
    });
    Object.assign(ns.NSFileManager.defaultManager, {
        attributesOfItemAtPathError: () => ({ isNil: () => false, objectForKey: () => box("Directory") }),
        isExecutableFileAtPath: () => true
    });
    ns.NSUserDefaults.standardUserDefaults.persistentDomainForName = () => box({ terminal: "ghostty", folder });
    ObjC.deepUnwrap = (value) => value.data;
    ObjC.unwrap = (value) => value?.data ?? value;

    return { bundleIds, task };
}

async function hostForArtifact(configure) {
    const { renderRelease } = await load();
    const { globals, seen } = jxaWorld();
    const context = vm.createContext(globals);
    const { currentApplication } = globals.Application;

    globals.Application.currentApplication = () => Object.assign(currentApplication(), {
        displayAlert: (...args) => configure.alerts.push(args)
    });
    vm.runInContext(await renderRelease(), context);

    return { context, globals, seen };
}

test("the production run sends the configured folder to the saved app", async () => {
    const world = await hostForArtifact({ alerts: [] });

    for (const [folder, expected] of [["inside", "/work"], ["parent", "/"]]) {
        const { task, bundleIds } = launchBridge(world, folder);

        assert.deepEqual([...world.context.run(["/work"])], []);
        assert.deepEqual(bundleIds, ["com.mitchellh.ghostty"]);
        assert.deepEqual([...task.arguments], ["-b", "com.mitchellh.ghostty", expected]);
    }
});

test("the production run refuses multiple items before reading settings", async () => {
    const alerts = [];
    const { context, seen } = await hostForArtifact({ alerts });

    assert.deepEqual([...context.run([["/a", "/b"], { source: "", ignoresInput: false }])], []);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0][0], "Select one item at a time");
    assert.deepEqual(seen.domains, []);
});

test("the native entry exports the adapters in the test bundle", async () => {
    const { renderBundle } = await load();
    const { code } = await renderBundle("tests/integration/entry.cjs");
    const context = vm.createContext({});

    vm.runInContext(code, context);
    assert.deepEqual(Object.keys(context[ARTIFACT]).sort(), [
        "createFailureReport", "createFoundation", "createMacHost", "createPreferences",
        "createQuestions", "execute", "presentName", "supervise"
    ]);
    assert.equal(typeof context[ARTIFACT].execute, "function");
});
