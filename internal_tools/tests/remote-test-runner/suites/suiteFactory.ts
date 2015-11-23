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
import IVMSuiteBuildOptions = RemoteTestRunnerInterfaces.IVMSuiteBuildOptions;

enum SuiteType { LOCAL = 0, REMOTE = 1, VM = 2 }

class SuiteFactory {
    public static buildSuites(testConfig: ITestConfig, args: IParsedArgs): AbstractSuite[] {
        var suites: AbstractSuite[] = [];

        testConfig.suites.forEach((suiteConfig: ISuiteConfig, index: number) => {
            try {
                // Validate the "type" attribute
                if (!suiteConfig.type) {
                    throw new Error("The suite does not have a 'type' attribute");
                }

                var suiteType: SuiteType = SuiteFactory.getSuiteTypeFromString(suiteConfig.type);

                // Make sure the suite has a "testFiles" attribute, and that it is an array
                if (!Array.isArray(suiteConfig.testFiles)) {
                    throw new Error("The suite does not have a 'testFiles' attribute, or has a 'testFiles' attribute that is not an array");
                }

                // Resolve the test files for this suite
                var resolvedTestFiles: string[] = SuiteFactory.resolveFiles(suiteConfig.testFiles, args.testsPath);

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
                    // Build the absolute path of the script if it isn't already
                    var scriptFullPath: string = suiteConfig.setupScript;

                    if (!path.isAbsolute(scriptFullPath)) {
                        // The specified path is not absolute, so we must build it by joining the test package path and the specified relative path
                        scriptFullPath = path.join(args.testsPath, scriptFullPath);
                    }

                    // Make sure it points to a file that exists
                    if (!fs.existsSync(scriptFullPath)) {
                        throw new Error("The path in the 'setupScript' attribute does not exist");
                    }

                    // Make sure that it points to a file
                    if (fs.statSync(scriptFullPath).isDirectory()) {
                        throw new Error("The path in the 'setupScript' attribute is a directory (it needs to be a file)");
                    }

                    // Make sure the setup script is under the root test folder
                    if (scriptFullPath.indexOf(args.testsPath) !== 0) {
                        throw new Error("The path in the 'setupScript' attribute must be under the specified test folder");
                    }

                    // Build the relative path to the script (starting at the root of the test package)
                    var scriptRelativePath = path.relative(args.testsPath, scriptFullPath);

                    // Convert the backslashes in the script path to forward slashes (remotebuild-test-agent requires forward slashes for invoking commands)
                    scriptRelativePath = scriptRelativePath.replace(/\\/g, "/");

                    // Add the setup script path to the build options (add the relative path from the root of the test package)
                    buildOptions.setupScript = scriptRelativePath;
                }

                // At this point the common suite attributes appear valid, so build the suite (and validate suite-specific attributes)
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
        // No additional checks required for the local suite
        return new LocalSuite(testFiles, testPath, buildOptions);
    }

    private static buildRemoteSuite(config: ISuiteConfig, testFiles: string[], testPath: string, buildOptions: ISuiteBuildOptions): RemoteSuite {
        // Make sure the suite defines a "remoteIp" attribute
        if (!config.remoteIp) {
            throw new Error("The suite does not have a 'remoteIp' attribute");
        }

        // Make sure the suite defines a "remotePort" attribute
        if (!config.remotePort) {
            throw new Error("The suite does not have a 'remotePort' attribute");
        }

        // Make sure the "remotePort" attribute is a valid port
        if (!RemotebuildUtils.isPortValid(config.remotePort)) {
            throw new Error("The suite has an invalid 'remotePort' attribute: the value must be the string representation of a number between 1 and 65535");
        }

        // At this point the attributes seem valid, so build the suite
        return new RemoteSuite(testFiles, testPath, config.remoteIp, config.remotePort, buildOptions);
    }

    private static buildVMSuite(config: ISuiteConfig, testFiles: string[], testPath: string, buildOptions: ISuiteBuildOptions): VMSuite {
        // Make sure the suite defines a "vmTemplate" attribute
        if (!config.vmTemplate) {
            throw new Error("The suite does not have a 'vmTemplate' attribute");
        }

        // Make sure the suite defines a "vmStartupPort" attribute
        if (!config.vmStartupPort) {
            throw new Error("The suite does not have a 'vmStartupPort' attribute");
        }

        // Make sure the "vmStartupPort" attribute is a valid port
        if (config.vmStartupPort && !RemotebuildUtils.isPortValid(config.vmStartupPort)) {
            throw new Error("The suite has an invalid 'vmStartupPort' attribute: the value must be the string representation of a number between 1 and 65535");
        }

        // Make the VM suite build options out of the specified build options
        var vmBuildOptions: IVMSuiteBuildOptions = <IVMSuiteBuildOptions>buildOptions;

        if (config.hasOwnProperty("cloneVm")) {
            vmBuildOptions.cloneVm = config.cloneVm;
        }

        if (config.hasOwnProperty("keepVmOnTestPass")) {
            vmBuildOptions.keepVmOnTestPass = config.keepVmOnTestPass;
        }

        // Build the suite
        return new VMSuite(testFiles, testPath, config.vmTemplate, config.vmStartupPort, vmBuildOptions);
    }

    private static getSuiteTypeFromString(stringType: string): SuiteType {
        var upperCaseType: string = stringType.toUpperCase();

        if (!SuiteType.hasOwnProperty(upperCaseType)) {
            throw new Error("Invalid suite type: " + stringType);
        }

        return SuiteType[upperCaseType];
    }

    private static resolveFiles(globs: string[], testPackage: string): string[] {
        // Each element is a glob, which will resolve to an array of files, so we keep each array in an array and will merge them afterwards
        var resolvedGlobs: string[][] = [];

        globs.forEach((globPattern: string) => {
            // The glob package requires that only forward slashes are used, even on win32, so we need to replace the backslashes if there are any
            var forwardSlashGlob: string = globPattern.replace(/\\/g, "/");

            resolvedGlobs.push(glob.sync(forwardSlashGlob, { cwd: testPackage }));
        });

        // Merge all resolved globs together with [].concat.apply()
        return [].concat.apply([], resolvedGlobs);
    }
}

export = SuiteFactory;