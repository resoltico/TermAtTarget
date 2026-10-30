"use strict";

/*
 * The words the core and every question share: the answers a person can give,
 * and the terminal apps a destination can be opened in. Wording shown to a
 * person lives with the questions; these are what the answers mean.
 *
 * The folder, link and terminal values are also what is saved as settings, so
 * each is a stored format: renaming one turns every saved copy of it into a
 * value that is no longer recognised.
 */

// A folder opens inside itself or at its parent, or the person is asked.
const FOLDER = Object.freeze({ ASK: "ask", INSIDE: "inside", PARENT: "parent" });

// A Finder alias or symbolic link is followed, or opens where it sits.
const LINK = Object.freeze({ ASK: "ask", FOLLOW: "follow", STAY: "stay" });

// A run given nothing either chooses a folder or changes the settings.
const START = Object.freeze({ CHOOSE: "choose", SETTINGS: "settings" });

/*
 * Whether the settings let a folder be opened, as a run given nothing first
 * says: ready; a saved setting not recognised; or the chosen terminal app not
 * installed. Only a ready run offers a folder to choose.
 */
const SETUP = Object.freeze({ READY: "ready", UNRECOGNISED: "unrecognised", MISSING: "missing" });

/*
 * The terminal apps, each by the name it goes by. One belongs here only once
 * a shell it starts has been measured at the folder it was asked to open; how
 * each is reached is src/runtime/executables.js's.
 *
 * `readsVariables` marks an app that expands environment variables in the
 * folder it is given. Measured for kitty 0.49.2, whether handed the folder by
 * open or by its own --directory: a folder named "dollar $HOME" opened in the
 * home folder, while $(...), backticks and ~ stayed literal. Such an app is
 * never given a folder whose path holds a "$".
 */
const TERMINALS = Object.freeze([
    Object.freeze({ id: "terminal", name: "Terminal", readsVariables: false }),
    Object.freeze({ id: "ghostty", name: "Ghostty", readsVariables: false }),
    Object.freeze({ id: "iterm2", name: "iTerm2", readsVariables: false }),
    Object.freeze({ id: "kitty", name: "kitty", readsVariables: true })
]);

// The terminal app with this id, or null for an id that is not one.
function terminalApp(id) {
    return TERMINALS.find((terminal) => terminal.id === id) ?? null;
}

module.exports = { FOLDER, LINK, START, SETUP, TERMINALS, terminalApp };
