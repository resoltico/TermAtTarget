/*
 * The saved settings against real macOS preferences, in a domain of the
 * suite's own that is removed before and after, so a person's own settings
 * are never read or written: saved in one osascript process, read back in
 * another after the first has ended, and read by `defaults` as well -- and a
 * `terminal` planted in osascript's own domain is never read as one of them.
 */
import { spawnSync, execFileSync } from "node:child_process";

const PREFERENCES_DOMAIN = "com.resoltico.TermAtTarget.native-test";

function forgetPreferences() {
    spawnSync("/usr/bin/defaults", ["delete", PREFERENCES_DOMAIN], { stdio: "ignore" });
}

// What the suite's domain holds after a save, read three ways.
function readBack(invoke) {
    return {
        saved: invoke("preferences", PREFERENCES_DOMAIN, "save"),
        loaded: invoke("preferences", PREFERENCES_DOMAIN, "load"),
        read: execFileSync("/usr/bin/defaults", ["read", PREFERENCES_DOMAIN, "folder"], { encoding: "utf8" }).trim()
    };
}

// Saved in one process, read back in another and by `defaults`, then removed.
export function checkPreferences(invoke) {
    const expected = JSON.stringify({ terminal: null, folder: "parent", link: 3 });

    forgetPreferences();

    try {
        const found = readBack(invoke);

        if (JSON.stringify(found.saved) !== expected || JSON.stringify(found.loaded) !== expected || found.read !== "parent") {
            throw new Error(`Saved settings did not read back: ${JSON.stringify(found)}`);
        }
    } finally {
        forgetPreferences();
    }

    console.log("PASS: a saved setting outlives its process and is what `defaults` reads.");

    return true;
}
