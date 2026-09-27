/*
 * The disposable tree the native suite runs against, and the disk image whose
 * alias outlives it being mounted. Everything is made inside one temporary
 * folder, and nothing outside it is touched.
 */
import { execFileSync } from "node:child_process";
import { mkdir, writeFile, symlink, chmod } from "node:fs/promises";
import path from "node:path";

const HOSTILE = "odd ' \n$`;&\u{1F600}";
const INFO_PLIST = '<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>' +
    "<key>CFBundleIdentifier</key><string>test.TermAtTarget</string>" +
    "<key>CFBundlePackageType</key><string>APPL</string></dict></plist>\n";
const PRIVATE_FOLDER = 0o700;
const UNSEARCHABLE_FOLDER = 0o600;

export async function prepareFixtures(temp) {
    for (const name of ["folder", "elsewhere/deep", "elsewhere/goal", "Demo.app/Contents", HOSTILE, "locked"]) {
        await mkdir(path.join(temp, name), { recursive: true });
    }

    for (const name of ["file.txt", "doomed.txt", "folder/child.txt", `${HOSTILE}/item.txt`]) {
        await writeFile(path.join(temp, name), "fixture\n");
    }

    await writeFile(path.join(temp, "Demo.app/Contents/Info.plist"), INFO_PLIST);

    for (const [target, name] of [["folder", "relative-link"], ["missing", "broken-link"], ["cycle", "cycle"],
        ["elsewhere/deep", "shortcut"], ["shortcut/../goal", "ordered-link"]]) {
        await symlink(target, path.join(temp, name));
    }

    // A folder that exists and cannot be entered: no search permission.
    await chmod(path.join(temp, "locked"), UNSEARCHABLE_FOLDER);
}

// So the tree can be removed: an unsearchable folder cannot be emptied.
export async function releaseFixtures(temp) {
    await chmod(path.join(temp, "locked"), PRIVATE_FOLDER).catch(() => undefined);
}

function hdiutil(...args) {
    return execFileSync("/usr/bin/hdiutil", args, { encoding: "utf8" });
}

export function isAttached(image) {
    return hdiutil("info").includes(image);
}

/*
 * An alias to a folder on a disk image that is then ejected. Resolving it
 * without mounting must fail rather than mount the image again or ask.
 */
export async function aliasToEjectedVolume(temp, makeAlias) {
    const image = path.join(temp, "volume.dmg");
    const mountpoint = path.join(temp, "mounted");

    hdiutil("create", "-quiet", "-size", "4m", "-fs", "APFS", "-volname", "TermAtTargetTest", image);
    await mkdir(mountpoint);
    hdiutil("attach", "-quiet", "-nobrowse", "-noverify", "-mountpoint", mountpoint, image);

    try {
        await mkdir(path.join(mountpoint, "inner"));
        makeAlias(path.join(mountpoint, "inner"), path.join(temp, "volume-alias"));
    } finally {
        hdiutil("detach", "-quiet", mountpoint);
    }

    return image;
}
