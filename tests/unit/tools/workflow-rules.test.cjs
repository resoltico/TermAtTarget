"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

/*
 * The workflows are the one part of this project that has never executed, so
 * a mistake in them would surface on a first push rather than in the gate.
 */
const load = () => import("../../../tools/lint/workflow-rules.mjs");

test("workflow files are recognised by extension", async () => {
    const { isWorkflow } = await load();

    assert.equal(isWorkflow("quality.yml"), true);
    assert.equal(isWorkflow("release.yaml"), true);
    assert.equal(isWorkflow("quality.yml.bak"), false);
    assert.equal(isWorkflow("notes.md"), false);
    assert.equal(isWorkflow("yml"), false);
});

test("finding no workflows is an error, not a pass", async () => {
    const { assertWorkflowsFound } = await load();

    assert.throws(() => assertWorkflowsFound([]), /no workflows found/u);
    assert.doesNotThrow(() => assertWorkflowsFound(["quality.yml"]));
});

test("the probe asks actionlint itself, and asks it nothing else", async () => {
    const { probeActionlint } = await load();
    const calls = [];

    probeActionlint((...args) => calls.push(args));
    assert.deepEqual(calls, [["actionlint", ["--version"], { stdio: "ignore" }]]);
});

test("actionlint availability is reported either way", async () => {
    const { hasActionlint } = await load();

    assert.equal(hasActionlint(() => undefined), true);
    assert.equal(hasActionlint(() => {
        throw new Error("not installed");
    }), false);
});

test("the check reports what it did, installed or not", async () => {
    // The runner is injected rather than invoked: actionlint is not present
    // on every machine that runs this gate, and a test that needs it would
    // pass on a developer's Mac and fail on a Linux runner.
    const { checkWorkflows } = await load();
    const linted = [];

    assert.match(
        await checkWorkflows({ available: false }),
        /workflows \(actionlint not installed, skipped\)/u
    );
    assert.match(
        await checkWorkflows({
            available: true,
            run: (files) => linted.push(...files)
        }),
        /workflows, actionlint passed/u
    );
    assert.ok(linted.length > 0, "actionlint must be given the workflows");
});

test("actionlint is given every workflow, by absolute path", async () => {
    // A relative path would resolve against the process's directory rather
    // than the repository, and actionlint would report on nothing.
    const { checkWorkflows } = await load();
    const linted = [];

    await checkWorkflows({
        available: true,
        files: ["quality.yml", "release.yml"],
        read: () => Promise.resolve(""),
        run: (files) => linted.push(...files)
    });

    assert.equal(linted.length, 2);

    for (const file of linted) {
        assert.match(file, /^\/.*\.github\/workflows\/\w+\.yml$/u, file);
    }
});

test("only workflow files are selected, in a stable order", async () => {
    const { selectWorkflows } = await load();

    // Anything else in the directory must not be handed to actionlint, and
    // the order must not depend on how the filesystem happened to list it.
    assert.deepEqual(
        selectWorkflows(["release.yml", "notes.md", "quality.yml", "old.yml.bak"]),
        ["quality.yml", "release.yml"]
    );
    assert.deepEqual(selectWorkflows([]), []);
});

test("an empty workflow directory fails the check", async () => {
    const { checkWorkflows } = await load();

    await assert.rejects(() => checkWorkflows({ available: false, files: [] }), /no workflows found/u);
    assert.match(await checkWorkflows({ available: false, files: ["quality.yml"] }), /1 workflows/u);
});

test("actionlint is invoked by name, with the workflows and inherited output", async () => {
    // The default runner takes its exec so this can be asserted anywhere,
    // not only on a machine that has actionlint installed.
    const { runActionlint } = await load();
    const calls = [];

    runActionlint(["/a/quality.yml"], (...args) => calls.push(args));

    assert.deepEqual(calls, [
        ["actionlint", ["/a/quality.yml"], { stdio: "inherit" }]
    ]);
});

/*
 * Actions must be pinned to a commit.
 *
 * A tag is a moveable label: whoever owns the action repository can point v4
 * at different code tomorrow, and it would run with whatever permissions the
 * job holds. The repository has pinned by SHA from the start and dependabot
 * keeps the pins current — but nothing checked it, so a single unpinned line
 * would have gone in unnoticed.
 */

const PINNED = "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1";

test("a commit-pinned action is accepted", async () => {
    const { unpinnedActions } = await load();

    assert.deepEqual(unpinnedActions(`      - uses: ${PINNED}\n`), []);
});

test("a tag, a branch or a bare name is refused", async () => {
    const { unpinnedActions } = await load();
    const loose = [
        "actions/checkout@v4",
        "actions/checkout@main",
        "actions/checkout",
        "actions/checkout@v4.1.1",
        // Short SHAs are ambiguous and can be made to collide.
        "actions/checkout@3d3c42e"
    ];

    for (const action of loose) {
        assert.deepEqual(
            unpinnedActions(`      - uses: ${action}\n`),
            [action],
            `${action} must be refused`
        );
    }
});

test("a local action is part of this repository and needs no pin", async () => {
    const { unpinnedActions } = await load();

    assert.deepEqual(unpinnedActions("      - uses: ./.github/actions/build\n"), []);
});

test("every form the file uses is seen", async () => {
    // Both the list-item form and the keyed form appear in these workflows.
    const { unpinnedActions } = await load();

    assert.deepEqual(
        unpinnedActions("      - uses: a/b@v1\n        uses: c/d@v2\n"),
        ["a/b@v1", "c/d@v2"]
    );
});

test("the failure names the file and every loose action", async () => {
    const { assertPinned } = await load();

    assert.throws(
        () => assertPinned("release.yml", "- uses: a/b@v1\n- uses: c/d@main\n"),
        (error) => {
            assert.match(error.message, /release\.yml/u);
            assert.match(error.message, /a\/b@v1, c\/d@main/u, "separated");

            return true;
        }
    );
});

test("a fully pinned workflow raises nothing", async () => {
    const { assertPinned } = await load();

    assert.doesNotThrow(() => assertPinned("quality.yml", `- uses: ${PINNED}\n`));
});

test("a workflow is read as text, from where workflows live", async () => {
    // As bytes, every pinning pattern matches nothing and each workflow looks
    // perfectly pinned.
    const { readWorkflow } = await load();
    const calls = [];

    await readWorkflow("quality.yml", (...args) => calls.push(args));
    assert.equal(calls.length, 1);
    assert.match(calls[0][0], /\.github\/workflows\/quality\.yml$/u);
    assert.equal(calls[0][1], "utf8");
});

/*
 * The workflow gate as a whole: which files it reads, whether it consults
 * actionlint, and that it can be shown to fail rather than only observed
 * passing against a repository that is already correct.
 */

test("the gate reads the workflows it was given", async () => {
    // Driven against fixtures, so it can be shown to fail rather than only
    // observed passing against a repository that is already correct.
    const { checkWorkflows } = await load();

    await assert.rejects(
        () => checkWorkflows({
            available: false,
            files: ["bad.yml"],
            read: () => Promise.resolve("- uses: actions/checkout@v4\n")
        }),
        /must be pinned to a commit SHA/u
    );

    assert.match(
        await checkWorkflows({
            available: false,
            files: ["good.yml"],
            read: () => Promise.resolve(`- uses: ${PINNED}\n`)
        }),
        /1 workflows/u
    );
});

test("whether actionlint runs is decided by asking, not by an option", async () => {
    // `options.available ?? hasActionlint()` becoming `&&` would leave
    // actionlint permanently skipped in production, where no option is
    // passed — and the gate would still report success.
    const { checkWorkflows } = await load();
    const asked = [];
    const result = await checkWorkflows({
        files: ["good.yml"],
        read: () => Promise.resolve(`- uses: ${PINNED}\n`),
        probe: () => {
            asked.push("probed");

            throw new Error("shellcheck-style absence");
        }
    });

    assert.deepEqual(asked, ["probed"], "the probe must be consulted");
    assert.match(result, /actionlint not installed, skipped/u);
});

test("an explicit availability still overrides the probe", async () => {
    const { checkWorkflows } = await load();

    assert.match(
        await checkWorkflows({
            available: false,
            files: ["good.yml"],
            read: () => Promise.resolve(`- uses: ${PINNED}\n`),
            probe: () => {
                throw new Error("must not be consulted");
            }
        }),
        /not installed, skipped/u
    );
});

test("multiple spaces anywhere in the line do not hide an action", async () => {
    // YAML tolerates them, so the gate has to as well.
    const { unpinnedActions } = await load();

    assert.deepEqual(unpinnedActions("  -   uses:   a/b@v1\n"), ["a/b@v1"]);
    assert.deepEqual(unpinnedActions("-\tuses:\ta/b@v1\n"), ["a/b@v1"]);
});

test("a comment that mentions uses is not an action", async () => {
    // Unanchored, the scanner would read the word out of prose and refuse a
    // workflow for something that is not a step at all.
    const { unpinnedActions } = await load();

    assert.deepEqual(unpinnedActions("      # uses: actions/checkout@v4\n"), []);
    assert.deepEqual(
        unpinnedActions("      # explains why it uses: nothing\n"),
        []
    );
});

test("a commit pin must be the whole reference", async () => {
    // Trailing characters after forty hex digits are not a longer commit;
    // they are something else wearing one.
    const { unpinnedActions } = await load();
    const sha = "3d3c42e5aac5ba805825da76410c181273ba90b1";

    assert.deepEqual(unpinnedActions(`- uses: a/b@${sha}\n`), []);
    assert.deepEqual(unpinnedActions(`- uses: a/b@${sha}x\n`), [`a/b@${sha}x`]);
});
