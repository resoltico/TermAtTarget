/*
 * Writes src/core/unicode-tables.js from the Unicode data files in
 * tools/unicode/data/. Run after replacing them with a newer version's.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { root } from "../repository.mjs";
import { renderTables, TARGET, VERSION } from "./tables.mjs";

await writeFile(TARGET, await renderTables());
console.log(`Wrote ${path.relative(root, TARGET)} from Unicode ${VERSION}.`);
