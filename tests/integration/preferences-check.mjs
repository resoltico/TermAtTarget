import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

export function checkPreferences(invoke) {
    const domain = `com.resoltico.TermAtTarget.native-test.${randomUUID()}`;
    const first = { terminal: null, folder: "parent", link: 3 };
    const both = { ...first, terminal: "kitty" };

    try {
        const found = [
            invoke("preferences", domain, "folder"),
            invoke("preferences", domain, "terminal"),
            invoke("preferences", domain, "load"),
            execFileSync("/usr/bin/defaults", ["read", domain, "folder"], { encoding: "utf8" }).trim()
        ];

        if (!isDeepStrictEqual(found, [first, both, both, "parent"])) {
            throw new Error(`Separate settings edits did not read back: ${JSON.stringify(found)}`);
        }
    } finally {
        execFileSync("/usr/bin/defaults", ["delete", domain], { stdio: "ignore" });
    }

    console.log("PASS: separate settings edits preserve both keys and are visible in a later process.");
    return true;
}

async function writeConcurrently(invokeWriter, domain, barrier) {
    const writes = await Promise.allSettled(["overlap-folder", "overlap-terminal"]
        .map((step) => invokeWriter(domain, step, barrier)));

    for (const result of writes) {
        if (result.status === "rejected") {
            throw result.reason;
        }
    }
}

export async function checkOverlappingPreferences(invoke, invokeWriter, directory) {
    const domain = `com.resoltico.TermAtTarget.native-overlap.${randomUUID()}`;
    const barrier = path.join(directory, "settings-writers");
    await mkdir(barrier);

    try {
        await writeConcurrently(invokeWriter, domain, barrier);
        const values = invoke("preferences", domain, "load");
        if (!isDeepStrictEqual(values, { terminal: "kitty", folder: "parent", link: null })) {
            throw new Error(`Overlapping settings edits lost a key: ${JSON.stringify(values)}`);
        }
    } finally {
        execFileSync("/usr/bin/defaults", ["delete", domain], { stdio: "ignore" });
    }

    return true;
}
