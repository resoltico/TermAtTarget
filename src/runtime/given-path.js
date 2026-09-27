"use strict";

const { isNil } = require("./bridge.js");

/*
 * The path Shortcuts handed over, whatever form it arrived in.
 *
 * Shortcuts can pass a plain string, a native NSString or NSURL, or a JXA Path.
 * Each is read the one way that form documents; nothing is serialized
 * generically and nothing is looked up in Finder. The planning core validates
 * what comes out.
 */

// typeof null is "object", so null is the one value that has to be named.
function isObjectLike(value) {
    return value !== null &&
        (typeof value === "object" || typeof value === "function") &&
        !Array.isArray(value);
}

// A native NSString's text. Other JXA objects can throw when unwrapped.
function nativeText(bridge, value) {
    try {
        const unwrapped = bridge.objc.unwrap(value);

        return typeof unwrapped === "string" ? unwrapped : null;
    } catch {
        return null;
    }
}

/*
 * A file URL's text. A file-reference URL (file:///.file/id=...) names an
 * object, not a path -- read as a path it would name nothing -- so Foundation
 * turns it into the path of that object first. Only a reference is converted:
 * a path URL is taken as spelled, so a link stays the link that was selected.
 */
function nativeURLText(objc, url) {
    if (!url.isFileURL) {
        throw new Error("Only local file URLs are accepted.");
    }

    const pathURL = url.isFileReferenceURL ? url.filePathURL : url;

    if (isNil(pathURL)) {
        throw new Error("The selected item no longer exists.");
    }

    return String(objc.unwrap(pathURL.absoluteString));
}

/*
 * A native URL's text when the value is one, and null when it is not. Asking
 * an arbitrary JXA object about an Objective-C class can throw -- an object
 * without the method among them -- and an object that cannot say is not one.
 */
function nativeURLOrNothing(bridge, value) {
    try {
        if (!value.isKindOfClass(bridge.ns.NSURL)) {
            return null;
        }
    } catch {
        return null;
    }

    return nativeURLText(bridge.objc, value);
}

// Apple's documented Path conversion, accepted only when it looks like a path.
function pathConversion(bridge, value) {
    if (typeof value.toString !== "function") {
        return null;
    }

    const text = value.toString();

    return typeof text === "string" && (text.startsWith("/") || /^file:/iu.test(text)) ? text : null;
}

/*
 * A file-reference URL written as text -- `file:///.file/id=...` -- goes
 * through Foundation like a native one, so it becomes the path of what it
 * refers to rather than the path "/.file/id=...". Any other text is left to
 * the core, which decodes a path URL once and keeps its spelling.
 */
const REFERENCE_TEXT = /^file:\/\/(?:localhost)?\/\.file\/id=/iu;

function referenceResolved(bridge, text) {
    if (!REFERENCE_TEXT.test(text)) {
        return text;
    }

    const url = bridge.ns.NSURL.URLWithString(text);

    if (isNil(url)) {
        throw new Error("The selected item no longer exists.");
    }

    return nativeURLText(bridge.objc, url);
}

/*
 * Each reader answers text or null, and they are asked in the order the forms
 * are cheapest to recognise and least able to be mistaken for each other. The
 * first answer that is not null is the path.
 */
const READERS = [nativeText, nativeURLOrNothing, pathConversion];

function readText(bridge, value) {
    if (typeof value === "string") {
        return value;
    }

    if (!isObjectLike(value)) {
        throw new Error("Shortcuts must supply a file, folder, absolute path, or local file URL.");
    }

    for (const read of READERS) {
        const text = read(bridge, value);

        if (text !== null) {
            return text;
        }
    }

    throw new Error("The supplied item has no usable filesystem path. Configure the action to receive Files.");
}

function pathOf(bridge, value) {
    return referenceResolved(bridge, readText(bridge, value));
}

module.exports = { pathOf };
