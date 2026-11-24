"use strict";

const { failureReport } = require("../core/failure-report.js");
const { alert } = require("./standard-additions.js");

function createFailureReport(app) {
    return (error) => {
        const { heading, message } = failureReport(error);
        alert(app, heading, message);
    };
}

module.exports = { createFailureReport };
