/*
 * Builds the two harness shortcuts, signed, for a one-time import.
 *
 *   node tests/integration/shortcuts/build.mjs
 *
 * One feeds Get Selected Files in Finder into Run JavaScript for Mac
 * Automation; the other feeds the shortcut's own input, as INSTALL.txt sets
 * the action up. Opening each file shows Shortcuts' import sheet, and nothing
 * is added until someone clicks Add Shortcut there. The suite then runs them
 * with `node tests/integration/macos.mjs --shortcuts`.
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { root } from "../../../tools/repository.mjs";
import { HARNESS } from "./names.mjs";

const OUT = path.join(root, "reports", "shortcuts");
const script = await readFile(path.join(root, "tests/integration/shortcuts/loader.jxa"), "utf8");

function runScript(input) {
    return {
        WFWorkflowActionIdentifier: "is.workflow.actions.runjavascriptforautomation",
        WFWorkflowActionParameters: { Input: { Value: input, WFSerializationType: "WFTextTokenAttachment" }, Script: script, UUID: randomUUID().toUpperCase() }
    };
}

function selectionActions() {
    const selected = randomUUID().toUpperCase();

    return [
        { WFWorkflowActionIdentifier: "is.workflow.actions.finder.getselectedfiles", WFWorkflowActionParameters: { UUID: selected } },
        runScript({ OutputUUID: selected, Type: "ActionOutput", OutputName: "Selected Files" })
    ];
}

function workflow(actions) {
    return {
        WFWorkflowClientVersion: "2607.0.2",
        WFWorkflowMinimumClientVersion: 900,
        WFWorkflowMinimumClientVersionString: "900",
        WFWorkflowIcon: { WFWorkflowIconStartColor: 4282601983, WFWorkflowIconGlyphNumber: 59511 },
        WFWorkflowImportQuestions: [],
        WFWorkflowTypes: [],
        WFWorkflowOutputContentItemClasses: [],
        WFWorkflowInputContentItemClasses: ["WFGenericFileContentItem", "WFFolderContentItem"],
        WFWorkflowActions: actions
    };
}

function escape(text) {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// Written as XML, which plutil turns into the binary form Shortcuts signs.
function plistXml(value) {
    if (Array.isArray(value)) {
        return `<array>${value.map((item) => plistXml(item)).join("")}</array>`;
    }
    if (typeof value === "object") {
        return `<dict>${Object.entries(value).map(([key, item]) => `<key>${escape(key)}</key>${plistXml(item)}`).join("")}</dict>`;
    }
    if (typeof value === "number") {
        return `<integer>${value}</integer>`;
    }
    return `<string>${escape(String(value))}</string>`;
}

async function build(name, actions) {
    // shortcuts sign reads the format from the extension, and refuses .plist.
    const plist = path.join(OUT, `${name}.wflow`);
    const signed = path.join(OUT, `${name}.shortcut`);

    await writeFile(plist, `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">${plistXml(workflow(actions))}</plist>\n`);
    execFileSync("/usr/bin/plutil", ["-convert", "binary1", plist]);
    execFileSync("/usr/bin/shortcuts", ["sign", "--mode", "anyone", "--input", plist, "--output", signed], { stdio: "ignore" });

    return signed;
}

await mkdir(OUT, { recursive: true });

const built = [
    await build(HARNESS.selection, selectionActions()),
    await build(HARNESS.input, [runScript({ Type: "ExtensionInput" })])
];

console.log(`Open each of these and click Add Shortcut:\n${built.map((file) => `  ${file}`).join("\n")}`);
