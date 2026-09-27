import { hiddenCharacterIn } from "./source-rules.mjs";

/*
 * The hygiene every document is held to, Markdown or not: no trailing
 * whitespace, no carriage return, a final newline, and no character that is
 * invisible or moves the text around it -- the same rule the source is held
 * to, since INSTALL.txt and LICENSE go out with the release too.
 */
export function assertClean(file, text) {
    if (/[ \t]+$/mu.test(text)) {
        throw new Error(`${file}: has trailing whitespace`);
    }

    if (text.includes("\r")) {
        throw new Error(`${file}: has a carriage return`);
    }

    if (!text.endsWith("\n")) {
        throw new Error(`${file}: does not end with a newline`);
    }

    const hidden = hiddenCharacterIn(text);

    if (hidden !== null) {
        throw new Error(`${file}:${hidden.line}: has an invisible or control character, ${hidden.code}`);
    }
}
