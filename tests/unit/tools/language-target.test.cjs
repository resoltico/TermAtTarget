"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

/*
 * The language target keeps the artifact runnable on the oldest supported
 * macOS. ESLint cannot do this job: a late built-in is ordinary syntax
 * calling an ordinary method, so only this check stands between it and a
 * TypeError on a user's Mac.
 */
const loadTarget = () => import("../../../tools/lint/language-target.mjs");
const TARGET = { year: 2022, macOS: "12.3" };
const META = { runtimeLanguage: "ES2022", minimumMacOS: "12.3" };

test("code within the target passes", async () => {
    const { checkFeatures } = await loadTarget();

    assert.equal(
        checkFeatures("const a = records.slice().sort();\nObject.hasOwn(x, 'y');", TARGET),
        "ES2022, macOS 12.3+",
        "and says what it held the code to"
    );
});

test("each rejected feature is on its own line", async () => {
    // Run together, two findings read as one feature with a mangled name.
    const { checkFeatures } = await loadTarget();

    assert.throws(
        () => checkFeatures("a.toSorted();\nObject.groupBy(b, c);", TARGET),
        /toSorted\( requires [^\n]+\n {2}Object\.groupBy\(/u
    );
});

test("every listed feature is detected, and rejected naming the floor", async () => {
    const { LATE_FEATURES, checkFeatures, findLateFeatures } = await loadTarget();

    for (const [token] of LATE_FEATURES) {
        assert.equal(findLateFeatures(`const x = a${token}b);`).length, 1, `${token} must be found`);
        assert.throws(
            () => checkFeatures(`const x = a${token}b);`, TARGET),
            /^Error: released artifact uses features newer than macOS 12\.3 \(ES2022\):\n/u,
            `${token} must be rejected`
        );
    }
});

test("the rejection names the version and the alternative", async () => {
    const { checkFeatures } = await loadTarget();

    assert.throws(() => checkFeatures("a.toSorted()", TARGET), (error) => {
        assert.match(error.message, /\.toSorted\( requires Safari 16 \/ macOS 13; use \.slice\(\)\.sort\(\)$/u);

        return true;
    });
});

test("an emptied denylist is itself an error", async () => {
    // A check with nothing to look for passes everything, which is
    // indistinguishable from a check that works and worse than no check.
    const { findLateFeatures } = await loadTarget();

    assert.throws(() => findLateFeatures("const a = 1;", []), /no features left to reject/u);
    assert.deepEqual(findLateFeatures("const a = 1;"), []);
});

test("every listed feature names its version and an alternative", async () => {
    const { LATE_FEATURES } = await loadTarget();

    for (const [token, since, instead] of LATE_FEATURES) {
        assert.ok(token.length > 0, "a token to look for");
        assert.match(since, /Safari|osascript/u, `${token} names its origin`);
        assert.ok(instead.length > 0, `${token} suggests an alternative`);
    }
});

test("the target is read from the metadata the artifact carries", async () => {
    const { targetOf } = await loadTarget();

    assert.deepEqual(targetOf(META), TARGET);

    for (const runtimeLanguage of ["ES22", "2022", "ES2022 ", "es2022", undefined]) {
        assert.throws(
            () => targetOf({ runtimeLanguage, minimumMacOS: "12.3" }),
            new RegExp(`^Error: runtimeLanguage ${runtimeLanguage} is not an ECMAScript year such as ES2022$`, "u"),
            String(runtimeLanguage)
        );
    }
});

test("syntax newer than the declared year is refused by the parse", async () => {
    // Class fields are ES2022: accepted at 2022, refused when the artifact
    // claims 2021. A module that parses as a module but not as a script is
    // refused too, since osascript reads the artifact as a script.
    const { checkSyntax } = await loadTarget();

    assert.doesNotThrow(() => checkSyntax("class A { x = 1; }", TARGET));
    assert.throws(() => checkSyntax("class A { x = 1; }", { year: 2021, macOS: "12.3" }), (error) => {
        assert.match(error.message, /^released artifact is not ES2021 script syntax: /u);
        assert.ok(error.cause instanceof SyntaxError, "the parser's own finding is kept");

        return true;
    });
    assert.throws(() => checkSyntax("export const a = 1;", TARGET), /not ES2022 script syntax/u);
});

test("the artifact is what is checked, not the sources it came from", async () => {
    // A module can be within the target while the render is not: the bundler
    // is what produces the file a Mac will run.
    const { checkLanguageTarget } = await loadTarget();
    const describe = () => Promise.resolve(META);

    assert.equal(await checkLanguageTarget(() => Promise.resolve("const a = 1;\n"), describe), "ES2022, macOS 12.3+");
    await assert.rejects(
        () => checkLanguageTarget(() => Promise.resolve("a.toSorted();\n"), describe),
        /uses features newer than macOS/u
    );
    await assert.rejects(
        () => checkLanguageTarget(() => Promise.resolve("class A { static { } }\n"), describe),
        /static \{ requires Safari 16\.4/u,
        "ES2022 syntax the floor lacks, which the parse accepts"
    );
    await assert.rejects(
        () => checkLanguageTarget(() => Promise.resolve("const a = ;\n"), describe),
        /not ES2022 script syntax/u
    );
});

test("the real artifact is within its declared target", async () => {
    const { checkLanguageTarget } = await loadTarget();

    assert.equal(await checkLanguageTarget(), "ES2022, macOS 12.3+");
});
