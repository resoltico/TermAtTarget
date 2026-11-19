"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createFailureReport, failureReport } = require("../../../src/runtime/failure-report.js");
const { REFUSALS, FAULTS, NATIVE_OPERATIONS, refuse, fault } = require("../../../src/core/outcomes.js");
const { CATALOG, SOURCE_LOCALE } = require("../../../src/core/messages.js");

const GENERAL = "Term At Target couldn't finish";
const HINT = "Run Term At Target with nothing selected to change its settings.";
const DETAILS = {
    operation: "inspect", path: "/x", domain: "TestDomain", code: 3, description: "Folder missing"
};

function reported(error) {
    const seen = [];

    createFailureReport({ displayAlert: (summary, options) => seen.push([summary, options.message]) })(error);
    return seen;
}

test("a refusal is headed by its own summary", () => {
    assert.deepEqual(reported(refuse("multipleSelection")),
        [["Select one item at a time", "Term At Target opens one selected item at a time. Select one file or folder and run it again."]]);
});

test("other failures are headed by the general summary", () => {
    assert.deepEqual(reported(new Error("Unexpected failure.")), [[GENERAL, "Unexpected failure."]]);
    assert.deepEqual(reported("native text"), [[GENERAL, "native text"]]);
    assert.deepEqual(reported(null), [[GENERAL, "null"]]);
    assert.deepEqual(reported({ message: 0 }), [[GENERAL, "[object Object]"]]);
});

test("full paths in an actual alert expose bidi controls that JSON spelling keeps invisible", () => {
    const path = "/Users/test/\u202Etxt.exe/";
    const refusal = refuse("slashedFile", { path });
    const expected = '"/Users/test/\\u{202E}txt.exe/" ends in "/", but it names a file, not a folder.';

    assert.deepEqual(reported(refusal), [["The selected path names a file", expected]]);
    assert.equal(refusal.params.path, path);
    assert.throws(() => assert.equal(`${JSON.stringify(path)} ends in "/", but it names a file, not a folder.`, expected),
        { code: "ERR_ASSERTION" });
});

test("the settings hint and parent remedy follow the declared remedies", () => {
    const report = (parentUsable) => failureReport(refuse("terminalReadsVariables", {
        terminal: "kitty", path: "/some/$folder", parentUsable
    }));
    const base = 'kitty reads "$" in a folder\'s path as the start of a variable, so it would open somewhere other than /some/$folder. ' +
        "Choose another terminal app for this folder.";

    assert.deepEqual(report(true), {
        heading: "kitty can't open this folder",
        message: `${base} The parent folder has no "$", so kitty can open it. Choose Open in Parent. ${HINT}`
    });
    assert.deepEqual(report(false), { heading: "kitty can't open this folder", message: `${base} ${HINT}` });
    assert.deepEqual(failureReport(refuse("settingUnrecognised", { setting: "link", saved: "unknown" })), {
        heading: "The link setting isn't recognised",
        message: `The saved link setting, unknown, is not one of ask, follow, stay. ${HINT}`
    });
    assert.equal(failureReport(refuse("settingUnrecognised", { setting: "link", saved: 123 })).message,
        `The saved link setting, 123, is not one of ask, follow, stay. ${HINT}`);
});

test("native faults keep their specific operation and present path text safely", () => {
    const details = { ...DETAILS, path: "/a\u202Etxt", description: "Bad \u202Etxt" };

    assert.deepEqual(failureReport(fault("native", details)), {
        heading: GENERAL,
        message: 'macOS could not inspect "/a\\u{202E}txt". macOS reported "Bad \\u{202E}txt" (TestDomain, code 3).'
    });
    assert.deepEqual(failureReport(fault("native", { ...DETAILS, description: null, domain: null, code: null })),
        { heading: GENERAL, message: "macOS could not inspect /x. macOS did not provide further details." });
    assert.deepEqual(failureReport(refuse("aliasTargetMissing", { native: { ...DETAILS, operation: "resolveAlias" } })), {
        heading: "The alias's original can't be found",
        message: "macOS could not resolve the alias target for /x. macOS reported Folder missing (TestDomain, code 3). " +
            "Choose Open Where It Is to open the folder containing the alias, or set Finder aliases to Open where it is in the settings."
    });
});

test("a pending launch reports deadline, lost observation, and cleanup separately", () => {
    const params = { terminal: "iterm2", path: "/work", cause: null, stopped: true, pid: 12, cleanup: [] };
    const message = (changes) => failureReport(refuse("launchUnconfirmed", { ...params, ...changes })).message;
    const start = "iTerm2 was asked to open /work. The window may still appear. Term At Target made one attempt.";
    const deadline = "The request was still pending at the deadline.";

    assert.equal(message({}), `${start} ${deadline}`);
    assert.equal(message({ stopped: false }), `${start} ${deadline} open (process 12) was told to stop, but may still be running.`);
    assert.equal(message({ stopped: false, pid: null, cause: { failure: new Error("Lost.") }, cleanup: [new Error("Gone.")] }),
        `${start} The status of open could not be read. Lost. open was told to stop, but may still be running. Stopping open also failed. Gone.`);
});

function messageIds(kinds, construct, paramsFor) {
    return Object.entries(kinds).flatMap(([kind, names]) => {
        const { heading, message } = failureReport(construct(kind, paramsFor(names)));

        assert.ok(heading.trim(), kind);
        assert.ok(message.trim(), kind);
        return construct === refuse ? [`${kind}.summary`, `${kind}.message`] : [`${kind}.message`];
    });
}

test("every declared outcome has words and every catalog entry has a consumer", () => {
    const sample = {
        ...DETAILS, native: DETAILS, terminal: "terminal", setting: "folder", saved: "bad", status: 1,
        question: "start", parentUsable: true, cause: null, stopped: true, pid: null, cleanup: []
    };
    const paramsFor = (names) => Object.fromEntries(names.map((name) => [name, sample[name]]));
    const expected = [
        "saved.date", "saved.opaque", "native.noDetails", "terminalReadsVariables.parent",
        "start.ready", "start.missing", "start.unrecognised", "chooseFolder.prompt",
        "folder.question", "folder.folder", "folder.package", "folder.via.alias", "folder.via.symlink", "link.alias", "link.symlink",
        ...["settings", "choose", "inside", "parent", "stay", "follow.alias", "follow.symlink"].map((name) => `answer.${name}.action`),
        ...["inside", "parent", "stay", "follow", "ask"].map((name) => `answer.${name}.option`),
        ...["terminal", "folder", "link"].map((name) => `settings.${name}.label`),
        "settings.row", "settings.unrecognised", "settings.notInstalled",
        ...["deadline", "lost", "unstopped", "pid", "cleanup"].map((name) => `launchUnconfirmed.${name}`),
        ...Object.values(NATIVE_OPERATIONS).map((operation) => `native.${operation}.message`)
    ];

    const refusalIds = messageIds(REFUSALS, refuse, paramsFor);
    const faultIds = messageIds(FAULTS, fault, paramsFor);

    assert.deepEqual(Object.keys(CATALOG[SOURCE_LOCALE]).sort(), [...expected, ...refusalIds, ...faultIds].sort());
    assert.ok(Object.values(CATALOG[SOURCE_LOCALE]).every((message) => message.trim().length > 0));
});
