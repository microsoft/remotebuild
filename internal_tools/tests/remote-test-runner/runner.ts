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
        var suites: AbstractSuite[] = [];
        var criticalErrorOccurred: boolean = false;

        // Build the test suites
        console.log("Building test suites...");
        suites = SuiteFactory.buildSuites(config, args);
        console.log("Done");

        // Run test suites
        return suites.reduce((previous: Q.Promise<any>, current: AbstractSuite, index: number) => {
            return previous.then(() => {
                console.log(util.format("Running suite #%d...", index));

                return current.run();
            }).catch((err: any) => {
                // If we reach this point, we had a critical failure that prevented us from running the tests of this suite, so log an error and save the error flag
                criticalErrorOccurred = true;
                console.log(util.format("Error running suite #%d:%s%s", index, os.EOL, err.message));
            });
        }, Q.resolve({})).then(() => {
            if (criticalErrorOccurred) {
                // If we had a critical error in one of the suites, we need to surface an error so that the process exits with a non-zero code
                return Q.reject(new Error("There was an error in at least one suite, see above for details"));
            } else {
                console.log("Done running suites");
            }
        });
    }
}

export = Runner;