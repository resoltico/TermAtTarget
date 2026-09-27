import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { root } from "../repository.mjs";
import { checkBoundaries } from "./boundary-rules.mjs";
import { checkExecutables } from "./executable-rules.mjs";

export { executablePathsIn } from "./executable-rules.mjs";

/*
 * Characters that are invisible, or that move or hide the text around them,
 * by Unicode's own properties: controls other than tab, line feed and
 * carriage return (each dealt with by the whitespace rules), line and
 * paragraph separators, whitespace other than those and a plain space, and
 * every default-ignorable code point -- soft hyphens, zero-width and direction
 * marks, fillers, tags and selectors. In source they are how text that reads
 * one way compiles another, so each must be written as an escape.
 */
const CONTROL_CHARACTERS = /(?![\t\n\r])[\p{Cc}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]|[^\S \t\n\r]/u;

/*
 * No file may grow back into a god file. The threshold sits close to the
 * largest current module, so growth is a decision rather than a drift.
 */
export const MAXIMUM_FILE_LINES = 150;
const HEX_RADIX = 16;
const CODE_POINT_DIGITS = 4;

// Where the first invisible or control character is, if there is one.
export function hiddenCharacterIn(content) {
    const found = CONTROL_CHARACTERS.exec(content);

    if (!found) {
        return null;
    }

    return {
        line: content.slice(0, found.index).split("\n").length,
        code: `U+${found[0].codePointAt(0).toString(HEX_RADIX).toUpperCase().padStart(CODE_POINT_DIGITS, "0")}`
    };
}

function checkControlCharacters(relativePath, content) {
    /*
     * The release is distributed by copy and paste into the Shortcuts editor,
     * so such a character would be invisible here and corrupting or
     * misleading there. They must be written as escapes.
     */
    const hidden = hiddenCharacterIn(content);

    if (hidden !== null) {
        throw new Error(
            `${relativePath}:${hidden.line}: literal invisible or control character ` +
            `${hidden.code}; write it as an escape instead`
        );
    }
}

export function checkSize(relativePath, content) {
    const lines = content.split("\n").length - 1;

    if (lines > MAXIMUM_FILE_LINES) {
        throw new Error(
            `${relativePath}: ${lines} lines exceeds the ` +
            `${MAXIMUM_FILE_LINES}-line limit; split it rather than raising ` +
            "the limit"
        );
    }
}

function checkWhitespace(relativePath, content) {
    if (!content.endsWith("\n")) {
        throw new Error(`${relativePath}: missing final newline`);
    }

    if (/[ \t]+$/mu.test(content)) {
        throw new Error(`${relativePath}: trailing whitespace`);
    }

    if (content.includes("\r")) {
        throw new Error(`${relativePath}: CR characters are forbidden`);
    }
}

export function checkContent(relativePath, content) {
    checkWhitespace(relativePath, content);
    checkControlCharacters(relativePath, content);
    checkExecutables(relativePath, content);
    checkBoundaries(relativePath, content);
    checkSize(relativePath, content);
}

/*
 * How Node is asked to parse a file. A .jxa file has an extension Node
 * refuses to guess at, so its text is handed over as a script instead: the
 * form osascript itself reads it in.
 */
export function syntaxCheck(absolute, content) {
    if (absolute.endsWith(".jxa")) {
        return [
            ["--check", "--input-type=commonjs"],
            { input: content, stdio: ["pipe", "inherit", "inherit"] }
        ];
    }

    return [["--check", absolute], { stdio: "inherit" }];
}

/*
 * Parsed by the same Node that will parse it in anger, then read as text for
 * the structural rules. Both halves address the same file: checking one path
 * and reading another would pass a file nobody looked at.
 */
export async function checkSourceFile(
    relativePath,
    exec = execFileSync,
    read = readFile
) {
    const absolute = path.join(root, relativePath);
    const content = await read(absolute, "utf8");

    exec(process.execPath, ...syntaxCheck(absolute, content));

    checkContent(relativePath, content);
}
