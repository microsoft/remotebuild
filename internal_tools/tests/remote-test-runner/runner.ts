/// <reference path="typings/node.d.ts" />
/// <reference path="typings/q.d.ts" />
/// <reference path="typings/remoteTestRunnerInterfaces.d.ts" />

"use strict";

import os = require("os");
import util = require("util");

import Q = require("q");

import AbstractSuite = require("./suites/abstractSuite");
import SuiteFactory = require("./suites/suiteFactory");

import IParsedArgs = RemoteTestRunnerInterfaces.IParsedArgs;
import ITestConfig = RemoteTestRunnerInterfaces.ITestConfig;

class Runner {
    public static runTests(config: ITestConfig, args: IParsedArgs): Q.Promise<any> {
        var suites: AbstractSuite[];
        var errorOccurred: boolean = false;

        // Build the test suites
        console.log("Building test suites...");
        suites = SuiteFactory.buildSuites(config, args);

        if (!suites.length) {
            console.log("No test suites to run.");

            return Q.resolve({});
        }

        // Run test suites
        return suites.reduce((previous: Q.Promise<any>, current: AbstractSuite, index: number) => {
            return previous.then(() => {
                console.log(util.format("%sRunning suite #%d...", os.EOL, index));

                return current.run();
            }).catch((err: any) => {
                // There was an error or a test failure while running the suite, so wrap that error in a message to indicate the suite number (this error may be an uncaught exception, child process
                // error, or even a test failure)
                errorOccurred = true;
                console.log(util.format("Error running suite #%d:%s%s", index, os.EOL, err.message));
            });
        }, Q.resolve({})).then(() => {
            if (errorOccurred) {
                // If we had an error in one of the suites, we need to surface it so that the process exits with a non-zero code
                return Q.reject(new Error("There was an error or a test failure in at least one suite, see above for details"));
            } else {
                console.log("Done running suites");
            }
        });
    }
}

export = Runner;