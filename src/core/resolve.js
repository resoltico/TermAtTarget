"use strict";

const { checkPathText, absolutePath, parentPath, displayPath } = require("./paths.js");

// The most links one resolution may follow before it is taken for a cycle.
const MAX_LINKS = 40;

// One link followed, against the budget the whole resolution shares.
function spendLink(budget, message) {
    budget.links += 1;

    if (budget.links > MAX_LINKS) {
        throw new Error(message);
    }
}

/*
 * A symbolic link met partway through a path. Its target replaces it in what
 * is still to be walked; an absolute target starts the walk again from root.
 * The budget is spent before the link is read, so a cycle is refused before
 * it is followed once more.
 */
function followLinkComponent(state, candidate, io, budget) {
    spendLink(budget, `Too many symbolic links, or a link cycle, while resolving ${displayPath(state.rawPath)}.`);

    const target = checkPathText(io.readLink(candidate));

    if (target.startsWith("/")) {
        state.resolved.length = 0;
    }

    state.pending = target.split("/").concat(state.pending);
}

function enterComponent(state, part, io, budget) {
    const candidate = `/${[...state.resolved, part].join("/")}`;
    const facts = io.inspect(candidate);

    if (facts.kind === "symlink") {
        followLinkComponent(state, candidate, io, budget);
        return;
    }

    // Any remaining component (even '.' or '..') requires a directory.
    if (state.pending.length > 0 && facts.kind !== "directory") {
        throw new Error(`A link target traverses a non-directory: ${displayPath(candidate)}.`);
    }

    state.resolved.push(part);
}

function stepThrough(state, part, io, budget) {
    if (part === "" || part === ".") {
        return;
    }

    if (part === "..") {
        state.resolved.pop();
        return;
    }

    enterComponent(state, part, io, budget);
}

/*
 * Follow filesystem components in order, not a lexical realpath substitute.
 * In particular /a/link/../b must visit link before interpreting '..'.
 * Alias files are not traversable directory components on a POSIX filesystem.
 */
function physicalPath(rawPath, io, budget) {
    checkPathText(rawPath);

    if (!rawPath.startsWith("/")) {
        throw new Error("Internal link resolution requires an absolute path.");
    }

    const state = { rawPath, pending: rawPath.split("/"), resolved: [] };

    while (state.pending.length > 0) {
        stepThrough(state, state.pending.shift(), io, budget);
    }

    return `/${state.resolved.join("/")}`;
}

/*
 * Where an alias or a link points, one hop at a time, or null when the path is
 * neither. A symbolic link is read before the budget is spent, so a link that
 * cannot be read says so rather than being counted against the cycle limit.
 */
function nextHop(path, facts, walk) {
    if (facts.kind === "alias") {
        spendLink(walk.budget, `Too many aliases while resolving ${displayPath(walk.selected)}.`);
        return absolutePath(walk.io.resolveAlias(path));
    }

    if (facts.kind === "symlink") {
        const target = checkPathText(walk.io.readLink(path));

        spendLink(walk.budget, `Too many links while resolving ${displayPath(walk.selected)}.`);

        return physicalPath(target.startsWith("/") ? target : `${parentPath(path)}/${target}`, walk.io, walk.budget);
    }

    return null;
}

function visit(visited, path) {
    if (visited.has(path)) {
        throw new Error(`A link cycle was found at ${displayPath(path)}.`);
    }

    visited.add(path);
}

function resolveTarget(selected, io) {
    const visited = new Set();
    const walk = { selected, io, budget: { links: 0 } };
    let path = selected;

    for (;;) {
        visit(visited, path);

        const facts = io.inspect(path);
        const next = nextHop(path, facts, walk);

        if (next === null) {
            return { path, facts };
        }

        path = next;
    }
}

module.exports = { physicalPath, resolveTarget, MAX_LINKS };
