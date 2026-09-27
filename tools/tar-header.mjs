import { Buffer } from "node:buffer";

/*
 * One ustar member header: 512 bytes, each field where POSIX puts it.
 *
 * Every member is owned by root with mode 0644, and every name is refused
 * that would extract anywhere but beneath the archive's own folder.
 */

export const BLOCK = 512;
const OCTAL = 8;
const FILE_MODE = 0o644;
const ROOT_ID = 0;
const SPACE = 0x20;
const CHECKSUM_DIGITS = 6;

/*
 * Where each ustar header field lives, as [offset, width] in bytes. This is
 * the format's own table, copied from POSIX; a name for each number would
 * only say the same thing twice.
 */
/* eslint-disable no-magic-numbers */
const FIELD = {
    name: [0, 100],
    mode: [100, 8],
    uid: [108, 8],
    gid: [116, 8],
    size: [124, 12],
    mtime: [136, 12],
    checksum: [148, 8],
    type: [156, 1],
    magic: [257, 6],
    version: [263, 2],
    owner: [265, 32],
    group: [297, 32],
    prefix: [345, 155]
};
/* eslint-enable no-magic-numbers */

function put(header, field, text) {
    const [offset, width] = FIELD[field];
    const bytes = Buffer.from(text, "utf8");

    if (bytes.length > width) {
        throw new Error(`Archive header field exceeds its limit: ${text}`);
    }

    bytes.copy(header, offset);
}

// A number as the field holds it: zero-padded octal, then a NUL.
function octal(value, width) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error("Invalid archive numeric field.");
    }

    const text = value.toString(OCTAL);

    if (text.length > width - 1) {
        throw new Error("Archive numeric field exceeds its limit.");
    }

    return `${text.padStart(width - 1, "0")}\0`;
}

function putNumber(header, field, value) {
    put(header, field, octal(value, FIELD[field][1]));
}

// Nothing that would extract outside the archive's own folder, or anywhere
// other than where the name says.
function assertSafeName(name) {
    const unsafe = name.split("/").some((part) => ["", ".", ".."].includes(part)) ||
        name.includes("\0") || name.includes("\\");

    if (unsafe) {
        throw new Error("Unsafe archive member name.");
    }
}

// A name too long for its field is split at a folder into prefix and name.
function putName(header, name) {
    const [, width] = FIELD.name;

    if (Buffer.byteLength(name) <= width) {
        put(header, "name", name);
        return;
    }

    const split = name.lastIndexOf("/");

    if (split <= 0) {
        throw new Error("Archive member name is too long.");
    }

    put(header, "name", name.slice(split + 1));
    put(header, "prefix", name.slice(0, split));
}

function putFixedFields(header, size, timestamp) {
    putNumber(header, "mode", FILE_MODE);
    putNumber(header, "uid", ROOT_ID);
    putNumber(header, "gid", ROOT_ID);
    putNumber(header, "size", size);
    putNumber(header, "mtime", timestamp);
    put(header, "type", "0");
    put(header, "magic", "ustar\0");
    put(header, "version", "00");
    put(header, "owner", "root");
    put(header, "group", "root");
}

// The checksum is summed with its own field read as spaces.
function sealChecksum(header) {
    const [offset, width] = FIELD.checksum;

    header.fill(SPACE, offset, offset + width);

    const sum = header.reduce((total, byte) => total + byte, 0);

    put(header, "checksum", `${sum.toString(OCTAL).padStart(CHECKSUM_DIGITS, "0")}\0 `);
}

export function tarHeader(name, size, timestamp) {
    assertSafeName(name);

    const header = Buffer.alloc(BLOCK);

    putName(header, name);
    putFixedFields(header, size, timestamp);
    sealChecksum(header);

    return header;
}
