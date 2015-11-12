/// <reference path="typings/node.d.ts" />
/// <reference path="typings/q.d.ts" />
/// <reference path="typings/remoteTestRunnerInterfaces.d.ts" />

"use strict";

import os = require("os");
import util = require("util");

import Q = require("q");

import AbstractSuite = require("suites/abstractSuite");
import RemoteTestRunner = require("./remoteTestRunner");
import SuiteFactory = require("suites/suiteFactory");

import IParsedArgs = RemoteTestRunnerInterfaces.IParsedArgs;
import ITestConfig = RemoteTestRunnerInterfaces.ITestConfig;

class Runner {
    public static runTests(config: ITestConfig, args: IParsedArgs): Q.Promise<any> {
        // Build the test suites
        console.info("Building test suites...");

        var suites: AbstractSuite[] = SuiteFactory.buildSuites(config, args);

        console.info("Done.");

        // Run test suites
        return suites.reduce((previous: Q.Promise<any>, current: AbstractSuite, index: number) => {
            return previous.then(() => {
                console.log(util.format("Running suite #%d", index));

                return current.run();
            }).catch((err: any) => {
                return Q.reject(new Error(util.format("Error running suite #%d:%s%s", index, os.EOL, err.message)));
            });
        }, Q.resolve({}));
    }
}

export = Runner;