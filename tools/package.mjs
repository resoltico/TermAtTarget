import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseMetadata, root } from "./repository.mjs";

const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
const commit = git(["rev-parse", "--verify", "HEAD^{commit}"]).trim();
const { version } = parseMetadata(git(["show", `${commit}:package.json`]));
const prefix = `term-at-target-${version}`;
const filename = `${prefix}.tar.gz`;
const directory = path.join(root, "artifacts");
const archive = path.join(directory, filename);

await mkdir(directory, { recursive: true });
git(["archive", "--format=tar.gz", "-9", `--prefix=${prefix}/`, "-o", archive, commit]);
const bytes = await readFile(archive);
const hash = createHash("sha256").update(bytes).digest("hex");
await writeFile(`${archive}.sha256`, `${hash}  ${filename}\n`);
console.log(`${filename} — ${bytes.length} bytes from ${commit}`);
