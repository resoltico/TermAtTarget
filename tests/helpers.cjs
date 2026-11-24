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
        home: () => "/Users/test",
        isPackage: (path) => items[path]?.package === true,
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
        canEnter(path) {
            record("validate", path);
            return true;
        }
    };
}

// The person's half: the questions, each answered the usual way.
function person(record) {
    return {
        ask(question) {
            record("ask", question);
            return question.usual;
        },
        chooseFolder() {
            record("chooseFolder");
            return "/work";
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
        launch({ terminal, path }) {
            record("launch", path, terminal);
        }
    };
}

function fixture(entries = {}, overrides = {}, saved = {}) {
    const events = [];
    const items = { "/": { kind: "directory" }, "/work": { kind: "directory" }, ...entries };
    const record = (...event) => {
        events.push(event);
    };

    return { events, items, terminal: "Terminal", ...filesystem(items, record), ...person(record), ...mac(record, saved), ...overrides };
}

// The host the workflow is given, every port answered by the fixture.
function hostFor(io) {
    return {
        files: io,
        preferences: io,
        terminals: io,
        ask: io.ask,
        chooseFolder: io.chooseFolder,
        settingsScreen: io
    };
}

function asked(io, id) {
    return io.events.filter(([name, question]) => name === "ask" && question.id === id)
        .map(([, question]) => question);
}

// The names of the calls made, in order.
function calls(io) {
    return io.events.map(([name, question]) => name === "ask" ? `ask:${question.id}` : name);
}

module.exports = { fixture, hostFor, calls, asked, NOTHING_SAVED, DEFAULTS };
