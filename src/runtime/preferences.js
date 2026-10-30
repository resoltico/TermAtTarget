"use strict";

const { KEYS } = require("../core/settings.js");
const { isNil } = require("./bridge.js");

/*
 * The saved settings, in macOS preferences: one domain, a key per setting,
 * each value the setting's own text. This is the one thing the action writes.
 *
 * Measured on macOS 27: run inside Shortcuts (as ShortcutsMacHelper, not
 * sandboxed) a value saved to a named domain lands in ~/Library/Preferences,
 * where `defaults` and osascript read the same value back.
 *
 * Only the domain's own dictionary is read. A named NSUserDefaults also looks
 * in the host app's domain and the global one, and these keys are generic
 * names: measured, a `link` written to the global domain changed a run that
 * nothing in this domain had set. Writing through the named domain writes to
 * the domain itself.
 *
 * Each value is handed over as found -- null where nothing is saved, otherwise
 * whatever the domain holds, which someone using `defaults` may have made a
 * number, a list or a date -- and the core decides whether it is one it
 * recognises.
 */

function domainOf(bridge, domain) {
    const defaults = bridge.ns.NSUserDefaults.alloc.initWithSuiteName(domain);

    if (isNil(defaults)) {
        throw new Error(`macOS could not open the preferences domain ${domain}.`);
    }

    return defaults;
}

function load(bridge, domain) {
    const stored = bridge.ns.NSUserDefaults.standardUserDefaults.persistentDomainForName(domain);
    const values = isNil(stored) ? {} : bridge.objc.deepUnwrap(stored);

    return Object.fromEntries(KEYS.map((key) => [key, Object.hasOwn(values, key) ? values[key] : null]));
}

function save(bridge, domain, key, value) {
    domainOf(bridge, domain).setObjectForKey(bridge.ns(value), key);
}

function createPreferences(bridge, domain) {
    return {
        load: () => load(bridge, domain),
        save: (key, value) => save(bridge, domain, key, value)
    };
}

module.exports = { createPreferences };
