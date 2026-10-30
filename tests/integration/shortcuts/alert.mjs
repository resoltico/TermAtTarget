/*
 * The alert a refused run shows, read and dismissed the way a person would:
 * through the Accessibility API (System Events), which needs the app running
 * the suite to be allowed under Privacy & Security > Accessibility. The alert
 * belongs to ShortcutsMacHelper, the XPC service Shortcuts runs scripts in.
 */
import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const READ_AND_DISMISS = `
tell application "System Events"
    repeat with p in (every process whose name is "ShortcutsMacHelper")
        set pid to unix id of p
        tell (first process whose unix id is pid)
            if (count of windows) > 0 then
                set texts to value of every static text of window 1
                click button "OK" of window 1
                set AppleScript's text item delimiters to linefeed
                return texts as text
            end if
        end tell
    end repeat
end tell
return ""`;

// The alert's text, once it has been shown and OK pressed, or null by the deadline.
export async function dismissAlert(timeoutMs) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const text = execFileSync("/usr/bin/osascript", ["-e", READ_AND_DISMISS], { encoding: "utf8" }).trim();

        if (text !== "") {
            return text;
        }

        await sleep(250);
    }

    return null;
}
