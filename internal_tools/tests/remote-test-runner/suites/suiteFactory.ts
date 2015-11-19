/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/glob.d.ts" />
/// <reference path="../typings/remoteTestRunnerInterfaces.d.ts" />

"use strict";

import fs = require("fs");
import os = require("os");
import path = require("path");
import util = require("util");

import glob = require("glob");

import AbstractSuite = require("./abstractSuite");
import LocalSuite = require("./localSuite");
import RemotebuildUtils = require("../utils/remotebuildUtils");
import RemoteSuite = require("./remoteSuite");
import VMSuite = require("./vmSuite");

import ISuiteBuildOptions = RemoteTestRunnerInterfaces.ISuiteBuildOptions;
import IParsedArgs = RemoteTestRunnerInterfaces.IParsedArgs;
import ISuiteConfig = RemoteTestRunnerInterfaces.ISuiteConfig;
import ITestConfig = RemoteTestRunnerInterfaces.ITestConfig;
import SuiteType = RemoteTestRunnerInterfaces.SuiteType;

class SuiteFactory {
    public static buildSuites(testConfig: ITestConfig, args: IParsedArgs): AbstractSuite[] {
        var suites: AbstractSuite[];

        testConfig.suites.forEach((suiteConfig: ISuiteConfig, index: number) => {
            try {
                // Validate the "type" attribute
                if (!suiteConfig.type) {
                    throw new Error("The suite does not have a 'type' attribute");
                }

                // Make sure the suite has a "testFiles" attribute, and that it is an array
                if (!Array.isArray(suiteConfig.testFiles)) {
                    throw new Error("The suite does not have a 'testFiles' attribute, or has a 'testFiles' attribute that is not an array");
                }

                // Resolve the test files for this suite
                var resolvedTestFiles: string[] = SuiteFactory.resolveFiles(suiteConfig.testFiles);

                // Make sure there is at least one test file
                if (!resolvedTestFiles.length) {
                    throw new Error("The 'testFiles' attribute is empty, or does not resolve to any file (at least one test file is needed)");
                }

                // Construct the suite build options
                var buildOptions: ISuiteBuildOptions = {};

                // Add the reporter to the build options if necessary
                if (args.reporter) {
                    buildOptions.mochaReporter = args.reporter;
                }

                // Add the sources path to the build options if necessary
                if (args.sourcesPath) {
                    buildOptions.sourcesPath = args.sourcesPath;
                }

                // If the suite has a "setupScript" attribute, validate it
                if (suiteConfig.setupScript) {
                    // Make sure it points to a file that exists
                    if (!fs.existsSync(suiteConfig.setupScript)) {
                        throw new Error("The path in the 'setupScript' attribute does not exist");
                    }

                    // Make sure that it points to a file
                    if (fs.statSync(suiteConfig.setupScript).isDirectory()) {
                        throw new Error("The path in the 'setupScript' attribute is a directory (it needs to be a file)");
                    }

                    // Make sure the setup script is under the root test folder
                    if (path.resolve(suiteConfig.setupScript).indexOf(path.resolve(args.testsPath)) !== 0) {
                        throw new Error("The path in the 'setupScript' attribute must be under the specified test folder");
                    }

                    // Build the relative path to the script (starting at the root of the test package)
                    var scriptRelativePath = path.relative(args.testsPath, suiteConfig.setupScript);

                    // Convert the backslashes in the script path to forward slashes (so that we can deal with remote paths in a platform-agnostic way thanks to remotebuild-test-agent)
                    scriptRelativePath = scriptRelativePath.replace(/\\/g, "/");

                    // Add the setup script path to the build options (add the relative path from the root of the test package)
                    buildOptions.setupScript = scriptRelativePath;
                }

                // At this point the common suite attributes appear valid, so build the suite (and validate suite-specific attributes)
                var suiteType: SuiteType = SuiteFactory.getSuiteTypeFromString(suiteConfig.type);;
                var newSuite: AbstractSuite = null;

                switch (suiteType) {
                    case SuiteType.LOCAL:
                        newSuite = SuiteFactory.buildLocalSuite(suiteConfig, resolvedTestFiles, args.testsPath, buildOptions);
                        break;
                    case SuiteType.REMOTE:
                        newSuite = SuiteFactory.buildRemoteSuite(suiteConfig, resolvedTestFiles, args.testsPath, buildOptions);
                        break;
                    case SuiteType.VM:
                        newSuite = SuiteFactory.buildVMSuite(suiteConfig, resolvedTestFiles, args.testsPath, buildOptions);
                        break;
                }

                suites.push(newSuite);
            } catch (err) {
                throw new Error(util.format("Error building suite #%d:%s%s", index, os.EOL, err.message));
            }
        });

        return suites;
    }

    private static buildLocalSuite(config: ISuiteConfig, testFiles: string[], testPath: string, buildOptions: ISuiteBuildOptions): LocalSuite {
        // TODO
        throw new Error("Not implemented");
    }

    private static buildRemoteSuite(config: ISuiteConfig, testFiles: string[], testPath: string, buildOptions: ISuiteBuildOptions): RemoteSuite {
        // Make sure the suite defines a "remoteMachineIp" attribute
        if (!config.remoteIp) {
            throw new Error("The suite does not have a 'remoteMachineIp' attribute");
        }

        // Make sure the suite defines a "remoteMachinePort" attribute
        if (!config.remotePort) {
            throw new Error("The suite does not have a 'remoteMachinePort' attribute");
        }

        // Make sure the "remoteMachinePort" attribute is a valid port
        if (!RemotebuildUtils.isPortValid(config.remotePort)) {
            throw new Error("The suite has an invalid 'remoteMachinePort' attribute: the value must be the string representation of a number between 1 and 65535");
        }

        // At this point the attributes seem valid, so build the suite
        return new RemoteSuite(testFiles, testPath, config.remoteIp, config.remotePort, buildOptions);
    }

    private static buildVMSuite(config: ISuiteConfig, testFiles: string[], testPath: string, buildOptions: ISuiteBuildOptions): VMSuite {
        /*// Make sure the suite defines a "vmTemplate" attribute
        if (!config.vmTemplate) {
            throw new Error("The suite does not have a 'vmTemplate' attribute");
        }

        // If the suite defines a "vmStartupPort" attribute, make sure it is a valid port
        if (config.vmStartupPort && !RemotebuildUtils.isPortValid(config.vmStartupPort)) {
            throw new Error("The suite has an invalid 'vmStartupPort' attribute: the value must be the string representation of a number between 1 and 65535");
        }

        return new VMSuite();*/

        throw new Error("Not implemented");
    }

    private static getSuiteTypeFromString(stringType: string): SuiteType {
        if (!SuiteType[stringType]) {
            throw new Error("Invalid suite type: " + stringType);
        }

        return SuiteType[stringType];
    }

    private static resolveFiles(globs: string[]): string[] {
        // Each element is a glob, which will resolve to an array of files, so we keep each array in an array and will merge them afterwards
        var resolvedGlobs: string[][] = [];

        globs.forEach((globPattern: string) => {
            // The glob package requires that only forward slashes are used, even on win32, so we need to replace the backslashes if there are any
            resolvedGlobs.push(glob.sync(globPattern.replace(/\\/g, "/")));
        });

        // Merge all resolved globs together with [].concat.apply()
        return [].concat.apply([], resolvedGlobs);
    }
}

export = SuiteFactory;