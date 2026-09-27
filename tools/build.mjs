import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { root, artifactName } from "./repository.mjs";
import { renderRelease, renderManifest } from "./bundle.mjs";

const artifact = await renderRelease();
await mkdir(path.join(root, "dist"), { recursive: true });
await writeFile(path.join(root, "dist", artifactName), artifact);
await writeFile(path.join(root, "dist", "SHA256SUMS"), renderManifest(artifact));
console.log(renderManifest(artifact).trimEnd());
