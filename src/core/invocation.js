"use strict";

/*
 * What run() was handed, as the items that were selected.
 *
 * Shortcuts' Run JavaScript for Mac Automation does not pass its input as the
 * first argument. It passes both of its own arguments inside it:
 *
 *     run([[item, ...], { source, "temporary items path", ignoresInput }], {})
 *
 * Measured on macOS 27 for a file, a folder, a Finder alias, two files and an
 * empty selection, fed from Get Selected Files in Finder and from the
 * shortcut's own input: the same shape every time, `source` a string and
 * `ignoresInput` a boolean. Read as the selection itself, one file was two
 * items and every run was refused.
 *
 * A list inside a list is recognised as that envelope and nothing else: the
 * selection osascript passes is flat, so a nested list has no other meaning.
 * An envelope that is not exactly the measured shape is refused by name,
 * rather than read some other way and refused as a multiple selection.
 * ignoresInput is checked, not acted on: the items are what the action was
 * given, whatever the flag says.
 */

const ENVELOPE_LENGTH = 2;

function isActionOptions(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) &&
        typeof value.source === "string" && typeof value.ignoresInput === "boolean";
}

function selectionOf(input) {
    if (!Array.isArray(input) || !Array.isArray(input[0])) {
        return input;
    }

    if (input.length !== ENVELOPE_LENGTH || !isActionOptions(input[1])) {
        throw new Error("Shortcuts passed its input in a form this version does not recognise.");
    }

    return input[0];
}

module.exports = { selectionOf };
