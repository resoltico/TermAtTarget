"use strict";

/*
 * The questions asked of the person: the question first, each path once, and
 * a button for each answer that says what it does, the usual one the default.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createDialogs } = require("../../../src/runtime/dialogs.js");

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

// The filesystem's one answer the dialogs need: whether a folder is a package.
const files = (packages = []) => ({ isPackage: (path) => packages.includes(path) });

test("choosing a folder asks for exactly one, and returns what was chosen", () => {
    const app = standardAdditions();

    assert.deepEqual(createDialogs(app, files()).chooseFolder(), { path: "/chosen" });
    assert.deepEqual(app.asked[0].options, { withPrompt: "Choose a folder to open in Terminal:", multipleSelectionsAllowed: false });
});

test("the folder question asks where, and shows the folder's name and where it is, once each", () => {
    const app = standardAdditions();

    assert.equal(createDialogs(app, files()).chooseFolderMode("/Users/you/Downloads/Projects", null), "INSIDE");
    assert.equal(app.asked[0].text, "Where should Terminal open?\n\nFolder: Projects\nIn: /Users/you/Downloads");
});

test("its buttons are Cancel, Open in Parent, and Open Inside as the default", () => {
    const app = standardAdditions();

    createDialogs(app, files()).chooseFolderMode("/work", null);
    assert.deepEqual(app.asked[0].options, {
        withTitle: "Term At Target",
        buttons: ["Cancel", "Open in Parent", "Open Inside"],
        defaultButton: "Open Inside",
        cancelButton: "Cancel"
    });
});

test("Open in Parent opens at the parent", () => {
    const app = standardAdditions(1);

    assert.equal(createDialogs(app, files()).chooseFolderMode("/work", null), "LEVEL");
});

test("a package is named as one", () => {
    const app = standardAdditions();

    createDialogs(app, files(["/work/App.app"])).chooseFolderMode("/work/App.app", null);
    assert.equal(app.asked[0].text, "Where should Terminal open?\n\nPackage: App.app\nIn: /work");
});

test("a folder reached through a link says where it came from", () => {
    const app = standardAdditions();
    const dialogs = createDialogs(app, files());

    dialogs.chooseFolderMode("/target", "alias");
    dialogs.chooseFolderMode("/target", "symlink");
    assert.match(app.asked[0].text, /\nIn: \/\nThis is where the selected Finder alias points\.$/u);
    assert.match(app.asked[1].text, /\nThis is where the selected symbolic link points\.$/u);
});

test("the link question asks whether to follow, and its default button follows", () => {
    const app = standardAdditions();

    assert.equal(createDialogs(app, files()).chooseLink("/work/Projects alias", "alias"), "TARGET");
    assert.equal(app.asked[0].text, "Follow this Finder alias, or open Terminal where it is?\n\nAlias: Projects alias\nIn: /work");
    assert.deepEqual(app.asked[0].options.buttons, ["Cancel", "Open Where It Is", "Follow Alias"]);
    assert.equal(app.asked[0].options.defaultButton, "Follow Alias");
});

test("for a symbolic link the words are a link's, and Open Where It Is stays put", () => {
    const app = standardAdditions(1);

    assert.equal(createDialogs(app, files()).chooseLink("/work/l", "symlink"), "LINK");
    assert.equal(app.asked[0].text, "Follow this symbolic link, or open Terminal where it is?\n\nLink: l\nIn: /work");
    assert.deepEqual(app.asked[0].options.buttons, ["Cancel", "Open Where It Is", "Follow Link"]);
});

test("a name that could mislead is shown quoted and escaped, never as layout", () => {
    // A line break in a name must not be able to start a new line of the question.
    const app = standardAdditions();

    createDialogs(app, files()).chooseFolderMode("/work/a\nIn: elsewhere", null);
    assert.equal(app.asked[0].text, "Where should Terminal open?\n\nFolder: \"a\\u{000A}In: elsewhere\"\nIn: /work");
});
