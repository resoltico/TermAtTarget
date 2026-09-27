/*
 * The source archive: every file in the repository that is source, under one
 * versioned folder, dated to the release rather than to the moment it was
 * built. SOURCE_DATE_EPOCH overrides the date, as reproducible builds expect.
 */
import path from "node:path";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { filesBelow, root, metadata, read } from "./repository.mjs";
import { checkDist } from "./dist.mjs";
import { extractNotes, releaseDate } from "./notes.mjs";
import { archiveOf } from "./archive.mjs";
import { digestOf } from "./bundle.mjs";

const MILLISECONDS = 1000;

function epochOf(date, override) {
    const epoch = override === undefined ? Date.parse(`${date}T00:00:00Z`) / MILLISECONDS : Number(override);

    if (!Number.isSafeInteger(epoch) || epoch < 0) {
        throw new Error("SOURCE_DATE_EPOCH must be a nonnegative integer.");
    }

    return epoch;
}

await checkDist();

const meta = await metadata();
const notes = extractNotes(await read("CHANGELOG.md"), meta.version);
const epoch = epochOf(releaseDate(notes), process.env.SOURCE_DATE_EPOCH);
const top = `term-at-target-${meta.version}`;
const entries = await Promise.all((await filesBelow()).map(async (name) =>
    ({ name: `${top}/${name}`, bytes: await readFile(path.join(root, name)) })));
const archive = archiveOf(entries, epoch);
const filename = `${top}.tar.gz`;

await mkdir(path.join(root, "artifacts"), { recursive: true });
await writeFile(path.join(root, "artifacts", filename), archive);
await writeFile(path.join(root, "artifacts", `${filename}.sha256`), `${digestOf(archive)}  ${filename}\n`);
console.log(`${filename} — ${entries.length} files, ${archive.length} bytes`);
