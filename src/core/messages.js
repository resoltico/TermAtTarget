"use strict";

// Render in the requested locale, then fall back to the English source.
const SOURCE_LOCALE = "en";
const CATALOG = Object.freeze({
    [SOURCE_LOCALE]: Object.freeze({
        "pathNotText.summary": "The selected path is invalid",
        "pathNotText.message": "A path must be nonempty Unicode text without a NUL character.",
        "pathNotLocalURL.summary": "Use a local file URL",
        "pathNotLocalURL.message": "Use a local file URL without a remote host, query, or fragment.",
        "pathEncodedSeparator.summary": "The file URL is invalid",
        "pathEncodedSeparator.message": "A file URL must not contain an encoded path separator.",
        "pathBadEncoding.summary": "The file URL is invalid",
        "pathBadEncoding.message": "The file URL contains invalid percent-encoding or UTF-8.",
        "pathRelative.summary": "Use an absolute path",
        "pathRelative.message": "Use an absolute POSIX path or a local file URL. Relative paths and ~ are taken as written.",
        "pathDotComponent.summary": "Select the item itself",
        "pathDotComponent.message": "Direct input must not contain . or .. path components. Select the item itself.",
        "multipleSelection.summary": "Select one item at a time",
        "multipleSelection.message": "Term At Target opens one selected item at a time. Select one file or folder and run it again.",
        "slashedFile.summary": "The selected path names a file",
        "slashedFile.message": "{path} ends in \"/\", but it names a file, not a folder.",
        "slashedLinkToFile.summary": "The link leads to a file",
        "slashedLinkToFile.message": "{path} ends in \"/\", but it leads to a file, not a folder.",
        "tooManyLinks.summary": "Too many links",
        "tooManyLinks.message": "Too many aliases or symbolic links were followed while resolving {path}.",
        "linkThroughFile.summary": "A link passes through a file",
        "linkThroughFile.message": "The link target passes through {path}, which is not a directory.",
        "linkCycle.summary": "A link leads back to itself",
        "linkCycle.message": "A link cycle was found at {path}.",
        "settingUnrecognised.summary": "The {setting} setting isn't recognised",
        "settingUnrecognised.message": "The saved {setting} setting, {saved}, is not one of {values}.",
        "noTerminalInstalled.summary": "No supported terminal app is installed",
        "noTerminalInstalled.message": "Install a terminal app Term At Target can open, then try again.",
        "terminalMissing.summary": "{terminal} isn't installed",
        "terminalMissing.message": "{terminal} is the terminal app in Term At Target's settings, but macOS cannot find it. Install it, or choose another app. If you've just installed it, open it once from Applications, then try again.",
        "terminalReadsVariables.summary": "{terminal} can't open this folder",
        "terminalReadsVariables.message": "{terminal} reads \"$\" in a folder's path as the start of a variable, so it would open somewhere other than {path}. Choose another terminal app for this folder.",
        "terminalReadsVariables.parent": "The parent folder has no \"$\", so {terminal} can open it. Choose {action}.",
        "itemGone.summary": "The selected item is gone",
        "itemGone.message": "The selected item no longer exists.",
        "unusableInput.summary": "The item has no usable filesystem path",
        "unusableInput.message": "Configure the action to receive Files and pass a file, folder, absolute path, or local file URL.",
        "aliasTargetMissing.summary": "The alias's original can't be found",
        "aliasTargetMissing.message": "Choose {action} to open the folder containing the alias, or set Finder aliases to {option} in the settings.",
        "aliasTargetNotLocal.summary": "The alias target is not local",
        "aliasTargetNotLocal.message": "The Finder alias at {path} does not lead to a local filesystem URL.",
        "destinationGone.summary": "The destination is no longer a folder",
        "destinationGone.message": "The destination is no longer a directory: {path}.",
        "destinationNotEnterable.summary": "The destination cannot be entered",
        "destinationNotEnterable.message": "The destination directory cannot be entered: {path}.",
        "launchUnconfirmed.summary": "The terminal window may still appear",
        "launchUnconfirmed.message": "{terminal} was asked to open {path}. The window may still appear. Term At Target made one attempt.",
        "launchUnconfirmed.deadline": "The request was still pending at the deadline.",
        "launchUnconfirmed.lost": "The status of open could not be read. {cause}",
        "launchUnconfirmed.unstopped": "open was told to stop, but may still be running.",
        "launchUnconfirmed.pid": "open (process {pid}) was told to stop, but may still be running.",
        "launchUnconfirmed.cleanup": "Stopping open also failed. {detail}",
        "launchFailed.summary": "{terminal} couldn't open",
        "launchFailed.message": "{terminal} could not be opened at {path} (open exit {status}). Check that {terminal} opens on its own.",
        "invalidAnswer.message": "The action received an answer it did not offer.",
        "unknownItemKind.message": "The selected item's type could not be determined at {path}.",
        "relativeResolutionPath.message": "Link resolution requires an absolute path. It received {path}.",
        "native.inspect.message": "macOS could not inspect {path}.",
        "native.readMetadata.message": "macOS could not read metadata for {path}.",
        "native.resolveAlias.message": "macOS could not resolve the alias target for {path}.",
        "native.readLink.message": "macOS could not read the symbolic link {path}.",
        "native.launch.message": "macOS could not start the open request for {path}.",
        "native.message": "macOS reported {description} ({domain}, code {code}).",
        "native.noDetails": "macOS did not provide further details.",
        "preferencesUnavailable.message": "macOS could not open the preferences domain {domain}.",
        "missingFileType.message": "macOS omitted the filesystem item type for {path}.",
        "missingResourceValue.message": "macOS omitted a required resource value for {path}.",
        "tooManyAnswers.message": "This question has more answers than the dialog can show.",
        "duplicateLabels.message": "The settings list contains duplicate labels.",
        "start.ready": "Choose a folder to open in {terminal}.",
        "start.missing": "{terminal}, the terminal app in the settings, isn't installed.\n\nChoose another app in Settings, or install {terminal}.",
        "start.unrecognised": "A saved setting isn't recognised.\n\nOpen Settings to see which one, and change it.",
        "chooseFolder.prompt": "Choose a folder to open in {terminal}:",
        "folder.question": "Where should {terminal} open?\n\n{subject}: {name}\nIn: {parent}",
        "folder.folder": "Folder",
        "folder.package": "Package",
        "folder.via.alias": "This is where the selected Finder alias points.",
        "folder.via.symlink": "This is where the selected symbolic link points.",
        "link.alias": "Follow this Finder alias, or open {terminal} where it is?\n\nAlias: {name}\nIn: {parent}",
        "link.symlink": "Follow this symbolic link, or open {terminal} where it is?\n\nLink: {name}\nIn: {parent}",
        "answer.settings.action": "Settings…",
        "answer.choose.action": "Choose Folder…",
        "answer.inside.action": "Open Inside",
        "answer.inside.option": "Open inside",
        "answer.parent.action": "Open in Parent",
        "answer.parent.option": "Open in parent",
        "answer.stay.action": "Open Where It Is",
        "answer.stay.option": "Open where it is",
        "answer.follow.alias.action": "Follow Alias",
        "answer.follow.symlink.action": "Follow Link",
        "answer.follow.option": "Follow the alias",
        "answer.ask.option": "Ask each time",
        "settings.terminal.label": "Terminal app",
        "settings.folder.label": "When a folder is selected",
        "settings.link.label": "When a Finder alias is selected",
        "settings.row": "{label}: {value}",
        "settings.unrecognised": "{label}: not recognised ({value})",
        "settings.notInstalled": "{label}: {value} (not installed)",
        "saved.date": "a date, {value}",
        "saved.opaque": "a value that is not text"
    })
});

const PLACEHOLDER = /\{(?<name>[a-zA-Z][a-zA-Z0-9]*)\}/gu;

function render(locale, id, params = {}) {
    const source = CATALOG[locale]?.[id] ?? CATALOG[SOURCE_LOCALE][id];

    if (typeof source !== "string") {
        throw new RangeError(`Unknown message: ${id}`);
    }

    const used = new Set();
    const message = source.replaceAll(PLACEHOLDER, (match, name) => {
        if (!Object.hasOwn(params, name)) {
            throw new TypeError(`Missing parameter ${name} for message ${id}`);
        }

        used.add(name);
        return params[name];
    });

    if (used.size !== Object.keys(params).length) {
        throw new TypeError(`Unused parameter for message ${id}`);
    }

    return message;
}

module.exports = { SOURCE_LOCALE, CATALOG, render };
