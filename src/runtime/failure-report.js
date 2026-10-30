"use strict";

const { summaryOf, messageOf } = require("../core/errors.js");
const { alert } = require("./standard-additions.js");

/*
 * A failed run, told to the person in Term At Target's own alert rather than
 * left to Shortcuts, which shows a thrown error as text prefixed with
 * "Error:" once for every layer it passed through (measured through
 * `shortcuts run`). A failure a person can put right has its own summary as
 * the heading; any other has the general one, which stays true even when a
 * request may yet reach the terminal app.
 */

const GENERAL = "Term At Target couldn't finish";

function createFailureReport(app) {
    return (error) => alert(app, summaryOf(error) ?? GENERAL, messageOf(error));
}

module.exports = { createFailureReport };
