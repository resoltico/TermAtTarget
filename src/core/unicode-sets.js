"use strict";

const tables = require("./unicode-tables.js");

/*
 * The Unicode tables, decoded once into sorted code point ranges and asked
 * with a binary search. Each table is written as ranges: the gap since the end
 * of the previous range and the range's length beyond one, in base 36, joined
 * by commas (tools/unicode/ranges.mjs writes them; the two are tested against
 * each other and against the source files).
 */

const BASE = 36;
const HEX = 16;
const HALVES = 2;

function decode(encoded) {
    let previous = -1;

    return encoded === "" ? [] : encoded.split(",").map((token) => {
        const [gap, extra = "0"] = token.split(".");
        const first = previous + 1 + Number.parseInt(gap, BASE);

        previous = first + Number.parseInt(extra, BASE);
        return [first, previous];
    });
}

function search(ranges, point) {
    let low = 0;
    let high = ranges.length - 1;

    while (low <= high) {
        const middle = Math.floor((low + high) / HALVES);
        const [first, last] = ranges[middle];

        if (point < first) {
            high = middle - 1;
        } else if (point > last) {
            low = middle + 1;
        } else {
            return true;
        }
    }

    return false;
}

// Whether a code point is in the ranges. Anything that is not one -- a
// position past either end of the text reads as undefined -- is in none.
function contains(ranges, point) {
    return Number.isInteger(point) && search(ranges, point);
}

const JOINING_LEFT = decode(tables.JOINING_LEFT);
const JOINING_RIGHT = decode(tables.JOINING_RIGHT);
const TRANSPARENT = decode(tables.TRANSPARENT);
const VIRAMA = decode(tables.VIRAMA);
const SELECTOR_BASES = new Map(Object.entries(tables.SELECTORS)
    .map(([selector, bases]) => [Number.parseInt(selector, HEX), decode(bases)]));

module.exports = {
    decode,
    contains,
    joinsLeft: (point) => contains(JOINING_LEFT, point),
    joinsRight: (point) => contains(JOINING_RIGHT, point),
    isTransparent: (point) => contains(TRANSPARENT, point),
    isVirama: (point) => contains(VIRAMA, point),
    // Whether `base` followed by `selector` is a defined variation sequence.
    isDefinedVariation: (base, selector) => contains(SELECTOR_BASES.get(selector) ?? [], base),
    UNICODE_VERSION: tables.UNICODE_VERSION
};
