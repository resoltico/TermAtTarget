"use strict";

const { absolutePath, parentPath } = require("./paths.js");
const { physicalPath, resolveTarget } = require("./resolve.js");
const { askAnswer, folderQuestion, linkQuestion } = require("./questions.js");
const { refuse, fault, isFault, withMissingFile } = require("./outcomes.js");
const { FOLDER, LINK } = require("./vocabulary.js");

/*
 * Where the terminal app opens, decided from what was selected.
 *
 * An ordinary file opens its parent. A folder opens inside or at its parent. An
 * alias or a symbolic link either opens where it itself sits, or has the same
 * rules applied to what it points at.
 *
 * `files` answers what an item is and where a link leads; the host puts the
 * questions to the person.
 */

const ROOT = "/";

function folderDestination({ path, via }, settings, files, request) {
    if (path === ROOT) {
        return { path, offeredParent: null };
    }

    const question = settings.folder === FOLDER.ASK ? folderQuestion(path, via, request.terminal, files) : null;
    const choice = question === null ? settings.folder : askAnswer(question, request.ask);
    const parent = parentPath(path);

    return choice === FOLDER.INSIDE
        ? { path, offeredParent: question === null ? null : parent }
        : { path: parent, offeredParent: null };
}

// A path ending in "/" cannot name a file, and a Finder alias is a file.
function assertSlashFits(selection, facts) {
    if (selection.slashed && (facts.kind === "file" || facts.kind === "alias")) {
        throw refuse("slashedFile", { path: `${selection.path}/` });
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
function slashedTarget(selection, files) {
    const path = physicalPath(selection.path, files, { links: 0 });
    const facts = files.inspect(path);

    if (facts.kind !== "directory") {
        throw refuse("slashedLinkToFile", { path: `${selection.path}/` });
    }

    return { path, facts };
}

/*
 * What the selection stands for: the item itself, or -- for an alias or a
 * link the person chose to follow -- what it points at. Null when the answer
 * is the link's own location, which needs no more inspection.
 */
function followedTarget(path, files, question) {
    const stayOffered = question !== null;

    try {
        return withMissingFile(() => resolveTarget(path, files),
            (native) => refuse("linkTargetMissing", { path, native, stayOffered }));
    } catch (error) {
        if (isFault(error) && error.kind === "aliasUnresolved") {
            throw refuse("aliasTargetMissing", { native: error.params, stayOffered });
        }

        throw error;
    }
}

function standIn(selection, settings, files, request) {
    const facts = withMissingFile(() => files.inspect(selection.path),
        (native) => refuse("selectionMissing", { path: selection.path, native }));

    assertSlashFits(selection, facts);

    if (facts.kind !== "alias" && facts.kind !== "symlink") {
        return { path: selection.path, facts, via: null };
    }

    const checked = selection.slashed ? withMissingFile(() => slashedTarget(selection, files),
        (native) => refuse("linkTargetMissing", { path: selection.path, native, stayOffered: false })) : null;

    const question = settings.link === LINK.ASK ? linkQuestion(selection.path, facts.kind, request.terminal, files) : null;
    const choice = question === null ? settings.link : askAnswer(question, request.ask);

    if (choice === LINK.STAY) {
        return null;
    }

    return { ...checked ?? followedTarget(selection.path, files, question), via: facts.kind };
}

function destination(selection, settings, files, request) {
    if (selection === null) {
        // Choosing a destination is already an explicit "inside" operation.
        return { path: absolutePath(files.pathOf(request.chooseFolder())), offeredParent: null };
    }

    const item = standIn(selection, settings, files, request);

    if (item === null) {
        return { path: parentPath(selection.path), offeredParent: null };
    }

    if (item.facts.kind === "directory") {
        return folderDestination(item, settings, files, request);
    }

    if (item.facts.kind !== "file") {
        throw fault("unknownItemKind", { path: item.path });
    }

    return { path: parentPath(item.path), offeredParent: null };
}

module.exports = { destination };
