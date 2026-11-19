"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { destination } = require("../../../src/core/plan.js");
const { fixture, calls, asked, DEFAULTS } = require("../../helpers.cjs");

/*
 * Where the terminal app opens for a file or a folder: a file's own folder, and a
 * folder either inside or at its parent, as configured or as asked.
 */

const directory = { kind: "directory" };
const file = { kind: "file" };
const folderAction = (folder) => ({ ...DEFAULTS, folder, link: "follow" });
const selected = (path, slashed = false) => ({ path, slashed });
// The plan asks the filesystem and the person through one fixture.
const ports = (io) => [io, io];

test("a file opens its containing folder, without asking anything", () => {
    const io = fixture({ "/work/file": file });

    assert.equal(destination(selected("/work/file"), DEFAULTS, ...ports(io)), "/work");
    assert.deepEqual(calls(io), ["inspect"]);
});

test("a folder opens inside or at its parent as configured, without asking", () => {
    assert.equal(destination(selected("/work"), folderAction("inside"), ...ports(fixture())), "/work");
    assert.equal(destination(selected("/work"), folderAction("parent"), ...ports(fixture())), "/");

    const io = fixture();

    destination(selected("/work"), folderAction("parent"), ...ports(io));
    assert.deepEqual(calls(io), ["inspect"]);
});

test("the root is opened without a question, since inside and parent are the same place", () => {
    for (const config of [DEFAULTS, folderAction("parent"), folderAction("inside")]) {
        const io = fixture();

        assert.equal(destination(selected("/"), config, ...ports(io)), "/");
        assert.deepEqual(calls(io), ["inspect"]);
    }
});

test("asked, the answer decides, and the question says the folder was selected", () => {
    const io = fixture();

    assert.equal(destination(selected("/work"), DEFAULTS, ...ports(io)), "/work");
    assert.deepEqual(asked(io, "folder")[0], {
        id: "folder", params: { terminal: "Terminal", via: null, subject: "folder", name: "work", parent: "/" },
        answers: ["parent", "inside"], usual: "inside"
    });

    io.ask = () => "parent";
    assert.equal(destination(selected("/work"), DEFAULTS, ...ports(io)), "/");
});

test("an answer that is neither inside nor parent is refused", () => {
    const io = fixture({}, { ask: () => "bad" });

    assert.throws(() => destination(selected("/work"), DEFAULTS, ...ports(io)), { kind: "invalidAnswer", params: { question: "folder" } });
});

test("choosing a folder opens inside it, even when folders open at their parent", () => {
    const io = fixture();

    assert.equal(destination(null, folderAction("parent"), ...ports(io)), "/work");
    assert.deepEqual(calls(io), ["chooseFolder", "path"]);
});

test("the chosen folder is held to the path rules", () => {
    const io = fixture({}, { chooseFolder: () => "relative" });

    assert.throws(() => destination(null, DEFAULTS, ...ports(io)), { kind: "pathRelative", params: {} });
});

test("a kind that is neither file, folder, alias nor link is refused", () => {
    const io = fixture({ "/odd": { kind: "unknown" } });

    assert.throws(() => destination(selected("/odd"), DEFAULTS, ...ports(io)), { kind: "unknownItemKind", params: { path: "/odd" } });
});

test("a missing item is reported as missing", () => {
    assert.throws(() => destination(selected("/missing"), DEFAULTS, ...ports(fixture())), /^Error: No such item: \/missing$/u);
});

test("without a slash, a file is a file", () => {
    assert.equal(destination(selected("/work/file"), DEFAULTS, ...ports(fixture({ "/work/file": file }))), "/work");
    assert.equal(destination(selected("/work", false), folderAction("inside"), ...ports(fixture({ "/work": directory }))), "/work");
});

test("the filesystem is asked through files, and the person through ask", () => {
    const fs = fixture({ "/work/a": { kind: "alias", target: "/work" } });
    const person = fixture();

    assert.equal(destination(selected("/work/a"), DEFAULTS, fs, person), "/work");
    assert.deepEqual(calls(fs), ["inspect", "inspect", "resolveAlias", "inspect"]);
    assert.deepEqual(calls(person), ["ask:link", "ask:folder"]);
});

/*
 * An alias or a symbolic link opens where it sits, or has the file and folder
 * rules applied to what it points at. Opening where it sits never touches the
 * target, so a link whose target is gone still opens.
 */

const alias = (target) => ({ kind: "alias", target });
const configured = (folder, link) => ({ ...DEFAULTS, folder, link });

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

test("stay opens the folder the link sits in, without reading its target", () => {
    for (const kind of ["alias", "symlink"]) {
        const io = untouchable(kind);

        assert.equal(destination(selected("/work/broken"), configured("inside", "stay"), io, io), "/work", kind);
        assert.deepEqual(calls(io), ["inspect"], kind);
    }
});

test("asked, the answer stay does the same, and the question names the kind", () => {
    for (const kind of ["alias", "symlink"]) {
        const io = untouchable(kind);

        io.ask = (question) => {
            assert.equal(question.id, "link");
            assert.deepEqual(question.params, { via: kind, terminal: "Terminal", name: "broken", parent: "/work" });
            return "stay";
        };
        assert.equal(destination(selected("/work/broken"), DEFAULTS, io, io), "/work", kind);
    }
});

test("an answer that is neither target nor link location is refused", () => {
    for (const kind of ["alias", "symlink"]) {
        const io = fixture({ "/work/link": { kind } }, { ask: () => "invalid" });

        assert.throws(() => destination(selected("/work/link"), DEFAULTS, io, io), { kind: "invalidAnswer", params: { question: "link" } }, kind);
    }
});

test("follow applies the folder policy to what the link points at", () => {
    const io = fixture({ "/work/a": alias("/target"), "/target": directory });

    assert.equal(destination(selected("/work/a"), configured("inside", "follow"), io, io), "/target");
    assert.equal(destination(selected("/work/a"), configured("parent", "follow"), io, io), "/");
});

test("follow at a file opens the file's folder, and asks only about the link", () => {
    const io = fixture({ "/work/b": alias("/target/file"), "/target": directory, "/target/file": file });

    assert.equal(destination(selected("/work/b"), DEFAULTS, io, io), "/target");
    assert.equal(calls(io).filter((name) => name === "ask:link").length, 1);
    assert.equal(calls(io).includes("ask:folder"), false);
});

test("a folder reached through a link is asked about as where that link points", () => {
    for (const kind of ["alias", "symlink"]) {
        const io = fixture({ "/work/a": { kind, target: "/target" }, "/target": directory });

        destination(selected("/work/a"), DEFAULTS, io, io);
        assert.equal(asked(io, "folder")[0].params.via, kind);
    }
});

test("a link to the root opens the root without a folder question", () => {
    const io = fixture({ "/work/a": alias("/") });

    assert.equal(destination(selected("/work/a"), DEFAULTS, io, io), "/");
    assert.equal(calls(io).includes("ask:folder"), false);
});

/*
 * What a trailing slash asks of a selection: that the name is not a file.
 * After a symbolic link it is a statement about where the link leads, as it
 * is to the filesystem, so the link is followed to check it.
 */

// The plan asks the filesystem and the person through one fixture.

test("a path that ended in / cannot name a file or a Finder alias", () => {
    for (const kind of ["file", "alias"]) {
        const io = fixture({ "/work/item": { kind } });

        assert.throws(
            () => destination(selected("/work/item", true), DEFAULTS, io, io),
            { kind: "slashedFile", params: { path: "/work/item/" } },
            kind
        );
        assert.deepEqual(calls(io), ["inspect"], `${kind}: nothing asked, nothing followed`);
    }
});

test("a path that ended in / may name a folder, or a link that leads to one", () => {
    // Foundation spells a URL for a link to a folder with a slash too.
    assert.equal(destination(selected("/work", true), folderAction("inside"), ...ports(fixture())), "/work");

    const io = fixture({ "/work/link": { kind: "symlink", target: "/work" } });

    assert.equal(destination(selected("/work/link", true), folderAction("inside"), io, io), "/work");
});

const LEADS_TO_FILE = { kind: "slashedLinkToFile", params: { path: "/folder/linkfile/" } };

test("a slashed link that leads to a file is refused, whichever way it would open", () => {
    // The slash is a statement about where the link leads, as it is to the
    // filesystem, so it is checked before the link question is asked.
    for (const link of ["follow", "stay", "ask"]) {
        const io = fixture({ "/folder": directory, "/folder/file": file, "/folder/linkfile": { kind: "symlink", target: "/folder/file" } });

        assert.throws(
            () => destination(selected("/folder/linkfile", true), { ...DEFAULTS, folder: "inside", link }, io, io),
            LEADS_TO_FILE,
            link
        );
        assert.equal(calls(io).includes("ask:link"), false, link);
    }
});

test("a slashed link that leads nowhere is refused as missing", () => {
    const io = fixture({ "/folder": directory, "/folder/gone": { kind: "symlink", target: "/folder/missing" } });

    assert.throws(() => destination(selected("/folder/gone", true), DEFAULTS, io, io), /^Error: No such item: \/folder\/missing$/u);
});

test("a slashed link to a folder is followed once, and then asked about as usual", () => {
    const io = fixture({ "/work/link": { kind: "symlink", target: "/target" }, "/target": directory });

    assert.equal(destination(selected("/work/link", true), DEFAULTS, io, io), "/target");
    assert.equal(calls(io).filter((name) => name === "readLink").length, 1, "read once, for the check and the answer");
    assert.deepEqual(calls(io).filter((name) => name.startsWith("ask:")), ["ask:link", "ask:folder"]);
});

test("a slashed link to a folder may still open where the link sits", () => {
    const io = fixture({ "/work/link": { kind: "symlink", target: "/target" }, "/target": directory }, {
        ask: () => "stay"
    });

    assert.equal(destination(selected("/work/link", true), DEFAULTS, io, io), "/work");
});

test("without a slash, a link to a file or to nothing is not followed unless chosen", () => {
    const io = fixture({ "/work/gone": { kind: "symlink", target: "/missing" } }, { ask: () => "stay" });

    assert.equal(destination(selected("/work/gone"), DEFAULTS, io, io), "/work");
    assert.equal(calls(io).includes("readLink"), false);
});

test("a slashed link that leads to a Finder alias is refused, as the alias itself would be", () => {
    // An alias is a file to the filesystem, even one that points at a folder.
    const io = fixture({
        "/w": directory,
        "/w/link": { kind: "symlink", target: "/w/alias" },
        "/w/alias": { kind: "alias", target: "/target" },
        "/target": directory
    });

    assert.throws(
        () => destination(selected("/w/link", true), folderAction("inside"), io, io),
        { kind: "slashedLinkToFile", params: { path: "/w/link/" } }
    );
    assert.equal(calls(io).includes("resolveAlias"), false, "the alias is not followed");
});

test("a slashed chain of links is followed in order to the folder at its end", () => {
    const io = fixture({
        "/w": directory,
        "/w/a": { kind: "symlink", target: "b" },
        "/w/b": { kind: "symlink", target: "/target" },
        "/target": directory
    });

    assert.equal(destination(selected("/w/a", true), folderAction("inside"), io, io), "/target");
});

test("a slashed link in a cycle is refused as a cycle", () => {
    const io = fixture({ "/w": directory, "/w/loop": { kind: "symlink", target: "/w/loop" } });

    assert.throws(() => destination(selected("/w/loop", true), DEFAULTS, io, io), { kind: "tooManyLinks", params: { path: "/w/loop" } });
});
