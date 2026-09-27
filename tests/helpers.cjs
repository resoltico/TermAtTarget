"use strict";

/*
 * A host for the portable core, over a filesystem described as data.
 *
 * Every call is recorded in order, so a test can assert what was asked and
 * when as well as what came back. Any method can be replaced to inject an
 * answer or a failure; the rest keep behaving like a small, consistent
 * filesystem with a /work folder in it.
 */

// The filesystem half: what an item is, and where a link or alias points.
function filesystem(items, record) {
    return {
        inspect(path) {
            record("inspect", path);

            if (!Object.hasOwn(items, path)) {
                throw new Error(`No such item: ${path}`);
            }

            return items[path];
        },
        readLink(path) {
            record("readLink", path);
            return items[path].target;
        },
        resolveAlias(path) {
            record("resolveAlias", path);
            return items[path].target;
        },
        validateDirectory(path) {
            record("validate", path);

            if (items[path]?.kind !== "directory") {
                throw new Error(`Not a directory: ${path}`);
            }
        }
    };
}

// The person's half: the questions, each answered the first way it offers.
function person(record) {
    return {
        chooseFolder() {
            record("chooseFolder");
            return "/work";
        },
        chooseLink(path, kind) {
            record("chooseLink", path, kind);
            return "TARGET";
        },
        chooseFolderMode(path, via) {
            record("chooseFolderMode", path, via);
            return "INSIDE";
        }
    };
}

function fixture(entries = {}, overrides = {}) {
    const events = [];
    const items = { "/": { kind: "directory" }, "/work": { kind: "directory" }, ...entries };
    const record = (...event) => {
        events.push(event);
    };

    return {
        events,
        items,
        pathOf(value) {
            record("path", value);
            return String(value);
        },
        ...filesystem(items, record),
        ...person(record),
        launch(path) {
            record("launch", path);
        },
        ...overrides
    };
}

// The names of the calls made, in order.
function calls(io) {
    return io.events.map(([name]) => name);
}

const DEFAULTS = Object.freeze({ defaultFolderAction: "ASK", defaultLinkAction: "ASK" });

module.exports = { fixture, calls, DEFAULTS };
