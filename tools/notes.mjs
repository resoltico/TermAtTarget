import { read, metadata, root } from "./repository.mjs";

/*
 * The CHANGELOG section for one version, as the body of its release.
 *
 * Taken from the CHANGELOG rather than from a per-tag notes file, because a
 * second copy of the same prose is a second thing to keep in agreement. The
 * section must be the only one for that version, dated with a real calendar
 * date, and say something.
 */

const DATED_HEADING = /^## \[[^\]]+\] - (?<date>\d{4}-\d{2}-\d{2})$/u;
const SECTION = "## ";
const ISO_DATE_LENGTH = 10;

function sectionStart(lines, version) {
    const wanted = `## [${version}] - `;
    const starts = lines
        .map((line, index) => (line.startsWith(wanted) ? index : -1))
        .filter((index) => index >= 0);

    if (starts.length !== 1) {
        throw new Error(`CHANGELOG must contain exactly one section for ${version}.`);
    }

    return starts[0];
}

function sectionBody(lines, start) {
    const rest = lines.slice(start + 1);
    const next = rest.findIndex((line) => line.startsWith(SECTION));
    const body = (next < 0 ? rest : rest.slice(0, next)).join("\n").trim();

    if (!body) {
        throw new Error("The release notes section is empty.");
    }

    return body;
}

// A date that round-trips through the calendar: 2026-02-30 does not.
function assertDated(heading) {
    const dated = DATED_HEADING.exec(heading);

    if (!dated) {
        throw new Error("The release heading must have an ISO date.");
    }

    const { date } = dated.groups;
    const parsed = new Date(`${date}T00:00:00Z`);

    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, ISO_DATE_LENGTH) !== date) {
        throw new Error("The release heading must have a real calendar date.");
    }
}

export function extractNotes(changelog, version) {
    const lines = changelog.split("\n");
    const start = sectionStart(lines, version);
    const body = sectionBody(lines, start);

    assertDated(lines[start]);

    return `${lines[start]}\n\n${body}\n`;
}

// The date a release is dated, from the heading extractNotes accepted.
export function releaseDate(notes) {
    return DATED_HEADING.exec(notes.split("\n")[0]).groups.date;
}

export async function checkTag(tag, base = root) {
    const meta = await metadata(base);

    if (tag !== `v${meta.version}`) {
        throw new Error(`The tag must equal v${meta.version}.`);
    }

    return extractNotes(await read("CHANGELOG.md", base), meta.version);
}

