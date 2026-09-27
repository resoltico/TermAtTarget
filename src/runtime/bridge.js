"use strict";

const { displayPath } = require("../core/paths.js");

/*
 * What every native adapter is handed: `ns`, the Objective-C namespace JXA
 * calls $; `objc`, the ObjC object; `outParameter`, a maker of fresh
 * out-parameters; and `now`, a monotonic clock in seconds. One value rather
 * than four arguments, so each adapter's signature says what it needs beyond
 * the bridge.
 *
 * An out-parameter is made with $() rather than Ref(). Measured on macOS:
 * reading an NSError back out of a Ref() after a failing Foundation call
 * crashes osascript outright -- SIGSEGV, no message, five runs in five -- and
 * reduces to thirty lines with no bundler involved. Whether the read happens
 * inside the throw, before it, or in a nested helper makes no difference, and
 * any unrelated Objective-C call in between hides it again, which is what
 * makes it a memory fault rather than a mistake in the call. With $() the
 * same calls are stable, and the error is readable: a missing path describes
 * itself, where the Ref() form unwrapped to undefined.
 */

function isNil(value) {
    return value === null || value === undefined || value.isNil();
}

function fileManager(bridge) {
    return bridge.ns.NSFileManager.defaultManager;
}

/*
 * An NSError said in words, as the end of a message about what failed, with
 * its domain and code kept: in the message, where a report quotes them, and
 * on the Error for whatever handles it. The code arrives from the bridge as
 * text (measured) and is read as a number.
 */
function nativeFailure(bridge, operation, path, error) {
    const described = Boolean(error) && !isNil(error);
    const failure = new Error(described
        ? `${operation} ${displayPath(path)}: ${String(bridge.objc.unwrap(error.localizedDescription))} ` +
            `(${String(bridge.objc.unwrap(error.domain))} ${Number(error.code)})`
        : `${operation} ${displayPath(path)}: macOS did not provide further details.`);

    failure.native = described
        ? { operation, path, domain: String(bridge.objc.unwrap(error.domain)), code: Number(error.code) }
        : { operation, path, domain: null, code: null };

    return failure;
}

/*
 * A zero-argument Objective-C method, which JXA performs on property access.
 * Named once rather than written as a bare expression statement at each call,
 * where it reads as a mistake.
 */
function perform(target, method) {
    return target[method];
}

module.exports = { isNil, fileManager, nativeFailure, perform };
