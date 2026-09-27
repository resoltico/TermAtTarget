"use strict";

/*
 * An alias or a symbolic link opens where it sits, or has the file and folder
 * rules applied to what it points at. Opening where it sits never touches the
 * target, so a link whose target is gone still opens.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { destination } = require("../../../src/core/plan.js");
const { fixture, calls, DEFAULTS } = require("../../helpers.cjs");

const directory = { kind: "directory" };
const file = { kind: "file" };
const alias = (target) => ({ kind: "alias", target });
const configured = (folder, link) => ({ defaultFolderAction: folder, defaultLinkAction: link });
const selected = (path) => ({ path, slashed: false });

function untouchable(kind) {
    return fixture({ "/work/broken": { kind } }, {
        resolveAlias() {
            throw new Error("target must not be touched");
        },
        readLink() {
            throw new Error("target must not be touched");
        }
    });
}

test("LINK opens the folder the link sits in, without reading its target", () => {
    for (const kind of ["alias", "symlink"]) {
        const io = untouchable(kind);

        assert.equal(destination(selected("/work/broken"), configured("INSIDE", "LINK"), io), "/work", kind);
        assert.deepEqual(calls(io), ["inspect"], kind);
    }
});

test("asked, the answer LINK does the same, and the question names the kind", () => {
    for (const kind of ["alias", "symlink"]) {
        const io = untouchable(kind);

        io.chooseLink = (path, asked) => {
            assert.deepEqual([path, asked], ["/work/broken", kind]);
            return "LINK";
        };
        assert.equal(destination(selected("/work/broken"), DEFAULTS, io), "/work", kind);
    }
});

test("an answer that is neither target nor link location is refused", () => {
    for (const kind of ["alias", "symlink"]) {
        const io = fixture({ "/work/link": { kind } }, { chooseLink: () => "invalid" });

        assert.throws(() => destination(selected("/work/link"), DEFAULTS, io), /^Error: Invalid link-location choice\.$/u, kind);
    }
});

test("TARGET applies the folder policy to what the link points at", () => {
    const io = fixture({ "/work/a": alias("/target"), "/target": directory });

    assert.equal(destination(selected("/work/a"), configured("INSIDE", "TARGET"), io), "/target");
    assert.equal(destination(selected("/work/a"), configured("LEVEL", "TARGET"), io), "/");
});

test("TARGET at a file opens the file's folder, and asks only about the link", () => {
    const io = fixture({ "/work/b": alias("/target/file"), "/target": directory, "/target/file": file });

    assert.equal(destination(selected("/work/b"), DEFAULTS, io), "/target");
    assert.equal(calls(io).filter((name) => name === "chooseLink").length, 1);
    assert.equal(calls(io).includes("chooseFolderMode"), false);
});

test("a folder reached through a link is asked about as where that link points", () => {
    for (const kind of ["alias", "symlink"]) {
        const io = fixture({ "/work/a": { kind, target: "/target" }, "/target": directory });

        destination(selected("/work/a"), DEFAULTS, io);
        assert.deepEqual(io.events.at(-1), ["chooseFolderMode", "/target", kind], kind);
    }
});

test("a link to the root opens the root without a folder question", () => {
    const io = fixture({ "/work/a": alias("/") });

    assert.equal(destination(selected("/work/a"), DEFAULTS, io), "/");
    assert.equal(calls(io).includes("chooseFolderMode"), false);
});
