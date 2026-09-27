import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

/*
 * Which shell a Terminal launch left at a directory, asked of the kernel.
 *
 * Looking at the window proves nothing a script can record, and Terminal's
 * own scripting dictionary knows a tab's tty but not its working directory.
 * lsof knows every process's working directory. It writes bytes outside
 * printable ASCII as \xNN escapes -- an emoji arrives as \xf0\x9f\x98\x80 --
 * so a name is decoded back to its bytes before it is compared, and the
 * comparison is exact rather than a prefix match.
 */

function decodeLsofName(name) {
    const bytes = [];

    for (let index = 0; index < name.length; index += 1) {
        const escape = /^\\x(?<hex>[0-9a-f]{2})/iu.exec(name.slice(index));

        if (escape) {
            bytes.push(parseInt(escape.groups.hex, 16));
            index += 3;
        } else {
            bytes.push(...Buffer.from(name[index], "utf8"));
        }
    }

    return Buffer.from(bytes).toString("utf8");
}

// Every process's working directory, as { pid, cwd } pairs.
function workingDirectories() {
    const listed = spawnSync("/usr/sbin/lsof", ["-a", "-d", "cwd", "-Fpn"], { encoding: "utf8" });
    const found = [];
    let pid = null;

    for (const line of listed.stdout.split("\n")) {
        if (line.startsWith("p")) {
            pid = Number(line.slice(1));
        } else if (line.startsWith("n") && pid !== null) {
            found.push({ pid, cwd: decodeLsofName(line.slice(1)) });
        }
    }

    return found;
}

/*
 * The pid of a shell whose working directory is exactly the directory given,
 * or null once the deadline passes. Terminal starts the shell asynchronously
 * after open returns, so the answer is polled for rather than read once.
 */
export async function shellAt(directory, timeoutMs) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const shell = workingDirectories().find((entry) => entry.cwd === directory);

        if (shell) {
            return shell.pid;
        }

        await sleep(250);
    }

    return null;
}
