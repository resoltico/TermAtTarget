"use strict";

/*
 * A path is text the filesystem can hold, and an unpaired UTF-16 surrogate is
 * not text. Iterating a string yields a well-formed pair as one character of
 * length two, so a character of length one in the surrogate range is a
 * surrogate with no partner.
 */
const SURROGATE_FIRST = 0xD800;
const SURROGATE_LAST = 0xDFFF;

function isLoneSurrogate(character) {
    const unit = character.charCodeAt(0);

    return character.length === 1 && unit >= SURROGATE_FIRST && unit <= SURROGATE_LAST;
}

function validUnicode(text) {
    for (const character of text) {
        if (isLoneSurrogate(character)) {
            return false;
        }
    }
    return true;
}

function checkPathText(text) {
    if (typeof text !== "string" || text.length === 0 || text.includes("\0") || !validUnicode(text)) {
        throw new Error("A path must be nonempty Unicode text without a NUL character.");
    }
    return text;
}

function decodeFileURL(text) {
    const match = /^file:\/\/(?<host>[^/]*)(?<path>\/[^?#]*)$/iu.exec(text);
    if (!match || (match.groups.host !== "" && match.groups.host.toLowerCase() !== "localhost")) {
        throw new Error("Use a local file URL without a remote host, query, or fragment.");
    }
    // Encoded '/' is not a filename character on POSIX. Reject it rather than
    // turning an encoded filename component into a different directory tree.
    if (/%2f/iu.test(match.groups.path)) {
        throw new Error("A file URL must not contain an encoded path separator.");
    }
    try {
        return decodeURIComponent(match.groups.path);
    } catch (error) {
        throw new Error("The file URL contains invalid percent-encoding or UTF-8.", { cause: error });
    }
}

// A file URL decoded once, or a path as given. Decoding is not repeated: a
// name that contains "%41" is a name that contains "%41".
function pathText(text) {
    checkPathText(text);
    return /^file:/iu.test(text) ? checkPathText(decodeFileURL(text)) : text;
}

function absolutePath(given) {
    const text = pathText(given);
    if (!text.startsWith("/")) {
        throw new Error("Use an absolute POSIX path or a local file URL; relative paths and ~ are not expanded.");
    }
    const components = text.split("/").filter(component => component !== "");
    if (components.some(component => component === "." || component === "..")) {
        throw new Error("Direct input must not contain . or .. path components. Select the item itself.");
    }
    return `/${components.join("/")}`;
}

function parentPath(path) {
    const normalized = absolutePath(path);
    const lastSlash = normalized.lastIndexOf("/");
    return lastSlash <= 0 ? "/" : normalized.slice(0, lastSlash);
}

function displayPath(path) {
    return JSON.stringify(path);
}

/*
 * What was selected: its path, and whether the text ended in "/". A slash
 * means the name cannot be a file (POSIX), which the planner holds it to once
 * it knows what the item is. It cannot mean "must be a folder": Foundation
 * spells a URL for a symbolic link to a folder with one too.
 */
function selectedPath(input, pathOf) {
    if (input === null || input === undefined) {
        return null;
    }
    const items = Array.isArray(input) ? input : [input];
    if (items.length === 0) {
        return null;
    }
    if (items.length !== 1) {
        throw new Error("Term At Target opens one selected item at a time. Select one file or folder and run it again.");
    }
    const text = pathText(pathOf(items[0]));
    const path = absolutePath(text);
    return { path, slashed: path !== "/" && text.endsWith("/") };
}

module.exports = {
    validUnicode, checkPathText, decodeFileURL, absolutePath,
    parentPath, displayPath, selectedPath
};
