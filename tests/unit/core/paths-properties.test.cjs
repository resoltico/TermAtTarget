"use strict";

/*
 * What every path this can be given comes out as.
 *
 * Built from components with a known answer rather than generated whole and
 * checked against the same rules the code applies: a path assembled from
 * valid components must come back exactly as assembled, and so must its
 * percent-encoded file URL.
 *
 * A component is any text a filesystem name can hold -- every code point, in
 * every UTF-16 width, including quotes, $, backticks, newlines and emoji --
 * rather than a hand-picked alphabet. Only what POSIX forbids in a name is
 * kept out, and it is mapped away rather than filtered, so no input is thrown
 * away: "/" separates names, NUL ends them, and "." and ".." are not names.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const fc = require("fast-check");
const paths = require("../../../src/core/paths.js");

const ANY_NAME = fc.string({ unit: "binary", minLength: 1 });

/*
 * Names that look percent-encoded already -- a file literally named "50%41".
 * Random text almost never contains one, and a name that does is the only
 * kind decoding twice would change, so they are drawn on purpose.
 */
const PERCENT_NAME = fc.tuple(fc.string(), fc.stringMatching(/^%[0-9A-Fa-f]{2}$/u), fc.string())
    .map((parts) => parts.join(""));

// U+2215 DIVISION SLASH and U+2400 SYMBOL FOR NULL stand in for the two
// characters a name cannot hold, so no drawn input is discarded.
const COMPONENT = fc.oneof(ANY_NAME, PERCENT_NAME).map((text) => {
    const named = text.replaceAll("/", "∕").replaceAll("\0", "␀");

    return named === "." || named === ".." ? `${named}x` : named;
});
const COMPONENTS = fc.array(COMPONENT, { minLength: 1 });

function pathOf(components) {
    return `/${components.join("/")}`;
}

test("a path built from valid components comes back exactly as built", () => {
    fc.assert(fc.property(COMPONENTS, (components) => {
        assert.equal(paths.absolutePath(pathOf(components)), pathOf(components));
    }));
});

test("its file URL, percent-encoded, is decoded exactly once to the same path", () => {
    fc.assert(fc.property(COMPONENTS, (components) => {
        const url = `file:///${components.map(encodeURIComponent).join("/")}`;

        assert.equal(paths.absolutePath(url), pathOf(components));
    }));
});

test("a URL whose host is localhost is the same path", () => {
    fc.assert(fc.property(COMPONENTS, fc.constantFrom("localhost", "LOCALHOST", "LocalHost"),
        (components, host) => {
            const url = `file://${host}/${components.map(encodeURIComponent).join("/")}`;

            assert.equal(paths.absolutePath(url), pathOf(components));
        }));
});

test("the parent is every component but the last, and the root's parent is root", () => {
    fc.assert(fc.property(COMPONENTS, (components) => {
        assert.equal(paths.parentPath(pathOf(components)), pathOf(components.slice(0, -1)));
    }));
});

test("a displayed path reads back as the path it displays", () => {
    fc.assert(fc.property(COMPONENTS, (components) => {
        assert.equal(JSON.parse(paths.displayPath(pathOf(components))), pathOf(components));
    }));
});

test("a . or .. anywhere is refused, rather than resolved lexically", () => {
    // Resolving it lexically would open a different folder from the one a
    // symbolic link in the path would reach. Select the item itself instead.
    const WITH_DOTS = fc.tuple(fc.array(COMPONENT), fc.constantFrom(".", ".."), fc.array(COMPONENT))
        .map(([before, dots, after]) => pathOf([...before, dots, ...after]));

    fc.assert(fc.property(WITH_DOTS, (path) => {
        assert.throws(() => paths.absolutePath(path), /must not contain \. or \.\. path components/u);
    }));
});

test("an encoded separator in a file URL is refused, not decoded into a new folder", () => {
    const ENCODED_SLASH = fc.tuple(COMPONENTS, fc.constantFrom("%2F", "%2f"), COMPONENT)
        .map(([components, slash, last]) =>
            `file:///${components.map(encodeURIComponent).join("/")}${slash}${encodeURIComponent(last)}`);

    fc.assert(fc.property(ENCODED_SLASH, (url) => {
        assert.throws(() => paths.absolutePath(url), /encoded path separator/u);
    }));
});

test("a URL with any other host is refused", () => {
    const REMOTE = fc.domain().filter((host) => host.toLowerCase() !== "localhost");

    fc.assert(fc.property(REMOTE, COMPONENTS, (host, components) => {
        assert.throws(() => paths.absolutePath(`file://${host}/${components.join("/")}`),
            /without a remote host/u);
    }));
});

test("a lone surrogate anywhere is refused, since it is not text", () => {
    const LONE = fc.tuple(COMPONENTS, fc.integer({ min: 0xD800, max: 0xDFFF }))
        .map(([components, unit]) => `${pathOf(components)}${String.fromCharCode(unit)}`);

    fc.assert(fc.property(LONE, (path) => {
        assert.throws(() => paths.absolutePath(path), /nonempty Unicode text/u);
    }));
});
