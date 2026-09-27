/*
 * Prints the release notes for a tag, and fails unless the tag names the
 * version the repository declares. The release workflow runs it twice: before
 * qualifying, and again from the tagged tree before publishing.
 */
import { checkTag } from "./notes.mjs";

process.stdout.write(await checkTag(process.argv[2]));
