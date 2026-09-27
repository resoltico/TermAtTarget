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
import { checkToolchain } from "./lint/toolchain.mjs";
import { checkIgnores } from "./lint/ignore-rules.mjs";
import { checkDocumentReferences } from "./lint/document-references.mjs";
import { checkUnicodeTables } from "./lint/unicode-tables.mjs";

const files = await lintableFiles();

for (const relativePath of files) {
    await checkSourceFile(relativePath);
}

const workflowStatus = await checkWorkflows();
const languageTarget = await checkLanguageTarget();
const consistency = await checkConsistency();
const toolchain = await checkToolchain();
const ignored = await checkIgnores();
const documents = await checkDocumentReferences();
const unicode = await checkUnicodeTables();

console.log(
    `syntax and static policy checks passed for ${files.length} files ` +
    `(${workflowStatus}; language target: ${languageTarget}; ${consistency}; ` +
    `brew install ${toolchain}; ${ignored} ignore rules, ${documents} documents; ${unicode})`
);
