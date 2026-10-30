"use strict";

const { presentLocation } = require("../core/present.js");
const { FOLDER, LINK, START, SETUP } = require("../core/vocabulary.js");
const { ask, chooseFolder } = require("./standard-additions.js");

/*
 * The questions asked of the person, worded for the terminal app they are
 * about.
 *
 * Each opens with the question itself, shows each path once -- the item's
 * name, and the folder it is in, from "~" inside the person's home folder --
 * and answers with a button that says what it does. A link question's answers
 * say "Follow", not "Open", since a folder question may come next. Names are shown by src/core/present.js, which quotes
 * and escapes anything that could mislead; what is shown is never read back
 * as a path.
 */

const INSIDE = "Open Inside";
const PARENT = "Open in Parent";
const WHERE_IT_IS = "Open Where It Is";
const SETTINGS = "Settings…";
const CHOOSE = "Choose Folder…";
const LINKS = {
    alias: { noun: "Finder alias", label: "Alias", follow: "Follow Alias" },
    symlink: { noun: "symbolic link", label: "Link", follow: "Follow Link" }
};

function folderQuestion(name, path, via, files) {
    const location = presentLocation(path, files.home());
    const noun = files.isPackage(path) ? "Package" : "Folder";
    const origin = via === null ? "" : `\nThis is where the selected ${LINKS[via].noun} points.`;

    return `Where should ${name} open?\n\n${noun}: ${location.name}\nIn: ${location.parent}${origin}`;
}

/*
 * A run given nothing: a folder to choose, or the settings to change. When the
 * settings cannot open anything, it says why and offers only them.
 */
function start(app, name, setup) {
    if (setup === SETUP.READY) {
        return ask(app, `Choose a folder to open in ${name}.`, { other: SETTINGS, usual: CHOOSE }) === CHOOSE
            ? START.CHOOSE
            : START.SETTINGS;
    }

    const text = setup === SETUP.MISSING
        ? `${name}, the terminal app in the settings, isn't installed.\n\nChoose another app in Settings, or install ${name}.`
        : "A saved setting isn't recognised.\n\nOpen Settings to see which one, and change it.";

    ask(app, text, { usual: SETTINGS });
    return START.SETTINGS;
}

function questionsFor(app, files, name) {
    return {
        start: (setup) => start(app, name, setup),
        chooseFolder: () => chooseFolder(app, `Choose a folder to open in ${name}:`),
        chooseFolderMode(path, via) {
            return ask(app, folderQuestion(name, path, via, files), { other: PARENT, usual: INSIDE }) === INSIDE
                ? FOLDER.INSIDE
                : FOLDER.PARENT;
        },
        chooseLink(path, kind) {
            const link = LINKS[kind];
            const location = presentLocation(path, files.home());
            const text = `Follow this ${link.noun}, or open ${name} where it is?\n\n${link.label}: ${location.name}\nIn: ${location.parent}`;

            return ask(app, text, { other: WHERE_IT_IS, usual: link.follow }) === link.follow ? LINK.FOLLOW : LINK.STAY;
        }
    };
}

// The questions, made for the terminal app named (null before one is known).
function createQuestions(app, files) {
    return (name) => questionsFor(app, files, name);
}

module.exports = { createQuestions };
