/*
 * Verifies that the committed artifact and its manifest match the source.
 */
import { checkDist } from "./dist.mjs";

await checkDist();
console.log("Committed artifact and SHA-256 manifest match source.");
