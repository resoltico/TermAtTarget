"use strict";

// The number JXA gives a run the person cancelled: userCanceledErr.
const USER_CANCELLED = -128;

function cancelled() {
    const error = new Error("Cancelled.");
    error.errorNumber = USER_CANCELLED;
    return error;
}

function isCancellation(error) {
    // JXA reports a cancelled dialog through errorNumber; a `number` or a
    // `code` property is something else, and is not a cancellation.
    return Boolean(error && error.errorNumber === USER_CANCELLED);
}

function messageOf(error) {
    if (error && typeof error.message === "string") {
        return error.message;
    }
    return String(error);
}

module.exports = { cancelled, isCancellation, messageOf };
