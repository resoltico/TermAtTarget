import { read, root, artifactName } from "./repository.mjs";
import { renderRelease, renderManifest } from "./bundle.mjs";

/*
 * Whether the committed artifact is what the source renders to.
 *
 * This must be able to fail, which means it runs against whatever is already
 * on disk. Never build immediately before it: regenerating the artifact first
 * makes the comparison vacuous and lets a stale artifact ship.
 */
export async function checkDist(base = root) {
    const expected = await renderRelease(base);

    if (await read(`dist/${artifactName}`, base) !== expected) {
        throw new Error("dist is stale or edited. Rebuild from source with npm run build.");
    }

    if (await read("dist/SHA256SUMS", base) !== renderManifest(expected)) {
        throw new Error("The artifact checksum manifest is stale or invalid.");
    }
}
