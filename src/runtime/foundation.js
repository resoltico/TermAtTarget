"use strict";

const { isNil, nativeFailure } = require("./bridge.js");
const { inspect, isPackage } = require("./attributes.js");
const { resolveAlias, readLink, validateDirectory } = require("./links.js");
const { pathOf } = require("./given-path.js");

/*
 * The filesystem as the rest of the runtime sees it: each Foundation question
 * with the bridge already supplied. The dialogs and the launcher take this
 * rather than the bridge's parts, which is also what lets their tests stand
 * in for Foundation with a handful of answers.
 */
function createFoundation(bridge) {
    return {
        inspect: (path) => inspect(bridge, path),
        isPackage: (path) => isPackage(bridge, path),
        resolveAlias: (path) => resolveAlias(bridge, path),
        readLink: (path) => readLink(bridge, path),
        pathOf: (value) => pathOf(bridge, value),
        validateDirectory: (path) => validateDirectory(bridge, path),
        isNil,
        nativeFailure: (operation, path, error) => nativeFailure(bridge, operation, path, error)
    };
}

module.exports = { createFoundation };
