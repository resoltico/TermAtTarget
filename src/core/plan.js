"use strict";

const { absolutePath, parentPath, displayPath } = require("./paths.js");
const { physicalPath, resolveTarget } = require("./resolve.js");

/*
 * Where Terminal opens, decided from what was selected.
 *
 * An ordinary file opens its parent. A folder opens inside or at its parent. An
 * alias or a symbolic link either opens where it itself sits, or has the same
 * rules applied to what it points at.
 */

const ROOT = "/";

// Whether to follow a link to its target or stay where the link sits.
function linkChoice(path, kind, config, io) {
    const choice = config.defaultLinkAction === "ASK"
        ? io.chooseLink(path, kind)
        : config.defaultLinkAction;

    if (choice !== "LINK" && choice !== "TARGET") {
        throw new Error("Invalid link-location choice.");
    }

    return choice;
}

/*
 * Inside the folder, or at its parent. Where the two are the same place -- the
 * root -- there is nothing to ask. `via` is the kind of link the folder was
 * reached through, or null, so a question can say which folder it is about.
 */
function folderDestination(path, via, config, io) {
    if (path === ROOT) {
        return ROOT;
    }

    const choice = config.defaultFolderAction === "ASK"
        ? io.chooseFolderMode(path, via)
        : config.defaultFolderAction;

    if (choice === "INSIDE") {
        return path;
    }

    if (choice === "LEVEL") {
        return parentPath(path);
    }

    throw new Error("Invalid folder-location choice.");
}

// A path ending in "/" cannot name a file, and a Finder alias is a file.
function assertSlashFits(selection, facts) {
    if (selection.slashed && (facts.kind === "file" || facts.kind === "alias")) {
        throw new Error(`${displayPath(`${selection.path}/`)} ends in "/", but it names a file, not a folder.`);
    }
}

/*
 * A slash after a symbolic link asks the filesystem's question: does this name
 * a directory? So it is answered the filesystem's way -- symbolic links
 * followed in order, then the item at the end must be a folder -- before
 * anything is asked. A Finder alias on the way is a file, as it is to the
 * filesystem, so it is refused, just as a slashed alias selected directly is.
 * Without a slash a link is never followed unless the person chooses to follow
 * it, so a link whose target is gone still opens its own folder.
 */
function slashedTarget(selection, io) {
    const path = physicalPath(selection.path, io, { links: 0 });
    const facts = io.inspect(path);

    if (facts.kind !== "directory") {
        throw new Error(`${displayPath(`${selection.path}/`)} ends in "/", but it leads to a file, not a folder.`);
    }

    return { path, facts };
}

/*
 * What the selection stands for: the item itself, or -- for an alias or a
 * link the person chose to follow -- what it points at. Null when the answer
 * is the link's own location, which needs no more inspection.
 */
function standIn(selection, config, io) {
    const facts = io.inspect(selection.path);

    assertSlashFits(selection, facts);

    if (facts.kind !== "alias" && facts.kind !== "symlink") {
        return { path: selection.path, facts, via: null };
    }

    const checked = selection.slashed ? slashedTarget(selection, io) : null;

    if (linkChoice(selection.path, facts.kind, config, io) === "LINK") {
        return null;
    }

    return { ...checked ?? resolveTarget(selection.path, io), via: facts.kind };
}

function destination(selection, config, io) {
    if (selection === null) {
        // Choosing a destination is already an explicit INSIDE operation.
        return absolutePath(io.pathOf(io.chooseFolder()));
    }

    const item = standIn(selection, config, io);

    if (item === null) {
        return parentPath(selection.path);
    }

    if (item.facts.kind === "directory") {
        return folderDestination(item.path, item.via, config, io);
    }

    if (item.facts.kind !== "file") {
        throw new Error("The selected item's type could not be determined.");
    }

    return parentPath(item.path);
}

module.exports = { destination };
