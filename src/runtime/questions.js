"use strict";

const { SOURCE_LOCALE, render } = require("../core/messages.js");
const { fault } = require("../core/outcomes.js");
const { questionText, answerLabel } = require("../core/questions.js");
const { ask, chooseFolder } = require("./standard-additions.js");

const MAX_ANSWERS = 2;

function askQuestion(app, question) {
    const { answers, usual } = question;

    if (answers.length > MAX_ANSWERS) {
        throw fault("tooManyAnswers", { question: question.id });
    }

    const labels = Object.fromEntries(answers.map((answer) => [answer, answerLabel(SOURCE_LOCALE, answer, question.params.via)]));
    const alternative = answers.find((answer) => answer !== usual);
    const button = ask(app, questionText(question, SOURCE_LOCALE), { other: labels[alternative], usual: labels[usual] });

    return answers.find((answer) => labels[answer] === button);
}

function createQuestions(app) {
    return {
        ask: (question) => askQuestion(app, question),
        chooseFolder: (terminal) => chooseFolder(app, render(SOURCE_LOCALE, "chooseFolder.prompt", { terminal }))
    };
}

module.exports = { createQuestions };
