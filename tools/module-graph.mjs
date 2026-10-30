import path from "node:path";

/*
 * What each source module requires, and whether those requires make a sound
 * graph: only literal requires of modules under src/, nothing from the
 * portable core into the runtime, and no cycles. esbuild would bundle a
 * require of anything it can resolve, and a cycle without complaint, so these
 * rules are checked here, against the modules found under src/, before
 * anything is built.
 */

const REQUIRE_CALL = /\brequire\s*\(/gu;
const LITERAL_REQUIRE = /\brequire\s*\(\s*(?<quote>["'])(?<specifier>[^"']+)\k<quote>\s*\)/gu;

function isCore(id) {
    return id.startsWith("src/core/");
}

function local(specifier, id, modules) {
    if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
        throw new Error(`External runtime dependency in ${id}: ${specifier}`);
    }

    const target = path.posix.normalize(path.posix.join(path.posix.dirname(id), specifier));

    if (!modules.includes(target)) {
        throw new Error(`Unknown module dependency in ${id}: ${target}`);
    }

    if (isCore(id) && !isCore(target)) {
        throw new Error("The portable core may not import a host adapter.");
    }

    return target;
}

// Each specifier a module requires, and the module it names.
export function dependencies(source, id, modules) {
    const literal = [...source.matchAll(LITERAL_REQUIRE)];

    if ([...source.matchAll(REQUIRE_CALL)].length !== literal.length) {
        throw new Error(`Only literal local module imports are allowed: ${id}`);
    }

    return Object.fromEntries(literal.map(({ groups: { specifier } }) => [specifier, local(specifier, id, modules)]));
}

export function verifyGraph(graph) {
    const active = new Set();
    const done = new Set();

    function visit(id) {
        if (done.has(id)) {
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
