"use strict";

/*
 * A host for the portable core, over a filesystem described as data.
 *
 * Every call is recorded in order, so a test can assert what was asked and
 * when as well as what came back. Any method can be replaced to inject an
 * answer or a failure; the rest keep behaving like a small, consistent
 * filesystem with a /work folder in it, a person who gives the usual answer,
 * and a Mac with every terminal app installed and the settings given saved.
 */

const NOTHING_SAVED = Object.freeze({ terminal: null, folder: null, link: null });
const DEFAULTS = Object.freeze({ terminal: "terminal", folder: "ask", link: "ask" });

// The filesystem half: what an item is, and where a link or alias points.
function filesystem(items, record) {
    return {
        pathOf(value) {
            record("path", value);
            return String(value);
        },
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

// The person's half: the questions, each answered the usual way.
function person(record) {
    return {
        start(setup) {
            record("start", setup);
            return "choose";
        },
        chooseFolder() {
            record("chooseFolder");
            return "/work";
        },
        chooseLink(path, kind) {
            record("chooseLink", path, kind);
            return "follow";
        },
        chooseFolderMode(path, via) {
            record("chooseFolderMode", path, via);
            return "inside";
        },
        pickSetting(rows) {
            record("pickSetting", rows);
            return null;
        },
        pickValue(key, values, current) {
            record("pickValue", key, values, current);
            return null;
        }
    };
}

// The Mac's half: the settings saved, as given, and the terminal apps.
function mac(record, saved) {
    return {
        load() {
            record("load");
            return { ...NOTHING_SAVED, ...saved };
        },
        save(key, value) {
            record("save", key, value);
        },
        isInstalled(id) {
            record("installed", id);
            return true;
        },
        launch(id, path) {
            record("launch", path, id);
        }
    };
}

function fixture(entries = {}, overrides = {}, saved = {}) {
    const events = [];
    const items = { "/": { kind: "directory" }, "/work": { kind: "directory" }, ...entries };
    const record = (...event) => {
        events.push(event);
    };

    return { events, items, ...filesystem(items, record), ...person(record), ...mac(record, saved), ...overrides };
}

// The host the workflow is given, every port answered by the one fixture. The
// name each set of questions was made for is kept apart from the calls.
function hostFor(io) {
    io.namedFor = [];

    return {
        files: io,
        preferences: io,
        terminals: io,
        questions(name) {
            io.namedFor.push(name);
            return io;
        },
        settingsScreen: io
    };
}

// The names of the calls made, in order.
function calls(io) {
    return io.events.map(([name]) => name);
}

module.exports = { fixture, hostFor, calls, NOTHING_SAVED, DEFAULTS };
