/*
 * The name presentation as osascript's engine runs it, against Node's. The
 * rule relies on Unicode properties and on each engine's own set of
 * recommended emoji; the names here are the ones where a difference would
 * show.
 */
import { createRequire } from "node:module";
import { EXPECTED, NAMES } from "./presentation-corpus.mjs";

const require = createRequire(import.meta.url);
const { presentName } = require("../../src/core/present.js");
function checkExpected(invoke) {
    const inputs = EXPECTED.map(([name]) => name);
    const native = invoke("present", JSON.stringify(inputs));

    for (const [index, [name, expected]] of EXPECTED.entries()) {
        if (native[index] !== expected || presentName(name) !== expected) {
            throw new Error(`Unexpected rendered name for ${JSON.stringify(name)}. Expected ${JSON.stringify(expected)}.`);
        }
    }
}

export function checkPresentation(invoke) {
    const native = invoke("present", JSON.stringify(NAMES));
    const node = NAMES.map(presentName);
    const differ = NAMES.filter((name, index) => native[index] !== node[index]);

    if (differ.length > 0) {
        throw new Error(`osascript's engine presents names differently from Node's: ${JSON.stringify(differ)}`);
    }

    console.log(`PASS: ${NAMES.length} names presented identically by osascript's engine and Node's.`);

    checkExpected(invoke);
    console.log(`PASS: ${EXPECTED.length} names match the expected display in each engine.`);

    return {
        paritySamples: native.length,
        expectedSamples: EXPECTED.length,
        parityInputs: NAMES,
        expectedInputs: EXPECTED.map(([input]) => input)
    };
}
