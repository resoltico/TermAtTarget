"use strict";

const { presentLocation } = require("./present.js");
const { fault } = require("./outcomes.js");
const { render } = require("./messages.js");
const { FOLDER, LINK, START, SETUP } = require("./vocabulary.js");

function startQuestion(terminal, reason) {
    const ready = reason === SETUP.READY;

    return {
        id: "start", params: { terminal, reason },
        answers: ready ? [START.SETTINGS, START.CHOOSE] : [START.SETTINGS],
        usual: ready ? START.CHOOSE : START.SETTINGS
    };
}

function subjectOf(files, path) {
    try {
        return files.isPackage(path) ? "package" : "folder";
    } catch {
        // This optional metadata affects wording only.
        return "folder";
    }
}

function folderQuestion(path, via, terminal, files) {
    return {
        id: "folder",
        params: { terminal, via, subject: subjectOf(files, path), ...presentLocation(path, files.home()) },
        answers: [FOLDER.PARENT, FOLDER.INSIDE],
        usual: FOLDER.INSIDE
    };
}

function linkQuestion(path, via, terminal, files) {
    return {
        id: "link",
        params: { terminal, via, ...presentLocation(path, files.home()) },
        answers: [LINK.STAY, LINK.FOLLOW],
        usual: LINK.FOLLOW
    };
}

const TEXT = {
    start(locale, { reason, terminal }) {
        return render(locale, `start.${reason}`, reason === SETUP.UNRECOGNISED ? {} : { terminal });
    },
    folder(locale, { terminal, name, parent, subject, via }) {
        const prompt = render(locale, "folder.question", {
            terminal, name, parent, subject: render(locale, `folder.${subject}`)
        });

        return via === null ? prompt : `${prompt}\n${render(locale, `folder.via.${via}`)}`;
    },
    link(locale, { terminal, name, parent, via }) {
        return render(locale, `link.${via}`, { terminal, name, parent });
    }
};

function askAnswer(question, ask) {
    const answer = ask(question);

    if (!question.answers.includes(answer)) {
        throw fault("invalidAnswer", { question: question.id });
    }

    return answer;
}

function questionText(question, locale) {
    return TEXT[question.id](locale, question.params);
}

function answerLabel(locale, answer, via) {
    const id = answer === LINK.FOLLOW ? `answer.follow.${via}.action` : `answer.${answer}.action`;

    return render(locale, id);
}

module.exports = { startQuestion, folderQuestion, linkQuestion, askAnswer, questionText, answerLabel };
