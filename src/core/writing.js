"use strict";

const sets = require("./unicode-sets.js");

/*
 * Whether an invisible character is part of how visible text is written, by
 * published standards only -- each exception below cites the one it follows.
 * Anything not covered is shown escaped by src/core/present.js.
 *
 * - Emoji: the engine's own set of recommended emoji (\p{RGI_Emoji}, the
 *   `v` flag), which knows a joined emoji from two emoji with a joiner
 *   between them, and a valid flag's tags from any others. Built from a string
 *   inside try/catch, so an engine without it still parses this file and
 *   simply keeps no emoji exception: every invisible character is shown.
 * - Variation selectors: a base and selector listed in the Unicode 17 emoji
 *   variation sequences or standardized variants; or, after a Han ideograph,
 *   an ideographic variation selector. The IVD registry is not embedded (it
 *   is too large to paste), so an unregistered one there is the one unchecked
 *   case.
 * - Joiners: RFC 5892 Appendix A (CONTEXTJ, as IDNA uses it) -- a joiner or
 *   non-joiner directly after a virama; or a non-joiner between a character
 *   that joins to the left and one that joins to the right, with only
 *   transparent characters (combining marks, mostly) in between.
 */

const RGI_EMOJI = String.raw`\p{RGI_Emoji}`;
const ZWNJ = 0x200C;
const ZWJ = 0x200D;
// The ideographic variation selectors are every variation selector from here on.
const IVS_FIRST = 0xE0100;
const HAN = /\p{Script=Han}/u;
const SELECTOR = /\p{Variation_Selector}/u;

// The engine's recommended-emoji pattern, or null where the engine has none.
function emojiMatcher(Pattern = RegExp) {
    try {
        return new Pattern(RGI_EMOJI, "gv");
    } catch {
        return null;
    }
}

// Positions (in code points) inside a recommended emoji, found by `matcher`.
function emojiPositions(characters, matcher) {
    const kept = new Set();

    if (matcher === null) {
        return kept;
    }

    const text = characters.join("");

    for (const match of text.matchAll(matcher)) {
        const start = [...text.slice(0, match.index)].length;

        [...match[0]].forEach((unused, offset) => kept.add(start + offset));
    }

    return kept;
}

// The nearest code point from `index` in `step` direction that is not
// transparent, or undefined past either end of the text.
function beyondTransparent(points, index, step) {
    let at = index + step;

    while (sets.isTransparent(points[at])) {
        at += step;
    }

    return points[at];
}

function joinerAllowed(points, index) {
    if (sets.isVirama(points[index - 1])) {
        return true;
    }

    if (points[index] !== ZWNJ) {
        return false;
    }

    const left = beyondTransparent(points, index, -1);
    const right = beyondTransparent(points, index, 1);

    return sets.joinsLeft(left) && sets.joinsRight(right);
}

// Whether a code point is a Han ideograph; nothing past the text's start is.
function isHan(point) {
    return Number.isInteger(point) && HAN.test(String.fromCodePoint(point));
}

// The base is undefined for a selector at the very start, and defines nothing.
function selectorAllowed(points, index) {
    const [base, selector] = [points[index - 1], points[index]];

    return selector >= IVS_FIRST ? isHan(base) : sets.isDefinedVariation(base, selector);
}

function isWriting(points, index) {
    const point = points[index];

    if (point === ZWJ || point === ZWNJ) {
        return joinerAllowed(points, index);
    }

    return SELECTOR.test(String.fromCodePoint(point)) && selectorAllowed(points, index);
}

module.exports = { emojiMatcher, emojiPositions, isWriting };
