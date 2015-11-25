/// <reference path="typings/node.d.ts" />
/// <reference path="typings/q.d.ts" />
/// <reference path="typings/remoteTestRunnerInterfaces.d.ts" />

"use strict";

import fs = require("fs");
import os = require("os");
import path = require("path");
import util = require("util");

import Q = require("q");

import Runner = require("./runner");

import IParsedArgs = RemoteTestRunnerInterfaces.IParsedArgs;
import ITestConfig = RemoteTestRunnerInterfaces.ITestConfig;

class RemoteTestRunner {
    private static COMMAND_NAME: string = "remote-test-runner";
    private static CONFIG_FILE_NAME: string = "testConfig.json";
    private static PACKAGE_JSON_NAME: string = "package.json";

    /**
     * The entry point of the package.
     */
    public static run(): void {
        try {
            // Parse arguments
            var parsed: IParsedArgs = RemoteTestRunner.parseArgs();

            // Validate arguments
            RemoteTestRunner.validateArgs(parsed);

            // Read and do high level validation of the test config file
            var testConfig: ITestConfig = RemoteTestRunner.parseTestConfig(parsed.testsPath);

            // Run tests
            Runner.runTests(testConfig, parsed).catch(RemoteTestRunner.handleError);
        } catch (err) {
            RemoteTestRunner.handleError(err);
        }
    }

    /**
     * Parses process.argv by looking for "--reporter" and the corresponding value, and then using the first 2 remaining args as the test package and the source folder, respectively. Returns an
     * IParsedArgs populated with the values of process.argv.
     */
    private static parseArgs(): IParsedArgs {
        // Clone the process' argv
        var args: string[] = JSON.parse(JSON.stringify(process.argv));  // Using JSON parse/stringify to clone the array

        // Remove the first two elements ("node" and "remote-test")
        args.splice(0, 2);

        // Look for "--reporter" and the associated value
        var reporterIndex: number = args.indexOf("--reporter");
        var reporterValue: string = "";

        // If present, remove the reporter option and value from the args
        if (reporterIndex !== -1) {
            var reporterOptionAndValue: string[] = args.splice(reporterIndex, 2);

            if (reporterOptionAndValue.length == 2) {
                reporterValue = reporterOptionAndValue[1];
            }
        }

        // Error out if no more args left
        if (!args.length) {
            throw new Error(util.format("Invalid command. Usage:%s    %s TEST_PACKAGE_FOLDER [SOURCES_FOLDER] [--reporter MOCHA_REPORTER]", os.EOL, RemoteTestRunner.COMMAND_NAME));
        }

        // The first remaining arg is the test package path
        var testPath: string = path.resolve(args.splice(0, 1)[0]);

        // The second (if present) is the sources folder path
        var sourcesPath: string = "";

        if (args.length) {
            sourcesPath = path.resolve(args.splice(0, 1)[0]);
        }

        // Return the parsed args
        var result: IParsedArgs = {
            testsPath: testPath,
        };

        if (reporterValue) {
            result.reporter = reporterValue;
        }

        if (sourcesPath) {
            result.sourcesPath = sourcesPath;
        }

        if (args.length) {
            result.remain = args;
        }

        return result;
    }

    /**
     * Validates the arguments received in process.argv. Throws an exception if something is invalid.
     */
    private static validateArgs(args: IParsedArgs): void {
        // Make sure the test path exists
        if (!fs.existsSync(args.testsPath)) {
            throw new Error("The specified test package path does not exist: " + args.testsPath);
        }

        // Make sure the test path is a directory
        if (!fs.statSync(args.testsPath).isDirectory()) {
            throw new Error("The specified test package path is not a directory: " + args.testsPath);
        }

        // Make sure the test path contains a package.json
        if (!fs.existsSync(path.join(args.testsPath, RemoteTestRunner.PACKAGE_JSON_NAME))) {
            throw new Error(util.format("The specified test package path does not contain a '%s' file: %s", RemoteTestRunner.PACKAGE_JSON_NAME, args.testsPath));
        }

        // Make sure the test path contains a test config file
        if (!fs.existsSync(path.join(args.testsPath, RemoteTestRunner.CONFIG_FILE_NAME))) {
            throw new Error(util.format("The specified test package path does not contain a '%s' file: %s", RemoteTestRunner.CONFIG_FILE_NAME, args.testsPath));
        }

        //If the sources path was specified, make sure it exists and it is a directory
        if (args.sourcesPath) {
            if (!fs.existsSync(args.sourcesPath)) {
                throw new Error("The specified sources folder path does not exist: " + args.sourcesPath);
            }

            if (!fs.statSync(args.sourcesPath).isDirectory()) {
                throw new Error("The specified sources folder path is not a directory: " + args.sourcesPath);
            }
        }
    }

    /**
     * Looks for the test config file in the specified test folder. Reads the file, and performs high-level validation. Throws an error if the config file is not found or if it is invalid.
     */
    private static parseTestConfig(testPath: string): ITestConfig {
        var configFilePath = path.join(testPath, RemoteTestRunner.CONFIG_FILE_NAME);

        // Make sure the content is valid JSON
        var fileContent: ITestConfig;

        try {
            fileContent = JSON.parse(fs.readFileSync(configFilePath, "utf8"));
        } catch (err) {
            throw new Error(util.format("Error reading the test configuration file:%s%s", os.EOL, err.message));
        }

        // A "suites" property needs to be defined at the root, and it needs to be an array
        if (!Array.isArray(fileContent.suites)) {
            throw new Error("The test config file is not valid: the root object does not have a 'suites' property, or has a 'suites' property that is not an array");
        }

        // At this point the config file seems valid
        return fileContent;
    }

    /**
     * Prints a generic error message along with the error, and exits with code 1.
     */
    private static handleError(err: any): void {
        console.error(util.format("Error:%s%s", os.EOL, err.message));
        process.exit(1);
    }
}

export = RemoteTestRunner;