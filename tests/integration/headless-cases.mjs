// Stable native case IDs and their diagnostics. This module has no runtime dependencies.
const textualSuffixes = Object.freeze(["/%ZZ", "/%2f", "/%2F", "/%FF"]);
const nativeSuffixes = Object.freeze(textualSuffixes.slice(1));

export const NATIVE_FIXTURES = Object.freeze({
    textualSuffixes,
    nativeSuffixes,
    labels: Object.freeze({
        "foundation-directory-classification": "Foundation directory classification",
        "foundation-file-classification": "Foundation file classification",
        "finder-alias-classification": "Finder alias classification",
        "broken-alias-classification-without-target-resolution": "broken alias classification without target resolution",
        "lstat-like-symlink-classification": "lstat-like symlink classification",
        "package-metadata-asked-on-its-own": "package metadata, asked on its own",
        "package-metadata-failure-reaches-the-core": "package metadata failure reaches the core",
        "path-preserves-alias-pathname": "Path preserves alias pathname",
        "nsstring-input": "NSString input",
        "a-file-reference-url-fixture-is-one": "a file-reference URL fixture is one",
        "a-file-reference-url-reads-as-its-path": "a file-reference URL reads as its path",
        "relative-link-content-preserved": "relative link content preserved",
        "alias-target-resolution": "alias target resolution",
        "broken-target-reported-as-an-error": "broken target reported as an error",
        "missing-item-classified-from-the-native-domain-and-code": "missing item classified from the native domain and code",
        "permission-denial-stays-distinct-from-a-missing-item": "permission denial stays distinct from a missing item",
        "non-directory-launch-destination-rejected": "non-directory launch destination rejected",
        "a-folder-that-cannot-be-entered-is-refused": "a folder that cannot be entered is refused",
        "an-alias-to-an-ejected-volume-is-refused-not-remounted": "an alias to an ejected volume is refused, not remounted",
        "a-chosen-folder-opens-inside-it-whatever-folders-are-set-to": "a chosen folder opens inside it, whatever folders are set to",
        "native-path-file-input": "native Path file input",
        "native-path-folder-parent": "native Path folder parent",
        "native-nsurl-file-input": "native NSURL file input",
        "native-file-reference-nsurl-input": "native file-reference NSURL input",
        "a-url-for-a-link-to-a-folder-slash-and-all": "a URL for a link to a folder, slash and all",
        "alias-followed-to-a-directory": "alias followed to a directory",
        "alias-followed-to-a-file-s-folder": "alias followed to a file\u2019s folder",
        "broken-alias-opens-where-it-is": "broken alias opens where it is",
        "broken-symlink-own-location": "broken symlink own location",
        "relative-symlink-followed": "relative symlink followed",
        "file-parent-may-be-a-directory-symlink-without-changing-its-spelling": "file parent may be a directory symlink without changing its spelling",
        "symlink-goal-native-traversal-order": "symlink/../goal native traversal order",
        "hostile-unicode-newline-path-stays-exact": "hostile Unicode/newline path stays exact",
        "file-url-percent-sequence-decoded-once-and-the-lexical-directory-spelling-retained": "file URL percent sequence decoded once and the lexical directory spelling retained",
        "root-opens-without-a-folder-question": "root opens without a folder question",
        "a-slashed-link-to-a-folder-still-opens-where-the-link-sits": "a slashed link to a folder still opens where the link sits",
        "a-file-reference-url-written-as-text-opens-where-it-refers": "a file-reference URL written as text opens where it refers",
        "multiple-selection-rejected-before-path-conversion": "multiple selection rejected before path conversion",
        "encoded-dot-component-refused-before-filesystem-traversal": "encoded dot component refused before filesystem traversal",
        "a-path-ending-in-cannot-name-a-file": "a path ending in / cannot name a file",
        "symlink-cycle-rejected-at-the-traversal-limit": "symlink cycle rejected at the traversal limit",
        "a-slashed-link-to-a-file-is-refused": "a slashed link to a file is refused",
        "a-slashed-link-to-a-finder-alias-is-refused": "a slashed link to a Finder alias is refused",
        "an-unrecognised-saved-setting-is-refused": "an unrecognised saved setting is refused",
        "missing-selection-has-contextual-recovery": "missing selection has contextual recovery",
        "followed-dangling-link-has-contextual-recovery": "followed dangling link has contextual recovery",
        "folder-renamed-while-choosing-is-a-missing-destination": "folder renamed while choosing is a missing destination",
        "failed-planning-does-not-launch": "failed planning does not launch",
        ...Object.fromEntries(textualSuffixes.map((suffix) => [`textual-reference:${suffix}`, `Invalid textual reference ${suffix}`])),
        ...Object.fromEntries(nativeSuffixes.map((suffix) => [`native-reference:${suffix}`, `Invalid native reference ${suffix}`]))
    })
});

export const HEADLESS_CASE_IDS = Object.freeze(Object.keys(NATIVE_FIXTURES.labels));

export function completeHeadlessCases(ids, count) {
    if (!Array.isArray(ids) || count !== HEADLESS_CASE_IDS.length || ids.length !== count) {
        return false;
    }

    const found = new Set(ids);
    return HEADLESS_CASE_IDS.every((id) => found.has(id));
}
