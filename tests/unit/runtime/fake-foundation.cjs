"use strict";

/*
 * Foundation, as far as the filesystem adapters ask it anything: a file
 * manager, NSURL, and the constants they compare against, over a small
 * filesystem described as data.
 *
 * Bridged values are boxed, so a test can tell a value that went through
 * ObjC.unwrap from one that did not. An out-parameter is an object the call
 * fills, which is what $() gives the real adapter: unfilled it reads as nil,
 * and a failing call writes an NSError into it.
 */

const box = (data) => ({ data, isNil: () => false });
const nil = { isNil: () => true };

function unwrap(value) {
    if (value && Object.hasOwn(value, "data")) {
        return value.data;
    }

    throw new Error("not bridged");
}

// As the bridge gives it: the code arrives as text (measured).
const nativeError = (text, code = "260") => ({
    isNil: () => false,
    localizedDescription: box(text),
    domain: box("NSCocoaErrorDomain"),
    code
});
const fill = (out, source) => Object.assign(out, source);

const ENTRIES = {
    "/": { type: "directory", package: false },
    "/folder": { type: "directory", package: false },
    "/App.app": { type: "directory", package: true },
    "/file": { type: "regular", alias: false },
    "/alias": { type: "regular", alias: true, target: "/folder" },
    "/symlink": { type: "symlink", target: "file" },
    "/socket": { type: "socket" }
};

function attributeDictionary(entry) {
    return {
        isNil: () => false,
        objectForKey: (key) => (entry.attributeMissing ? nil : box(entry[unwrap(key)]))
    };
}

function fileManager(entries, calls) {
    return {
        attributesOfItemAtPathError(path, error) {
            calls.push(["attributes", path]);

            if (!entries[path]) {
                fill(error, nativeError("missing"));
                return nil;
            }

            return attributeDictionary(entries[path]);
        },
        destinationOfSymbolicLinkAtPathError(path, error) {
            calls.push(["readLink", path]);

            if (entries[path].linkError) {
                fill(error, nativeError("link error"));
                return nil;
            }

            return box(entries[path].target);
        },
        isExecutableFileAtPath(path) {
            calls.push(["searchable", path]);
            return !entries[path].noSearch;
        }
    };
}

function fileURL(entries, calls, path) {
    return {
        path,
        getResourceValueForKeyError(result, key, error) {
            calls.push(["resource", path, unwrap(key)]);

            if (entries[path].resourceError) {
                fill(error, nativeError("metadata error"));
                return false;
            }

            fill(result, entries[path].resourceMissing ? nil : box(entries[path][unwrap(key)]));
            return true;
        }
    };
}

function urlClass(entries, calls) {
    return {
        fileURLWithPath: (path) => fileURL(entries, calls, path),
        URLByResolvingAliasFileAtURLOptionsError(url, options, error) {
            calls.push(["resolve", url.path, options]);

            const entry = entries[url.path];

            if (entry.targetError) {
                fill(error, nativeError("target error"));
                return nil;
            }

            return { isNil: () => false, isFileURL: !entry.remote, path: box(entry.target) };
        }
    };
}

function fakeFoundation(overrides = {}) {
    const entries = { ...ENTRIES, ...overrides };
    const calls = [];
    const ns = {
        NSFileManager: { defaultManager: fileManager(entries, calls) },
        NSURL: urlClass(entries, calls),
        NSFileType: box("type"),
        NSFileTypeDirectory: box("directory"),
        NSFileTypeRegular: box("regular"),
        NSFileTypeSymbolicLink: box("symlink"),
        NSURLIsPackageKey: box("package"),
        NSURLIsAliasFileKey: box("alias"),
        NSURLBookmarkResolutionWithoutUI: 256,
        NSURLBookmarkResolutionWithoutMounting: 512
    };
    // Each out-parameter made is kept, so a test can see which call got which.
    const made = [];
    const outParameter = () => {
        const out = { isNil: () => true };

        made.push(out);
        return out;
    };

    return { bridge: { ns, objc: { unwrap }, outParameter }, entries, calls, made };
}

module.exports = { fakeFoundation, box, nil, nativeError, unwrap };
