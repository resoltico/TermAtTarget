import { createRequire } from "node:module";
import { readFromDisk } from "./consistency.mjs";

/*
 * The settings as the documents list them: README's table and INSTALL.txt's
 * Settings section must name every setting and every value in the words the
 * settings screen shows (src/runtime/settings-screen.js), and every terminal
 * app by its name (src/core/vocabulary.js). Those words are written once, in
 * the source; a setting or value added there without the documents fails here.
 */

const require = createRequire(import.meta.url);
const { SETTINGS: WORDS, VALUES } = require("../../src/runtime/settings-screen.js");
const { TERMINALS } = require("../../src/core/vocabulary.js");

// Each setting's label, and the labels of its values.
export function settingWords(words = WORDS, values = VALUES, terminals = TERMINALS) {
    return Object.entries(words).map(([key, { label }]) => ({
        label,
        values: key === "terminal" ? terminals.map((terminal) => terminal.name) : Object.values(values[key])
    }));
}

function missingFrom(where, text, labels) {
    const missing = labels.filter((label) => !text.includes(label));

    if (missing.length > 0) {
        throw new Error(`${where} does not name ${missing.map((label) => JSON.stringify(label)).join(", ")}`);
    }
}

// README: a table row per setting, `| label | ... |`, holding each of its values.
export function checkReadme(text, settings = settingWords()) {
    for (const { label, values } of settings) {
        const row = text.split("\n").find((line) => line.startsWith(`| ${label} |`));

        if (row === undefined) {
            throw new Error(`README.md has no settings table row for ${JSON.stringify(label)}`);
        }

        missingFrom(`README.md's row for ${JSON.stringify(label)}`, row, values);
    }
}

const SETTINGS_HEADING = "Settings\n========\n";

// INSTALL.txt's Settings section, to the next underlined heading or the end.
function installSection(text) {
    const start = text.indexOf(SETTINGS_HEADING);

    if (start < 0) {
        throw new Error("INSTALL.txt has no Settings section");
    }

    const rest = text.slice(start + SETTINGS_HEADING.length);

    return rest.slice(0, rest.search(/\n[^\n]+\n=+\n/u) + 1 || rest.length);
}

// INSTALL.txt: its Settings section names each setting, followed by its values.
export function checkInstall(text, settings = settingWords()) {
    const section = installSection(text);

    for (const { label, values } of settings) {
        missingFrom("INSTALL.txt's Settings section", section, [`${label}:`]);

        const after = section.slice(section.indexOf(`${label}:`));
        const next = settings.map((other) => after.indexOf(`${other.label}:`, 1)).filter((at) => at > 0);
        const entry = after.slice(0, next.length > 0 ? Math.min(...next) : after.length).replace(/\s+/gu, " ");

        missingFrom(`INSTALL.txt's entry for ${JSON.stringify(label)}`, entry, values);
    }
}

export async function checkSettingsDocs(read = readFromDisk) {
    checkReadme(await read("README.md"));
    checkInstall(await read("INSTALL.txt"));

    return settingWords().length;
}
