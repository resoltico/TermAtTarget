"use strict";

/*
 * What the bundle embeds as #metadata, for Node.
 *
 * The artifact inlines this object from package.json at build time
 * (tools/repository.mjs). Node resolves the same specifier through the
 * "imports" field of package.json to this file, so the runtime's modules load
 * in a unit test exactly as they are written, with nothing standing in for
 * them. tests/repo checks that the two derivations agree.
 */

const pkg = require("../package.json");

module.exports = { ...pkg.termAtTarget, version: pkg.version, license: pkg.license };
