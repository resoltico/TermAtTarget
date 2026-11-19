"use strict";

const { refuse, NATIVE_OPERATIONS } = require("../core/outcomes.js");
const { physicalPath } = require("../core/resolve.js");
const { isNil, fileManager, nativeFailure } = require("./bridge.js");
const { inspect } = require("./attributes.js");

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

function resolveAlias(bridge, path) {
    const { ns, objc } = bridge;
    const error = bridge.outParameter();
    const url = ns.NSURL.URLByResolvingAliasFileAtURLOptionsError(
        ns.NSURL.fileURLWithPath(path),
        quietResolution(ns),
        error
    );

    if (isNil(url)) {
        // The one native failure a person causes and can put right, so it says how.
        const failure = nativeFailure(bridge, NATIVE_OPERATIONS.RESOLVE_ALIAS, path, error);

        throw refuse("aliasTargetMissing", { native: failure.params });
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
        throw nativeFailure(bridge, NATIVE_OPERATIONS.READ_LINK, path, error);
    }

    return String(bridge.objc.unwrap(value));
}

/*
 * A file's containing directory may itself be a symbolic link -- /tmp is one.
 * Its physical target is validated, but the chosen spelling is what Terminal
 * is given. This is not an implicit Finder-alias resolution.
 */
function validateDirectory(bridge, path) {
    const io = {
        inspect: (candidate) => inspect(bridge, candidate),
        readLink: (candidate) => readLink(bridge, candidate)
    };
    const physical = physicalPath(path, io, { links: 0 });

    if (io.inspect(physical).kind !== "directory") {
        throw refuse("destinationGone", { path });
    }

    if (!fileManager(bridge).isExecutableFileAtPath(path)) {
        throw refuse("destinationNotEnterable", { path });
    }
}

module.exports = { resolveAlias, readLink, validateDirectory };
