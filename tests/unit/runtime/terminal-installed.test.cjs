"use strict";

/*
 * Whether a terminal app is installed, asked of Launch Services by bundle
 * identifier, so the answer is the same wherever and however it was installed.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createTerminalApps } = require("../../../src/runtime/terminal-apps.js");
const { nil } = require("./fake-foundation.cjs");

// NSWorkspace, knowing the apps at `installed` by identifier.
function workspace(installed) {
    const asked = [];
    const ns = {
        NSWorkspace: {
            sharedWorkspace: {
                URLForApplicationWithBundleIdentifier(identifier) {
                    asked.push(identifier);
                    return Object.hasOwn(installed, identifier) ? { isNil: () => false, path: installed[identifier] } : nil;
                }
            }
        }
    };

    return { apps: createTerminalApps({ ns }, {}), asked };
}

test("an app Launch Services knows by its identifier is installed", () => {
    const { apps, asked } = workspace({ "com.mitchellh.ghostty": "/Applications/Ghostty.app" });

    assert.equal(apps.isInstalled("ghostty"), true);
    assert.deepEqual(asked, ["com.mitchellh.ghostty"]);
});

test("one it does not know is not, whatever else is installed", () => {
    const { apps, asked } = workspace({ "com.mitchellh.ghostty": "/Applications/Ghostty.app" });

    assert.equal(apps.isInstalled("terminal"), false);
    assert.deepEqual(asked, ["com.apple.Terminal"]);
});
