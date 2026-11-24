import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

const requestFile = (directory) => path.join(directory, "request");
const observationFile = (directory) => path.join(directory, "last-input.json");
const lease = (directory) => path.join(directory, "request-lease");

export async function requireIdle(directory) {
    await access(lease(directory)).then(() => {
        throw new Error("The previous Shortcuts request ended without a verified loader result.");
    }, (error) => {
        if (error.code !== "ENOENT") {
            throw error;
        }
    });
}

async function readObservation(directory, request) {
    const seen = JSON.parse(await readFile(observationFile(directory), "utf8"));

    if (seen.request !== request) {
        throw new Error("The Shortcuts observation belongs to a different invocation.");
    }

    return seen;
}

async function observe(directory, request, run) {
    try {
        await rm(observationFile(directory), { force: true });
        await writeFile(requestFile(directory), request);
        const result = await run(request);
        return { ...result, seen: await readObservation(directory, request) };
    } finally {
        await rm(requestFile(directory), { force: true });
    }
}

export async function invokeRequest(directory, run) {
    await mkdir(lease(directory));
    // A failed request retains its lease. The loader cannot claim a new
    // request while the previous Shortcuts process may still be alive.
    const observed = await observe(directory, randomUUID(), run);
    await rm(lease(directory), { recursive: true });
    return observed;
}
