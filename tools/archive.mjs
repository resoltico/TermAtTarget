import { Buffer } from "node:buffer";
import { gzipSync } from "node:zlib";
import { BLOCK, tarHeader } from "./tar-header.mjs";

/*
 * A source archive, as a ustar file compressed with gzip.
 *
 * Written here rather than by a tar binary so the bytes depend on nothing but
 * the files and one timestamp: every member is owned by root, mode 0644, with
 * the same modification time, in name order. Two runs over the same tree
 * produce the same archive, which is what lets a checksum stand for it.
 */

const END_OF_ARCHIVE_BLOCKS = 2;
const MAXIMUM_COMPRESSION = 9;

// By code unit, so the order is the same on every machine and in every locale.
function byName(left, right) {
    if (left.name === right.name) {
        return 0;
    }

    return left.name < right.name ? -1 : 1;
}

function member(entry, timestamp) {
    const bytes = Buffer.isBuffer(entry.bytes) ? entry.bytes : Buffer.from(entry.bytes);
    const remainder = bytes.length % BLOCK;

    return [
        tarHeader(entry.name, bytes.length, timestamp),
        bytes,
        Buffer.alloc(remainder === 0 ? 0 : BLOCK - remainder)
    ];
}

export function archiveOf(entries, timestamp) {
    const sorted = [...entries].sort(byName);
    const duplicate = sorted.find((entry, index) => index > 0 && sorted[index - 1].name === entry.name);

    if (duplicate) {
        throw new Error(`Duplicate archive member: ${duplicate.name}`);
    }

    const blocks = [
        ...sorted.flatMap((entry) => member(entry, timestamp)),
        Buffer.alloc(BLOCK * END_OF_ARCHIVE_BLOCKS)
    ];

    return gzipSync(Buffer.concat(blocks), { level: MAXIMUM_COMPRESSION });
}
