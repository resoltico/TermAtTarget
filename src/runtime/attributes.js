"use strict";

const { displayPath } = require("../core/paths.js");
const { isNil, fileManager, nativeFailure } = require("./bridge.js");

/*
 * What a filesystem item is, asked of Foundation.
 *
 * NSFileManager's attributes are lstat-like: the final symbolic link is not
 * followed. So a link is classified as a link before anything asks NSURL for
 * resource metadata or resolves an alias, which would follow it.
 */

function attributes(bridge, path) {
    const error = bridge.outParameter();
    const result = fileManager(bridge).attributesOfItemAtPathError(path, error);

    if (isNil(result)) {
        throw nativeFailure(bridge, "Cannot inspect", path, error);
    }

    return result;
}

function attribute(bridge, dict, key) {
    const value = dict.objectForKey(key);

    if (isNil(value)) {
        throw new Error("macOS omitted a required filesystem attribute.");
    }

    return bridge.objc.unwrap(value);
}

function resourceBoolean(bridge, path, key) {
    const value = bridge.outParameter();
    const error = bridge.outParameter();
    const url = bridge.ns.NSURL.fileURLWithPath(path);

    if (!url.getResourceValueForKeyError(value, key, error)) {
        throw nativeFailure(bridge, "Cannot read metadata for", path, error);
    }

    if (isNil(value)) {
        throw new Error(`macOS omitted a required resource value for ${displayPath(path)}.`);
    }

    return Boolean(bridge.objc.unwrap(value));
}

/*
 * What an item is, as far as that decides a destination: a folder, a
 * symbolic link, a Finder alias, or anything else, which opens its parent.
 * Whether a folder is a package is not asked here -- it changes a question's
 * wording, never a destination -- so walking a path asks nothing optional of
 * every folder on the way. Whether a file is an alias is asked, and a failure
 * to answer is an error: guessing "not an alias" would open the wrong place.
 */
function inspect(bridge, path) {
    const { ns, objc } = bridge;
    const type = attribute(bridge, attributes(bridge, path), ns.NSFileType);

    if (type === objc.unwrap(ns.NSFileTypeSymbolicLink)) {
        return { kind: "symlink" };
    }

    if (type === objc.unwrap(ns.NSFileTypeDirectory)) {
        return { kind: "directory" };
    }

    if (type === objc.unwrap(ns.NSFileTypeRegular) && resourceBoolean(bridge, path, ns.NSURLIsAliasFileKey)) {
        return { kind: "alias" };
    }

    // Sockets, pipes and devices also have a containing folder. Nothing here
    // opens or reads the selected item, so they need no special access.
    return { kind: "file" };
}

// For a question's wording only, so an answer macOS cannot give reads as "no".
function isPackage(bridge, path) {
    try {
        return resourceBoolean(bridge, path, bridge.ns.NSURLIsPackageKey);
    } catch {
        return false;
    }
}

module.exports = { attributes, attribute, resourceBoolean, inspect, isPackage };
