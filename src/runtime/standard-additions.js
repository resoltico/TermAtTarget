"use strict";

const { cancelled } = require("../core/errors.js");

/*
 * Standard Additions, as every question uses it: an answer is one of those
 * offered, and Cancel is the core's cancellation.
 *
 * Standard Additions says a person cancelled by throwing errorNumber -128
 * (userCanceledErr), from a dialog and from the folder chooser alike; a
 * `number` or `code` property, or the number as text, is something else. A
 * list a person cancels returns false instead of throwing.
 */

const TITLE = "Term At Target";
const CANCEL = "Cancel";
const USER_CANCELLED = -128;

function answered(action) {
    try {
        return action();
    } catch (error) {
        if (error && error.errorNumber === USER_CANCELLED) {
            throw cancelled();
        }

        throw error;
    }
}

/*
 * A dialog with Cancel, the alternative if there is one, and the usual answer
 * as the default, on the right, so Return takes it and Esc cancels. Three is
 * as many buttons as Standard Additions allows.
 */
function ask(app, text, answers) {
    const offered = answers.other === undefined ? [answers.usual] : [answers.other, answers.usual];
    const answer = answered(() => app.displayDialog(text, {
        withTitle: TITLE,
        buttons: [CANCEL, ...offered],
        defaultButton: answers.usual,
        cancelButton: CANCEL
    }));

    if (answer === null || typeof answer !== "object" || !offered.includes(answer.buttonReturned)) {
        throw new Error("The dialog returned an invalid answer.");
    }

    return answer.buttonReturned;
}

// One item from a list, or null when the person backs out of it.
function pick(app, items, options) {
    const answer = answered(() => app.chooseFromList(items, {
        ...options,
        multipleSelectionsAllowed: false,
        emptySelectionAllowed: false
    }));

    if (answer === false) {
        return null;
    }

    if (!Array.isArray(answer) || answer.length !== 1 || !items.includes(answer[0])) {
        throw new Error("The settings list returned an invalid answer.");
    }

    return answer[0];
}

// An alert saying what went wrong, which OK dismisses: there is nothing to decide.
function alert(app, summary, message) {
    app.displayAlert(summary, { message, as: "warning", buttons: ["OK"], defaultButton: "OK" });
}

function chooseFolder(app, prompt) {
    return answered(() => app.chooseFolder({ withPrompt: prompt, multipleSelectionsAllowed: false }));
}

module.exports = { TITLE, ask, pick, alert, chooseFolder };
