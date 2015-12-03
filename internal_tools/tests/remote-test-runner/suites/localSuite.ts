/// <reference path="../typings/mocha.d.ts" />
/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/q.d.ts" />
/// <reference path="../typings/remoteTestRunnerInterfaces.d.ts" />

"use strict";

import path = require("path");

import mocha = require("mocha");
import Q = require("q");

import AbstractSuite = require("./abstractSuite");

import ISuiteBuildOptions = RemoteTestRunnerInterfaces.ISuiteBuildOptions;

class LocalSuite extends AbstractSuite {
    public constructor(id: number, files: string[], testPath: string, buildOptions?: ISuiteBuildOptions) {
        super(id, files, testPath, buildOptions);
    }

    protected launch(): Q.Promise<any> {
        var mochaRunner: Mocha;
        var deferred: Q.Deferred<any> = Q.defer<any>();

        // Create the mocha runner
        if (this.mochaReporter) {
            mochaRunner = new mocha({
                reporter: this.mochaReporter
            });
        } else {
            mochaRunner = new mocha();
        }

        // Add the test files to the mocha runner
        this.testFiles.forEach((fileRelativePath: string) => {
            // The test files are relative to the test package root, so path.join() them with the package root when adding them to mocha
            mochaRunner.addFile(path.join(this.testPackage, fileRelativePath));
        });

        // Run the tests
        mochaRunner.run((failures: number) => {
            if (failures) {
                // If we had at least one failure, reject the promise
                deferred.reject(new Error("At least one test failed"));
            } else {
                // All tests passed
                deferred.resolve({});
            }
        });

        // Return the result
        return deferred.promise;
    }
}

export = LocalSuite;