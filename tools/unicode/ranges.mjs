/*
 * A set of code points written as ranges, shortest first: each range is the
 * gap since the end of the previous one and its length beyond one, in base
 * 36, joined by commas -- "4.2" is a gap of 4 and three code points. The
 * decoder is src/core/unicode-sets.js; the two are tested against each other.
 */

const BASE = 36;

// Sorted, with overlapping and adjacent ranges merged.
export function normalise(ranges) {
    const merged = [];

    for (const range of [...ranges].sort((left, right) => left.first - right.first)) {
        const last = merged.at(-1);

        if (last && range.first <= last.last + 1) {
            last.last = Math.max(last.last, range.last);
        } else {
            merged.push({ ...range });
        }
    }

    return merged;
}

export function encodeRanges(ranges) {
    let previous = -1;

    return normalise(ranges).map(({ first, last }) => {
        const gap = (first - previous - 1).toString(BASE);
        const extra = last - first;

        previous = last;
        return extra === 0 ? gap : `${gap}.${extra.toString(BASE)}`;
    }).join(",");
}
