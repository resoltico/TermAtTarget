import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { completeHeadlessCases } from "../tests/integration/headless-cases.mjs";
import { EXPECTED, NAMES } from "../tests/integration/presentation-corpus.mjs";

const [, , reportFile, artifactFile, commit] = process.argv;
const report = JSON.parse(await readFile(reportFile, "utf8"));
const artifactSha256 = createHash("sha256").update(await readFile(artifactFile)).digest("hex");

if (!/^[\da-f]{40}$/u.test(commit) || report.source?.commit !== commit ||
    report.source?.clean !== true || report.artifactSha256 !== artifactSha256) {
    throw new Error("Native evidence must qualify this commit and these artifact bytes from a clean checkout.");
}

const EXIT_STATUS = { quiet: 0, failing: 3, lingering: 1 };

function verifiedSupervisor(supervisor) {
    return Object.entries(EXIT_STATUS).every(([name, status]) =>
        supervisor?.[name]?.finished === true && supervisor[name].status === status) &&
        supervisor.flood?.finished === false && supervisor.flood.stopped === true &&
        supervisor.stubborn?.finished === false && supervisor.stubborn.stopped === false &&
        supervisor.unstartable === "native";
}

function verifiedPresentation(presentation) {
    return presentation?.paritySamples === NAMES.length && presentation.expectedSamples === EXPECTED.length &&
        isDeepStrictEqual(presentation.parityInputs, NAMES) &&
        isDeepStrictEqual(presentation.expectedInputs, EXPECTED.map(([input]) => input));
}

if (report.result !== "passed" || report.architecture !== "arm64" ||
    !/^Version 15\.\d+(?:\.\d+)? \(Build \w+\)$/u.test(report.os) ||
    !Array.isArray(report.scope) || !report.scope.includes("headless") ||
    !completeHeadlessCases(report.passed, report.count)) {
    throw new Error("Native evidence must record a passed headless suite on the expected macOS 15 ARM64 runner.");
}

if (report.compiled !== true || report.aliasVolumeStayedDetached !== true || report.preferences !== true ||
    report.overlappingPreferences !== true ||
    !verifiedPresentation(report.presentation) || !verifiedSupervisor(report.supervisor)) {
    throw new Error("Native evidence must include compilation, alias volume, preferences, presentation and supervisor results.");
}

console.log(`Qualified ${artifactSha256} on ${report.os} (${report.architecture}).`);
