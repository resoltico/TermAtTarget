import { parse } from "acorn";
import { renderRelease } from "../bundle.mjs";
import { metadata } from "../repository.mjs";

/*
 * The released artifact runs in JavaScriptCore under osascript, whose feature
 * set is fixed by the user's macOS version. The syntax half is a parse at the
 * declared ECMAScript year, as a script, which is how osascript reads it. But
 * a late *built-in* is ordinary syntax calling an ordinary method, so nothing
 * in a parser will flag it. It fails at runtime, on the user's Mac, with a
 * TypeError.
 *
 * The floor is macOS 12.3, whose JavaScriptCore corresponds to Safari 15.4.
 * Everything below is what landed after that. Each entry names the first
 * JavaScriptCore release that has it.
 *
 * No ECMAScript year maps exactly onto a Safari release: ES2022 as a whole is
 * not in 15.4, even though its built-ins are. That is why static blocks appear
 * here despite the ES2022 parse accepting them.
 *
 * Known gap: regular-expression *flags* are not inspected, so the ES2022 `d`
 * flag would not be caught here. Nothing in src/ uses it, and ESLint requires
 * every regex to carry `u`, which makes an accidental `d` unlikely.
 */
export const LATE_FEATURES = [
    ["static {", "Safari 16.4 / macOS 13.3", "a plain assignment after the class"],
    [".toSorted(", "Safari 16 / macOS 13", ".slice().sort()"],
    [".toReversed(", "Safari 16 / macOS 13", ".slice().reverse()"],
    [".toSpliced(", "Safari 16 / macOS 13", ".slice() then splice"],
    [".with(", "Safari 16 / macOS 13", "a copy then assignment"],
    ["Array.fromAsync(", "Safari 16.4 / macOS 13.3", "an explicit loop"],
    ["Object.groupBy(", "Safari 17.4 / macOS 14.4", "a plain reduce"],
    ["Map.groupBy(", "Safari 17.4 / macOS 14.4", "a plain reduce"],
    ["Promise.withResolvers(", "Safari 17.4 / macOS 14.4", "an explicit executor"],
    ["RegExp.escape(", "Safari 18.2 / macOS 15.2", "a manual escape"],
    ["structuredClone(", "a Web API absent from osascript", "an explicit copy"]
];

const LANGUAGE = /^ES(?<year>\d{4})$/u;

// What the artifact is held to, read from the metadata it carries.
export function targetOf(meta) {
    const declared = LANGUAGE.exec(String(meta.runtimeLanguage));

    if (!declared) {
        throw new Error(
            `runtimeLanguage ${meta.runtimeLanguage} is not an ECMAScript year ` +
            "such as ES2022"
        );
    }

    return { year: Number(declared.groups.year), macOS: meta.minimumMacOS };
}

export function findLateFeatures(release, features = LATE_FEATURES) {
    if (features.length === 0) {
        throw new Error("the language target has no features left to reject");
    }

    return features.filter(([token]) => release.includes(token));
}

export function checkSyntax(release, target) {
    try {
        parse(release, { ecmaVersion: target.year, sourceType: "script" });
    } catch (error) {
        throw new Error(
            `released artifact is not ES${target.year} script syntax: ${error.message}`,
            { cause: error }
        );
    }
}

export function checkFeatures(release, target) {
    const found = findLateFeatures(release);

    if (found.length > 0) {
        const detail = found
            .map(([token, since, instead]) =>
                `  ${token} requires ${since}; use ${instead}`)
            .join("\n");

        throw new Error(
            `released artifact uses features newer than macOS ` +
            `${target.macOS} (ES${target.year}):\n${detail}`
        );
    }

    return `ES${target.year}, macOS ${target.macOS}+`;
}

export async function checkLanguageTarget(render = renderRelease, describe = metadata) {
    const target = targetOf(await describe());
    const release = await render();

    checkSyntax(release, target);

    return checkFeatures(release, target);
}
