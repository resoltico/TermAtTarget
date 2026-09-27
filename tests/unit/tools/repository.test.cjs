"use strict";

/*
 * What the repository says about itself, and what is in it: the files a
 * source archive holds, with the toolchain's output left out and a symbolic
 * link refused.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { mkdtemp, mkdir, writeFile, symlink, rm } = require("node:fs/promises");
const path = require("node:path");
const { tmpdir } = require("node:os");
const { execFileSync } = require("node:child_process");

const load = () => import("../../../tools/repository.mjs");

async function tree(files, links = []) {
    const base = await mkdtemp(path.join(tmpdir(), "term-at-target-tree-"));

    test.after(() => rm(base, { recursive: true, force: true }));

    await Promise.all(Object.entries(files).map(async ([relative, content]) => {
        await mkdir(path.dirname(path.join(base, relative)), { recursive: true });
        await writeFile(path.join(base, relative), content);
    }));

    await Promise.all(links.map(([name, target]) => symlink(target, path.join(base, name))));

    return base;
}

test("every file is found, sorted, and what the toolchain writes is left out", async () => {
    const { filesBelow } = await load();
    const base = await tree({
        "b.txt": "",
        "a/z.js": "",
        "a/b/c.md": "",
        ".github/w.yml": "",
        "node_modules/x/index.js": "",
        "reports/r.json": "",
        "artifacts/a.tar.gz": "",
        ".stryker-tmp/copy.js": "",
        ".git/HEAD": "",
        "a/.DS_Store": ""
    });

    assert.deepEqual(await filesBelow("", base), [".github/w.yml", "a/b/c.md", "a/z.js", "b.txt"]);
    assert.deepEqual(await filesBelow("a", base), ["a/b/c.md", "a/z.js"]);
});

test("a symbolic link is refused rather than archived", async () => {
    const { filesBelow } = await load();
    const base = await tree({ "real.txt": "" }, [["link.txt", "real.txt"]]);

    await assert.rejects(filesBelow("", base), /^Error: Repository sources may not contain symlinks: link\.txt$/u);
});

test("anything that is neither file, folder nor link is refused", async () => {
    // A named pipe cannot be archived as a file, and silently leaving it out
    // would make the archive differ from the tree without saying so.
    const { filesBelow } = await load();
    const base = await tree({ "real.txt": "" });

    execFileSync("mkfifo", [path.join(base, "pipe")]);
    await assert.rejects(filesBelow("", base), /^Error: Unsupported repository entry: pipe$/u);
});

test("metadata is the package's own section, with its version and licence", async () => {
    const { metadata } = await load();
    const base = await tree({
        "package.json": JSON.stringify({ version: "1.2.3-rc.1", license: "MIT", termAtTarget: { title: "T" } })
    });

    assert.deepEqual(await metadata(base), { title: "T", version: "1.2.3-rc.1", license: "MIT" });
});

test("a version that is not a release version is refused", async () => {
    const { metadata } = await load();

    await Promise.all(["1.2", "v1.2.3", "1.2.3 ", "1.2.3-", undefined].map(async (version) => {
        const base = await tree({ "package.json": JSON.stringify({ version }) });

        await assert.rejects(metadata(base), /^Error: package\.json must provide a valid release version\.$/u, String(version));
    }));
});

test("a file is read as text, relative to the base", async () => {
    const { read, root } = await load();
    const base = await tree({ "dir/file.txt": "text\n" });

    assert.equal(await read("dir/file.txt", base), "text\n");
    assert.equal(root, `${path.resolve(__dirname, "../../..")}${path.sep}`);
});
