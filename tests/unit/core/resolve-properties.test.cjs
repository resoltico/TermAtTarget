"use strict";

/*
 * Following links, for every shape of chain.
 *
 * Every filesystem here is built so the answer is known before resolution
 * runs: a chain ending at a directory named in advance, a cycle of a chosen
 * length, a link whose target climbs out with "..". Nothing is checked by
 * resolving it a second way, which would agree with the code about a mistake.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const fc = require("fast-check");
const { physicalPath, resolveTarget, MAX_LINKS } = require("../../../src/core/resolve.js");
const { fixture } = require("../../helpers.cjs");

const directory = { kind: "directory" };
const link = (target) => ({ kind: "symlink", target });
const alias = (target) => ({ kind: "alias", target });

/*
 * A name for a fake filesystem entry: any text, with the two characters a name
 * cannot hold mapped away, and a leading letter so it is never "." or "..".
 */
const NAME = fc.string({ unit: "binary", minLength: 1 })
    .map((text) => `n${text.replaceAll("/", "∕").replaceAll("\0", "␀")}`);

function names(count) {
    return fc.uniqueArray(NAME, { minLength: count, maxLength: count });
}

// /first -> /second -> ... -> /goal, as symbolic links.
function linkChain(entries) {
    const [goal, ...links] = entries;
    const items = { [`/${goal}`]: directory };

    links.forEach((name, index) => {
        items[`/${name}`] = link(`/${index === 0 ? goal : links[index - 1]}`);
    });

    return { items, start: `/${links.at(-1)}`, goal: `/${goal}` };
}

test("a chain of links within the budget reaches the directory it ends at", () => {
    const CHAIN = fc.integer({ min: 1, max: MAX_LINKS }).chain((length) => names(length + 1));

    fc.assert(fc.property(CHAIN, (entries) => {
        const { items, start, goal } = linkChain(entries);

        assert.deepEqual(resolveTarget(start, fixture(items)), { path: goal, facts: directory });
    }));
});

test("one link past the budget is refused, however the chain is named", () => {
    // Exactly at the boundary: MAX_LINKS links resolve, and one more does not.
    fc.assert(fc.property(names(MAX_LINKS + 2), (entries) => {
        const { items, start } = linkChain(entries);

        assert.throws(() => resolveTarget(start, fixture(items)), /Too many/u);
    }));
});

test("an alias cycle of any length is refused as a cycle, before the budget", () => {
    // Aliases resolve one hop at a time, so a cycle of them is caught by the
    // revisit itself -- with its own message, long before the budget runs out.
    const CYCLE = fc.integer({ min: 1, max: 12 }).chain((length) => names(length));

    fc.assert(fc.property(CYCLE, (ring) => {
        const items = {};

        ring.forEach((name, index) => {
            items[`/${name}`] = alias(`/${ring[(index + 1) % ring.length]}`);
        });

        assert.throws(() => resolveTarget(`/${ring[0]}`, fixture(items)), /A link cycle was found/u);
    }));
});

test("a link partway through a path is followed before '..' is applied", () => {
    // /base/hop/../end, where hop -> /far/deep. In filesystem order the '..'
    // climbs out of /far/deep, so the answer is /far/end, not /base/end.
    fc.assert(fc.property(names(5), ([base, hop, far, deep, end]) => {
        const io = fixture({
            [`/${base}`]: directory,
            [`/${base}/${hop}`]: link(`/${far}/${deep}`),
            [`/${far}`]: directory,
            [`/${far}/${deep}`]: directory,
            [`/${far}/${end}`]: directory
        });

        assert.equal(physicalPath(`/${base}/${hop}/../${end}`, io, { links: 0 }), `/${far}/${end}`);
    }));
});

test("a relative link target is read from the link's own folder", () => {
    // Two folders deep, so that "../" climbs to a folder and not to the root:
    // from the root, "../x" and "x" both land at /x, and a target read from
    // the wrong folder would look right.
    fc.assert(fc.property(names(5), fc.boolean(), ([top, folder, name, sibling, beside], climbs) => {
        const io = fixture({
            [`/${top}`]: directory,
            [`/${top}/${folder}`]: directory,
            [`/${top}/${folder}/${name}`]: link(climbs ? `../${sibling}` : beside),
            [`/${top}/${sibling}`]: directory,
            [`/${top}/${folder}/${beside}`]: directory
        });
        const expected = climbs ? `/${top}/${sibling}` : `/${top}/${folder}/${beside}`;

        assert.deepEqual(resolveTarget(`/${top}/${folder}/${name}`, io), { path: expected, facts: directory });
    }));
});
