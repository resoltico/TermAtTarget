"use strict";

const { fault } = require("../core/outcomes.js");

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
 * itself, where the Ref() form unwrapped to undefined. ShortcutsMacHelper
 * also overwrites errno between a C call and the read. The adapters use the
 * Foundation result or its NSError instead.
 */

function isNil(value) {
    return value === null || value === undefined || value.isNil();
}

function fileManager(bridge) {
    return bridge.ns.NSFileManager.defaultManager;
}

/*
 * An NSError's code arrives from the bridge as text (measured). Keep it as
 * a number and retain the description for the failure alert.
 */
function nativeFailure(bridge, operation, path, error) {
    const details = error && !isNil(error)
        ? {
            domain: String(bridge.objc.unwrap(error.domain)),
            code: Number(error.code),
            description: String(bridge.objc.unwrap(error.localizedDescription))
        }
        : { domain: null, code: null, description: null };

    return fault("native", { operation, path, ...details });
}

const FILE_READ_NOT_FOUND = 260;

function isCocoaError({ params }, code) {
    return params.domain === "NSCocoaErrorDomain" && params.code === code;
}

// Measured with attributes, URL resource metadata and symbolic-link reads.
function filesystemFailure(bridge, operation, path, error) {
    const failure = nativeFailure(bridge, operation, path, error);

    return isCocoaError(failure, FILE_READ_NOT_FOUND) ? fault("fileMissing", failure.params) : failure;
}

/*
 * A zero-argument Objective-C method, which JXA performs on property access.
 * Named once rather than written as a bare expression statement at each call,
 * where it reads as a mistake.
 */
function perform(target, method) {
    return target[method];
}

module.exports = { isNil, fileManager, nativeFailure, filesystemFailure, isCocoaError, perform };
