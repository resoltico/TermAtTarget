/*
 * Dependency-free source gate.
 *
 * Each family of checks lives in its own module under tools/lint/; this file
 * only sequences them.
 */
import { lintableFiles } from "./lint/discovery.mjs";
import { checkSourceFile } from "./lint/source-rules.mjs";
import { checkWorkflows } from "./lint/workflow-rules.mjs";
import { checkLanguageTarget } from "./lint/language-target.mjs";
import { checkConsistency } from "./lint/consistency.mjs";
import { checkIgnores } from "./lint/ignore-rules.mjs";
import { checkDocumentReferences } from "./lint/document-references.mjs";
import { checkUnicodeTables } from "./lint/unicode-tables.mjs";
import { checkSettingsDocs } from "./lint/settings-docs.mjs";

const files = await lintableFiles();

for (const relativePath of files) {
    await checkSourceFile(relativePath);
}

const workflowStatus = await checkWorkflows({ required: process.env.GITHUB_ACTIONS === "true" });
const languageTarget = await checkLanguageTarget();
const consistency = await checkConsistency();
const ignored = await checkIgnores();
const documents = await checkDocumentReferences();
const unicode = await checkUnicodeTables();
const settings = await checkSettingsDocs();

console.log(
    `syntax and static policy checks passed for ${files.length} files ` +
    `(${workflowStatus}; language target: ${languageTarget}; ${consistency}; ` +
    `${ignored} ignore rules, ${documents} documents, ${settings} settings documented; ${unicode})`
);
