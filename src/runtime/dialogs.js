"use strict";

const { presentLocation } = require("../core/present.js");

/*
 * The questions asked of the person.
 *
 * Each opens with the question itself, shows each path once -- the item's
 * name, and the folder it is in -- and answers with a button that says what
 * it does: Cancel, the alternative, and the usual answer as the default, so
 * Return takes it and Esc cancels. A link question's answers say "Follow",
 * not "Open", since a folder question may come next. Names are shown by
 * src/core/present.js, which quotes and escapes anything that could mislead;
 * what is shown is never read back as a path.
 */

const TITLE = "Term At Target";
const CANCEL = "Cancel";
const INSIDE = "Open Inside";
const PARENT = "Open in Parent";
const WHERE_IT_IS = "Open Where It Is";
const LINKS = {
    alias: { noun: "Finder alias", label: "Alias", follow: "Follow Alias" },
    symlink: { noun: "symbolic link", label: "Link", follow: "Follow Link" }
};

/*
 * The button pressed, which must be one of those offered. Cancel is not an
 * answer: Standard Additions throws for it with errorNumber -128, which the
 * core recognises as a cancellation, so it passes through as thrown.
 */
function ask(app, text, answers) {
    const answer = app.displayDialog(text, {
        withTitle: TITLE,
        buttons: [CANCEL, answers.other, answers.usual],
        defaultButton: answers.usual,
        cancelButton: CANCEL
    });

    if (answer === null || typeof answer !== "object" || ![answers.other, answers.usual].includes(answer.buttonReturned)) {
        throw new Error("The location dialog returned an invalid answer.");
    }

    return answer.buttonReturned;
}

function folderQuestion(path, via, files) {
    const { name, parent } = presentLocation(path);
    const noun = files.isPackage(path) ? "Package" : "Folder";
    const origin = via === null ? "" : `\nThis is where the selected ${LINKS[via].noun} points.`;

    return `Where should Terminal open?\n\n${noun}: ${name}\nIn: ${parent}${origin}`;
}

function createDialogs(app, files) {
    return {
        chooseFolder() {
            return app.chooseFolder({ withPrompt: "Choose a folder to open in Terminal:", multipleSelectionsAllowed: false });
        },
        chooseFolderMode(path, via) {
            return ask(app, folderQuestion(path, via, files), { other: PARENT, usual: INSIDE }) === INSIDE ? "INSIDE" : "LEVEL";
        },
        chooseLink(path, kind) {
            const link = LINKS[kind];
            const { name, parent } = presentLocation(path);
            const text = `Follow this ${link.noun}, or open Terminal where it is?\n\n${link.label}: ${name}\nIn: ${parent}`;

            return ask(app, text, { other: WHERE_IT_IS, usual: link.follow }) === link.follow ? "TARGET" : "LINK";
        }
    };
}

module.exports = { createDialogs };
