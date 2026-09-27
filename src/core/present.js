"use strict";

const { parentPath } = require("./paths.js");
const { emojiMatcher, emojiPositions, isWriting } = require("./writing.js");

/*
 * How a name or a path is shown to a person in a question.
 *
 * An ordinary name is shown as it is. A name holding anything invisible, or
 * anything that moves the text around it, is shown quoted, with each such
 * character written as \u{XXXX} and `"` and `\` escaped. What counts is
 * decided by Unicode's own properties, not a list: control characters, line
 * and paragraph separators, whitespace other than a plain space, and every
 * default-ignorable code point -- soft hyphens, zero-width and direction
 * marks, fillers, stray tags and selectors.
 *
 * Some of those characters are how visible text is written -- a joined emoji,
 * a defined variation sequence, a joiner where a script's shaping calls for
 * one -- and are kept; src/core/writing.js decides which, by published
 * standards. Anywhere else the same characters are escaped.
 *
 * A space at either end of a component, and a leading `"`, also force the
 * quoted form. Plain text never begins with `"`, so the two forms never meet,
 * and no two different names are shown as the same text. (Characters that
 * merely look alike are a different matter, and the path itself is what is
 * opened.) This is presentation only: nothing shown is ever read back.
 */

const HEX = 16;
const CODE_DIGITS = 4;
const QUOTE = "\"";
const BACKSLASH = "\\";
const SPACE = " ";

const INVISIBLE = /[\p{Cc}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]|[^\S ]/u;
const EMOJI = emojiMatcher();

// For each code point, whether it must be escaped to be seen.
function hiddenMarks(text) {
    const characters = [...text];
    const points = characters.map((character) => character.codePointAt(0));
    const kept = emojiPositions(characters, EMOJI);

    return characters.map((character, index) =>
        !kept.has(index) && INVISIBLE.test(character) && !isWriting(points, index));
}

function hasEdgeSpace(component) {
    return component.startsWith(SPACE) || component.endsWith(SPACE);
}

function escaped(character, hidden) {
    if (character === QUOTE || character === BACKSLASH) {
        return `${BACKSLASH}${character}`;
    }

    return hidden
        ? `\\u{${character.codePointAt(0).toString(HEX).toUpperCase().padStart(CODE_DIGITS, "0")}}`
        : character;
}

function present(text, components) {
    const hidden = hiddenMarks(text);

    if (!text.startsWith(QUOTE) && !hidden.includes(true) && !components.some(hasEdgeSpace)) {
        return text;
    }

    return `${QUOTE}${[...text].map((character, index) => escaped(character, hidden[index])).join("")}${QUOTE}`;
}

function presentName(name) {
    return present(name, [name]);
}

function presentPath(path) {
    return present(path, path.split("/"));
}

// A folder's name and the folder it is in, each ready to show.
function presentLocation(path) {
    return { name: presentName(path.slice(path.lastIndexOf("/") + 1)), parent: presentPath(parentPath(path)) };
}

module.exports = { presentName, presentPath, presentLocation };
