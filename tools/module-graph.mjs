import path from "node:path";
import { modules } from "./module-order.mjs";

/*
 * What each module requires, and whether those requires make a graph the
 * loader can serve: only listed local modules and the two embedded values,
 * nothing from the portable core into the host, and no cycles.
 */

const REQUIRE_CALL = /\brequire\s*\(/gu;
const LITERAL_REQUIRE = /\brequire\s*\(\s*(?<quote>["'])(?<specifier>[^"']+)\k<quote>\s*\)/gu;
// Resolved by Node through package.json "imports", and inlined by the loader.
const EMBEDDED = new Set(["#config", "#metadata"]);

function isCore(id) {
    return id.startsWith("src/core/");
}

function embedded(specifier, id) {
    if (isCore(id)) {
        throw new Error("The portable core may not read embedded application configuration.");
    }

    return specifier;
}

function local(specifier, id) {
    if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
        throw new Error(`External runtime dependency in ${id}: ${specifier}`);
    }

    const target = path.posix.normalize(path.posix.join(path.posix.dirname(id), specifier));

    if (!modules.includes(target)) {
        throw new Error(`Unlisted module dependency in ${id}: ${target}`);
    }

    if (isCore(id) && !isCore(target)) {
        throw new Error("The portable core may not import a host adapter.");
    }

    return target;
}

// Each specifier a module requires, and the module it names.
export function dependencies(source, id) {
    const literal = [...source.matchAll(LITERAL_REQUIRE)];

    if ([...source.matchAll(REQUIRE_CALL)].length !== literal.length) {
        throw new Error(`Only literal local module imports are allowed: ${id}`);
    }

    return Object.fromEntries(literal.map(({ groups: { specifier } }) =>
        [specifier, EMBEDDED.has(specifier) ? embedded(specifier, id) : local(specifier, id)]));
}

export function verifyGraph(graph) {
    const active = new Set();
    const done = new Set();

    function visit(id) {
        if (EMBEDDED.has(id) || done.has(id)) {
            return;
        }

        if (active.has(id)) {
            throw new Error(`Circular module dependency: ${id}`);
        }

        if (!Object.hasOwn(graph, id)) {
            throw new Error(`Missing module in graph: ${id}`);
        }

        active.add(id);
        Object.values(graph[id]).forEach(visit);
        active.delete(id);
        done.add(id);
    }

    Object.keys(graph).forEach(visit);
}
