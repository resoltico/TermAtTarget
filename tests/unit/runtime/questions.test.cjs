"use strict";

/*
 * The questions asked of the person: the question first, naming the terminal
 * app, each path once, and a button for each answer that says what it does,
 * the usual one the default.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createQuestions } = require("../../../src/runtime/questions.js");

// Standard Additions, pressing the button at `pick` among those offered.
function standardAdditions(pick = -1) {
    const asked = [];

    return {
        asked,
        displayDialog(text, options) {
            asked.push({ text, options });
            return { buttonReturned: options.buttons.at(pick), gaveUp: false };
        },
        chooseFolder(options) {
            asked.push({ options });
            return { path: "/chosen" };
        }
    };
}

// The filesystem's answers the questions need: whether a folder is a package,
// and the person's home folder.
const files = (packages = [], home = "/Users/you") => ({ isPackage: (path) => packages.includes(path), home: () => home });
const questions = (app, name = "Terminal", packages = []) => createQuestions(app, files(packages))(name);

test("a run given nothing offers a folder to choose, or the settings", () => {
    const app = standardAdditions();

    assert.equal(questions(app, "Ghostty").start("ready"), "choose");
    assert.deepEqual(app.asked[0], {
        text: "Choose a folder to open in Ghostty.",
        options: {
            withTitle: "Term At Target",
            buttons: ["Cancel", "Settings…", "Choose Folder…"],
            defaultButton: "Choose Folder…",
            cancelButton: "Cancel"
        }
    });
    assert.equal(questions(standardAdditions(1)).start("ready"), "settings");
});

test("a chosen app that is not installed is said, and only the settings are offered", () => {
    const app = standardAdditions();

    assert.equal(questions(app, "iTerm2").start("missing"), "settings");
    assert.deepEqual(app.asked[0], {
        text: "iTerm2, the terminal app in the settings, isn't installed.\n\nChoose another app in Settings, or install iTerm2.",
        options: { withTitle: "Term At Target", buttons: ["Cancel", "Settings\u2026"], defaultButton: "Settings\u2026", cancelButton: "Cancel" }
    });
});

test("an unrecognised setting is said, without naming an app that is not known", () => {
    const app = standardAdditions();

    assert.equal(questions(app, null).start("unrecognised"), "settings");
    assert.equal(app.asked[0].text, "A saved setting isn't recognised.\n\nOpen Settings to see which one, and change it.");
    assert.deepEqual(app.asked[0].options.buttons, ["Cancel", "Settings\u2026"]);
});

test("choosing a folder asks for exactly one, in the app's words, and returns what was chosen", () => {
    const app = standardAdditions();

    assert.deepEqual(questions(app, "Ghostty").chooseFolder(), { path: "/chosen" });
    assert.deepEqual(app.asked[0].options, { withPrompt: "Choose a folder to open in Ghostty:", multipleSelectionsAllowed: false });
});

test("the folder question asks where the app should open, and shows the folder's name and where it is", () => {
    const app = standardAdditions();

    assert.equal(questions(app, "Ghostty").chooseFolderMode("/Users/you/Downloads/Projects", null), "inside");
    assert.equal(app.asked[0].text, "Where should Ghostty open?\n\nFolder: Projects\nIn: ~/Downloads");
});

test("its buttons are Cancel, Open in Parent, and Open Inside as the default", () => {
    const app = standardAdditions();

    questions(app).chooseFolderMode("/work", null);
    assert.deepEqual(app.asked[0].options, {
        withTitle: "Term At Target",
        buttons: ["Cancel", "Open in Parent", "Open Inside"],
        defaultButton: "Open Inside",
        cancelButton: "Cancel"
    });
});

test("Open in Parent opens at the parent", () => {
    assert.equal(questions(standardAdditions(1)).chooseFolderMode("/work", null), "parent");
});

test("a package is named as one", () => {
    const app = standardAdditions();

    questions(app, "Terminal", ["/work/App.app"]).chooseFolderMode("/work/App.app", null);
    assert.equal(app.asked[0].text, "Where should Terminal open?\n\nPackage: App.app\nIn: /work");
});

test("a folder reached through a link says where it came from", () => {
    const app = standardAdditions();
    const asked = questions(app);

    asked.chooseFolderMode("/target", "alias");
    asked.chooseFolderMode("/target", "symlink");
    assert.match(app.asked[0].text, /\nIn: \/\nThis is where the selected Finder alias points\.$/u);
    assert.match(app.asked[1].text, /\nThis is where the selected symbolic link points\.$/u);
});

test("the link question asks whether to follow, naming the app, and its default button follows", () => {
    const app = standardAdditions();

    assert.equal(questions(app, "Ghostty").chooseLink("/work/Projects alias", "alias"), "follow");
    assert.equal(app.asked[0].text, "Follow this Finder alias, or open Ghostty where it is?\n\nAlias: Projects alias\nIn: /work");
    questions(app, "Ghostty").chooseLink("/Users/you/l", "symlink");
    assert.match(app.asked[1].text, /\nLink: l\nIn: ~$/u, "the home folder itself is ~");
    assert.deepEqual(app.asked[0].options.buttons, ["Cancel", "Open Where It Is", "Follow Alias"]);
    assert.equal(app.asked[0].options.defaultButton, "Follow Alias");
});

test("for a symbolic link the words are a link's, and Open Where It Is stays put", () => {
    const app = standardAdditions(1);

    assert.equal(questions(app).chooseLink("/work/l", "symlink"), "stay");
    assert.equal(app.asked[0].text, "Follow this symbolic link, or open Terminal where it is?\n\nLink: l\nIn: /work");
    assert.deepEqual(app.asked[0].options.buttons, ["Cancel", "Open Where It Is", "Follow Link"]);
});

test("a name that could mislead is shown quoted and escaped, never as layout", () => {
    // A line break in a name must not be able to start a new line of the question.
    const app = standardAdditions();

    questions(app).chooseFolderMode("/work/a\nIn: elsewhere", null);
    assert.equal(app.asked[0].text, "Where should Terminal open?\n\nFolder: \"a\\u{000A}In: elsewhere\"\nIn: /work");
});
