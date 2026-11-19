"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { startQuestion, folderQuestion, linkQuestion } = require("../../../src/core/questions.js");

const FILES = { home: () => "/Users/test", isPackage: (path) => path.endsWith(".app") };

test("the first question offers a folder only with usable settings", () => {
    for (const [terminal, reason, answers, usual] of [
        ["Ghostty", "ready", ["settings", "choose"], "choose"],
        ["Ghostty", "missing", ["settings"], "settings"],
        [null, "unrecognised", ["settings"], "settings"]
    ]) {
        assert.deepEqual(startQuestion(terminal, reason), { id: "start", params: { terminal, reason }, answers, usual });
    }
});

test("folder and package questions describe where the item came from and offer both choices", () => {
    for (const [name, subject] of [["Project", "folder"], ["Demo.app", "package"]]) {
        for (const via of [null, "alias", "symlink"]) {
            assert.deepEqual(folderQuestion(`/Users/test/${name}`, via, "kitty", FILES), {
                id: "folder",
                params: { terminal: "kitty", via, subject, name, parent: "~" },
                answers: ["parent", "inside"],
                usual: "inside"
            });
        }
    }
});

test("a failed package lookup leaves the folder's choices available with ordinary folder wording", () => {
    const files = { ...FILES, isPackage: () => { throw new Error("missing metadata"); } };

    assert.deepEqual(folderQuestion("/work/Demo.app", null, "Terminal", files), {
        id: "folder",
        params: { terminal: "Terminal", via: null, subject: "folder", name: "Demo.app", parent: "/work" },
        answers: ["parent", "inside"],
        usual: "inside"
    });
});

test("links offer their own location or their target, naming the link kind", () => {
    for (const via of ["alias", "symlink"]) {
        assert.deepEqual(linkQuestion("/work/a\u202E", via, "Terminal", FILES), {
            id: "link",
            params: { terminal: "Terminal", via, name: '"a\\u{202E}"', parent: "/work" },
            answers: ["stay", "follow"],
            usual: "follow"
        });
    }
});

test("each declared question fits a Standard Additions dialog with Cancel", () => {
    const questions = [
        ...["ready", "missing", "unrecognised"].map((reason) => startQuestion("Terminal", reason)),
        ...[null, "alias", "symlink"].map((via) => folderQuestion("/work/Demo.app", via, "Terminal", FILES)),
        ...["alias", "symlink"].map((via) => linkQuestion("/work/link", via, "Terminal", FILES))
    ];

    for (const { answers, usual } of questions) {
        assert.ok(answers.length <= 2, answers);
        assert.ok(answers.includes(usual));
    }
});
