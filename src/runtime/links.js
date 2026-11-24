"use strict";

const { refuse, fault, NATIVE_OPERATIONS } = require("../core/outcomes.js");
const { isNil, fileManager, nativeFailure, filesystemFailure, isCocoaError } = require("./bridge.js");

/*
 * Where Finder aliases and symbolic links point, and whether a destination is
 * still a directory Terminal can enter.
 */

/*
 * An alias is resolved without mounting a volume and without showing UI: a
 * run that follows an alias must not connect to a server or put up a dialog to
 * find its target. The two options are bit flags, combined as Foundation's
 * option sets are.
 */
function quietResolution(ns) {
    return ns.NSURLBookmarkResolutionWithoutUI | ns.NSURLBookmarkResolutionWithoutMounting;
}

// Foundation reports Cocoa code 4 for a Finder alias with a missing target.
const ALIAS_TARGET_NOT_FOUND = 4;

function resolveAlias(bridge, path) {
    const { ns, objc } = bridge;
    const error = bridge.outParameter();
    const url = ns.NSURL.URLByResolvingAliasFileAtURLOptionsError(
        ns.NSURL.fileURLWithPath(path),
        quietResolution(ns),
        error
    );

    if (isNil(url)) {
        const failure = nativeFailure(bridge, NATIVE_OPERATIONS.RESOLVE_ALIAS, path, error);

        throw isCocoaError(failure, ALIAS_TARGET_NOT_FOUND) ? fault("aliasUnresolved", failure.params) : failure;
    }

    if (!url.isFileURL) {
        throw refuse("aliasTargetNotLocal", { path });
    }

    return String(objc.unwrap(url.path));
}

function readLink(bridge, path) {
    const error = bridge.outParameter();
    const value = fileManager(bridge).destinationOfSymbolicLinkAtPathError(path, error);

    if (isNil(value)) {
        throw filesystemFailure(bridge, NATIVE_OPERATIONS.READ_LINK, path, error);
    }

    return String(bridge.objc.unwrap(value));
}

function canEnter(bridge, path) {
    return fileManager(bridge).isExecutableFileAtPath(path);
}

module.exports = { resolveAlias, readLink, canEnter };
