/*
 * Every binary the action runs is named in src/runtime/executables.js and
 * nowhere else, so the external surface of the artifact is a file you can
 * read rather than a fact to reassemble from the modules that use it.
 *
 * A rule about where code lives, checked where the code is written: the
 * artifact is a render of src/, so nothing can be true of one and not the
 * other.
 */
const EXECUTABLES_MODULE = "src/runtime/executables.js";

const ABSOLUTE_EXECUTABLE =
    /"(?<path>\/(?:s?bin|usr\/s?bin|usr\/local\/bin|opt\/(?:homebrew|local)\/bin)\/[\w.-]+)"/gu;

export function executablePathsIn(content) {
    return [...new Set(
        [...String(content).matchAll(ABSOLUTE_EXECUTABLE)]
            .map((match) => match.groups.path)
    )].sort();
}

export function checkExecutables(relativePath, content) {
    // The rule is about what the shipped action runs. A test naming a path as
    // a fixture is asserting against it, not invoking it.
    if (!relativePath.startsWith("src/") || relativePath === EXECUTABLES_MODULE) {
        return;
    }

    const named = executablePathsIn(content);

    if (named.length > 0) {
        throw new Error(
            `${relativePath}: names ${named.join(", ")} directly; every ` +
            `executable belongs in ${EXECUTABLES_MODULE}, which is the one ` +
            "place the action's external surface is written down"
        );
    }
}
