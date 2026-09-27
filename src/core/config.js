"use strict";

const FOLDER_ACTIONS = Object.freeze(["ASK", "INSIDE", "LEVEL"]);
const LINK_ACTIONS = Object.freeze(["ASK", "TARGET", "LINK"]);

function validateConfig(config) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        throw new Error("Configuration must be an object.");
    }
    const keys = Object.keys(config).sort();
    if (keys.join(",") !== "defaultFolderAction,defaultLinkAction") {
        throw new Error("Configuration must contain only defaultFolderAction and defaultLinkAction.");
    }
    if (!FOLDER_ACTIONS.includes(config.defaultFolderAction)) {
        throw new Error("defaultFolderAction must be ASK, INSIDE, or LEVEL.");
    }
    if (!LINK_ACTIONS.includes(config.defaultLinkAction)) {
        throw new Error("defaultLinkAction must be ASK, TARGET, or LINK.");
    }
    return Object.freeze({
        defaultFolderAction: config.defaultFolderAction,
        defaultLinkAction: config.defaultLinkAction
    });
}

module.exports = { validateConfig };
