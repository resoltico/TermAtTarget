/*
 * The name presentation as osascript's engine runs it, against Node's. The
 * rule relies on Unicode properties and on each engine's own set of
 * recommended emoji; the names here are the ones where a difference would
 * show.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { presentName } = require("../../src/core/present.js");
const cp = (...points) => String.fromCodePoint(...points);
const ZWJ = cp(0x200D);
const NAMES = [
    "Projects", `Work ${cp(0x1F469)}${ZWJ}${cp(0x1F4BB)}`, `${cp(0x1F468)}${ZWJ}${cp(0x1F469)}${ZWJ}${cp(0x1F467)}`,
    cp(0x1F1F1, 0x1F1FB), `1${cp(0xFE0F, 0x20E3)}`, cp(0x1F44D, 0x1F3FD),
    cp(0x1F3F4, 0xE0067, 0xE0062, 0xE0073, 0xE0063, 0xE0074, 0xE007F), cp(0x2764, 0xFE0E),
    cp(0x915, 0x94D, 0x200D, 0x937), cp(0x845B, 0xE0100), `pay${ZWJ}ments`, `pay${cp(0xAD)}ments`,
    `pay${cp(0x34F)}ments`, `a${cp(0x202E)}b`, `a${cp(0xA0)}b`, "a\nb", " edge", "\"quoted",
    cp(0x1F355, 0x200D, 0x1F436), cp(0x1F600, 0xE0061, 0xE0062, 0xE0063, 0xE007F), `1${cp(0xFE0F)}`, `#${cp(0xFE0E)}`,
    cp(0x628, 0x64E, 0x200C, 0x628), cp(0x645, 0x6CC, 0x200C, 0x62E, 0x648, 0x627, 0x647, 0x645), cp(0x627, 0x200C, 0x628),
    cp(0x628, 0xFE00), cp(0x2229, 0xFE00), `a${cp(0xE0100)}`, cp(0x915, 0x94D, 0x200C, 0x937)
];

export function checkPresentation(invoke) {
    const native = invoke("present", JSON.stringify(NAMES));
    const node = NAMES.map(presentName);
    const differ = NAMES.filter((name, index) => native[index] !== node[index]);

    if (differ.length > 0) {
        throw new Error(`osascript's engine presents names differently from Node's: ${JSON.stringify(differ)}`);
    }

    console.log(`PASS: ${NAMES.length} names presented identically by osascript's engine and Node's.`);

    return native;
}
