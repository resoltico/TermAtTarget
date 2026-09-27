"use strict";

const { displayPath } = require("../core/paths.js");
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
        throw nativeFailure(bridge, "Cannot resolve alias target for", path, error);
    }

    if (!url.isFileURL) {
        throw new Error("The alias target is not a local filesystem URL.");
    }

    return String(objc.unwrap(url.path));
}

function readLink(bridge, path) {
    const error = bridge.outParameter();
    const value = fileManager(bridge).destinationOfSymbolicLinkAtPathError(path, error);

    if (isNil(value)) {
        throw nativeFailure(bridge, "Cannot read symbolic link", path, error);
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
        throw new Error(`The destination is no longer a directory: ${displayPath(path)}.`);
    }

    if (!fileManager(bridge).isExecutableFileAtPath(path)) {
        throw new Error(`The destination directory cannot be entered: ${displayPath(path)}.`);
    }
}

module.exports = { resolveAlias, readLink, validateDirectory };
