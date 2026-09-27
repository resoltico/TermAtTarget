"use strict";

/*
 * The JXA globals the host is assembled from -- ObjC, $ and Application --
 * as far as assembling it and taking one step with each part touches them.
 *
 * $ is callable, as it is in JXA, and every placeholder it makes is kept, so a
 * test can see that an out-parameter came from it. Loaded fresh for each use,
 * since src/runtime/host.js reads the globals when it is run.
 */

const path = require("node:path");

const GLOBALS = ["ObjC", "$", "Application"];
const SOURCE = `${path.sep}src${path.sep}`;

function namespace(seen) {
    const placeholder = () => {
        const made = { isNil: () => true };

        seen.outParameters.push(made);
        return made;
    };

    return Object.assign(placeholder, {
        NSProcessInfo: {
            processInfo: {
                get systemUptime() {
                    seen.clockReads += 1;
                    return 100;
                }
            }
        },
        NSURL: { fileURLWithPath: (location) => ({ path: location }) },
        NSFileHandle: { fileHandleWithNullDevice: "null-device" },
        // A launch macOS refuses, with nothing said about why.
        NSTask: { alloc: { init: { launchAndReturnError: () => false } } },
        NSFileManager: {
            defaultManager: {
                attributesOfItemAtPathError(where, error) {
                    seen.attributesError = error;
                    return { isNil: () => true };
                }
            }
        }
    });
}

function jxaWorld() {
    const seen = { imports: [], outParameters: [], app: null, clockReads: 0 };
    const objc = {
        import: (name) => seen.imports.push(name),
        unwrap: (value) => value,
        wrap: (value) => value
    };
    const application = {
        currentApplication() {
            seen.app = {};
            return seen.app;
        }
    };

    return { seen, globals: { ObjC: objc, $: namespace(seen), Application: application } };
}

function withGlobals(globals, action) {
    const saved = GLOBALS.map((name) => [name, globalThis[name]]);

    Object.assign(globalThis, globals);

    try {
        return action();
    } finally {
        for (const [name, value] of saved) {
            globalThis[name] = value;
        }
    }
}

// A fresh copy of a module, with every source module it depends on loaded anew.
function freshly(file) {
    for (const cached of Object.keys(require.cache)) {
        if (cached.includes(SOURCE)) {
            delete require.cache[cached];
        }
    }

    return require(file);
}

module.exports = { jxaWorld, withGlobals, freshly };
