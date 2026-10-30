"use strict";

/*
 * A question the person cancelled. It ends a run quietly, and nothing else
 * does: the runtime turns each host's own way of saying "cancelled" into this,
 * so the core never needs to know what that way is.
 */
class Cancelled extends Error {}

function cancelled() {
    return new Cancelled("Cancelled.");
}

function isCancellation(error) {
    return error instanceof Cancelled;
}

/*
 * A failure a person can put right themselves, with a short summary of it --
 * "Ghostty isn't installed" -- for a host to show as a heading above the
 * message, which says what happened and what to do. Any other failure has no
 * summary of its own, and a host gives it a general one.
 */
function refusal(summary, message) {
    return Object.assign(new Error(message), { summary });
}

function summaryOf(error) {
    return error && typeof error.summary === "string" ? error.summary : null;
}

function messageOf(error) {
    if (error && typeof error.message === "string") {
        return error.message;
    }
    return String(error);
}

module.exports = { cancelled, isCancellation, refusal, summaryOf, messageOf };
