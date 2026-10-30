"use strict";

/*
 * The saved settings in macOS preferences: each key read as found, nothing
 * saved read as null, and a change written as the setting's own text.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createPreferences } = require("../../../src/runtime/preferences.js");
const { box, nil, unwrap } = require("./fake-foundation.cjs");

/*
 * NSUserDefaults over a dictionary per domain, as macOS keeps them: a named
 * domain's own lookup also falls back to the global domain, as the real one
 * does, so reading through it would pick up `global`. $() boxes a string as
 * JXA does; deepUnwrap turns a domain into plain values.
 */
function defaultsWorld(domains = {}, refuse = [], global = {}) {
    const calls = [];
    const ns = Object.assign((value) => box(value), {
        NSUserDefaults: {
            standardUserDefaults: {
                persistentDomainForName(domain) {
                    calls.push(["read", domain]);
                    return Object.hasOwn(domains, domain) ? { isNil: () => false, domain } : nil;
                }
            },
            alloc: {
                initWithSuiteName(domain) {
                    calls.push(["open", domain]);

                    if (refuse.includes(domain)) {
                        return nil;
                    }

                    domains[domain] ??= {};

                    const stored = domains[domain];

                    return {
                        isNil: () => false,
                        objectForKey: (key) => stored[key] ?? global[key] ?? nil,
                        setObjectForKey(value, key) {
                            calls.push(["set", domain, key, unwrap(value)]);
                            stored[key] = value;
                        }
                    };
                }
            }
        }
    });
    const deepUnwrap = (stored) => Object.fromEntries(Object.entries(domains[stored.domain]).map(([key, value]) => [key, unwrap(value)]));

    return { bridge: { ns, objc: { unwrap, deepUnwrap } }, calls, domains };
}

test("nothing saved reads as null for every setting", () => {
    const { bridge, calls } = defaultsWorld();

    assert.deepEqual(createPreferences(bridge, "com.example.test").load(), { terminal: null, folder: null, link: null });
    assert.deepEqual(calls, [["read", "com.example.test"]]);
});

test("a saved value reads as found, whatever it is", () => {
    const { bridge } = defaultsWorld({ saved: { terminal: box("ghostty"), folder: box(3), link: box(["stay"]) } });

    assert.deepEqual(createPreferences(bridge, "saved").load(), { terminal: "ghostty", folder: 3, link: ["stay"] });
});

test("a change is written to the domain as the value's own text, and read back", () => {
    const world = defaultsWorld();
    const preferences = createPreferences(world.bridge, "d");

    preferences.save("folder", "parent");
    assert.deepEqual(world.calls.at(-1), ["set", "d", "folder", "parent"]);
    assert.equal(preferences.load().folder, "parent");
});

test("each domain is its own, so a test's settings never reach a person's", () => {
    const world = defaultsWorld();

    createPreferences(world.bridge, "test").save("link", "stay");
    assert.equal(createPreferences(world.bridge, "real").load().link, null);
});

test("only the domain's own values are read, never the global domain's", () => {
    // Measured: a `link` in the global domain changed a run when the named
    // domain's lookup was used.
    const { bridge } = defaultsWorld({ own: { folder: box("inside") } }, [], { link: box("stay"), terminal: box("kitty") });

    assert.deepEqual(createPreferences(bridge, "own").load(), { terminal: null, folder: "inside", link: null });
});

test("a domain macOS will not open for writing is said, and nothing is written", () => {
    const { bridge, calls } = defaultsWorld({}, ["bad"]);

    assert.throws(() => createPreferences(bridge, "bad").save("link", "stay"), /^Error: macOS could not open the preferences domain bad\.$/u);
    assert.equal(calls.some(([name]) => name === "set"), false);
});
