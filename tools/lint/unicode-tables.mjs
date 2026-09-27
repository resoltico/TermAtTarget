import { readFile } from "node:fs/promises";
import { renderTables, TARGET } from "../unicode/tables.mjs";

/*
 * src/core/unicode-tables.js is generated from the Unicode data files in
 * tools/unicode/data/, and must be exactly what they generate now: a table
 * edited by hand, or data updated without regenerating, fails here rather
 * than showing names by rules nobody can trace to a source.
 */
export async function checkUnicodeTables(render = renderTables, read = () => readFile(TARGET, "utf8")) {
    if (await read() !== await render()) {
        throw new Error("src/core/unicode-tables.js is not what tools/unicode/data generates; " +
            "run node tools/unicode/generate.mjs");
    }

    return "Unicode tables current";
}
