"use strict";

/*
 * The documents name every setting and value in the settings screen's own
 * words. Each check is shown to fail when one is missing, on fixtures, and the
 * words are shown to come from the source.
 */

const assert = require("node:assert/strict");
const test = require("node:test");

const load = () => import("../../../tools/lint/settings-docs.mjs");

const SETTINGS = [
    { label: "Terminal app", values: ["Terminal", "Ghostty"] },
    { label: "When a folder is selected", values: ["Ask each time", "Open inside"] }
];
const README = "| Setting | Values |\n| --- | --- |\n| Terminal app | Terminal, and Ghostty | Terminal |\n" +
    "| When a folder is selected | Ask each time, Open inside | x |\n";
const INSTALL = "Intro\n\nSettings\n========\n\n    Terminal app:  Terminal / Ghostty\n" +
    "    When a folder is selected:  Ask each time /\n                Open inside\n\nRemoval\n=======\n\nOpen inside Terminal\n";

test("the words are the settings screen's labels and values, and the terminal apps' names", async () => {
    const { settingWords } = await load();
    const words = settingWords();

    assert.deepEqual(words.map((setting) => setting.label),
        ["Terminal app", "When a folder is selected", "When a Finder alias is selected"]);
    assert.deepEqual(words[0].values, ["Terminal", "Ghostty", "iTerm2", "kitty"]);
    assert.deepEqual(words[2].values, ["Ask each time", "Follow the alias", "Open where it is"]);
});

test("complete documents pass", async () => {
    const { checkReadme, checkInstall } = await load();

    assert.doesNotThrow(() => checkReadme(README, SETTINGS));
    assert.doesNotThrow(() => checkInstall(INSTALL, SETTINGS));
});

test("README without a setting's row, or with a value missing from it, fails", async () => {
    const { checkReadme } = await load();

    assert.throws(() => checkReadme(README.replace("| When a folder is selected |", "| Folders |"), SETTINGS),
        /^Error: README\.md has no settings table row for "When a folder is selected"$/u);
    assert.throws(() => checkReadme(README.replace(", and Ghostty", ""), SETTINGS),
        /^Error: README\.md's row for "Terminal app" does not name "Ghostty"$/u);
});

test("INSTALL.txt without the section, a setting, or one of its values, fails", async () => {
    const { checkInstall } = await load();

    assert.throws(() => checkInstall(INSTALL.replace("Settings\n========", "Options\n======="), SETTINGS),
        /^Error: INSTALL\.txt has no Settings section$/u);
    assert.throws(() => checkInstall(INSTALL.replace("Terminal app:", "App:"), SETTINGS),
        /^Error: INSTALL\.txt's Settings section does not name "Terminal app:"$/u);
    assert.throws(() => checkInstall(INSTALL.replace(" / Ghostty", ""), SETTINGS),
        /^Error: INSTALL\.txt's entry for "Terminal app" does not name "Ghostty"$/u);
});

test("a value written only in another setting's entry, or after the section, does not count", async () => {
    const { checkInstall } = await load();

    // "Open inside" appears after Removal, and "Terminal" under the folder entry: neither is its own entry's.
    assert.throws(() => checkInstall(INSTALL.replace("Ask each time /\n                Open inside", "Ask each time, Terminal"), SETTINGS),
        /^Error: INSTALL\.txt's entry for "When a folder is selected" does not name "Open inside"$/u);
});

test("the last section of INSTALL.txt is read to its end", async () => {
    const { checkInstall } = await load();

    assert.doesNotThrow(() => checkInstall(INSTALL.slice(0, INSTALL.indexOf("\nRemoval")), SETTINGS));
});
