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
                // Validate the "type" property
                if (!suiteConfig.type) {
                    throw new Error("The suite does not have a 'type' property");
                }

                var suiteType: SuiteType = SuiteFactory.getSuiteTypeFromString(suiteConfig.type);

                // Make sure the suite has a "testFiles" property, and that it is an array
                if (!Array.isArray(suiteConfig.testFiles)) {
                    throw new Error("The suite does not have a 'testFiles' property, or has a 'testFiles' property that is not an array");
                }

                // Resolve the test files for this suite
                var resolvedTestFiles: string[] = SuiteFactory.resolveFiles(suiteConfig.testFiles, args.testsPath);

                // Make sure there is at least one test file
                if (!resolvedTestFiles.length) {
                    throw new Error("The 'testFiles' property is empty, or does not resolve to any file (at least one test file is needed)");
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

                // If the suite has a "setupScript" property, validate it
                if (suiteConfig.setupScript) {
                    // Build the absolute path of the script if it isn't already
                    var scriptFullPath: string = suiteConfig.setupScript;

                    if (!path.isAbsolute(scriptFullPath)) {
                        // The specified path is not absolute, so we must build it by joining the test package path and the specified relative path
                        scriptFullPath = path.resolve(path.join(args.testsPath, scriptFullPath));
                    }

                    // Make sure it points to a file that exists
                    if (!fs.existsSync(scriptFullPath)) {
                        throw new Error("The path in the 'setupScript' property does not exist");
                    }

                    // Make sure that it points to a file
                    if (fs.statSync(scriptFullPath).isDirectory()) {
                        throw new Error("The path in the 'setupScript' property is a directory (it needs to be a file)");
                    }

                    // Make sure the setup script is under the root test folder
                    if (scriptFullPath.indexOf(args.testsPath) !== 0) {
                        throw new Error("The path in the 'setupScript' property must be under the specified test folder");
                    }

                    // Build the relative path to the script (starting at the root of the test package)
                    var scriptRelativePath = path.relative(args.testsPath, scriptFullPath);

                    // Convert the backslashes in the script path, if any, to forward slashes (remotebuild-test-agent requires forward slashes for invoking commands)
                    scriptRelativePath = scriptRelativePath.replace(/\\/g, "/");

                    // Add the setup script path to the build options (add the relative path from the root of the test package)
                    buildOptions.setupScript = scriptRelativePath;
                }

                // If the suite has a "timeout" property, validate it
                if (suiteConfig.hasOwnProperty("timeout")) {
                    // It needs to be a natural number, so that we can give it to Q.timeout()
                    if (typeof suiteConfig.timeout !== "number" || suiteConfig.timeout <= 0 || Math.floor(suiteConfig.timeout) !== suiteConfig.timeout) {
                        throw new Error("The 'timeout' property is not a natural number");
                    }

                    // The timeout is valid, so add it to the build options
                    buildOptions.timeout = suiteConfig.timeout;
                }

                // If the suite has a "name" property, add it to the build options
                if (suiteConfig.hasOwnProperty("name")) {
                    buildOptions.name = suiteConfig.name;
                }

                // At this point the common suite properties appear valid, so build the suite (and validate suite-specific properties)
                var newSuite: AbstractSuite = null;

                switch (suiteType) {
                    case SuiteType.LOCAL:
                        newSuite = SuiteFactory.buildLocalSuite(index + 1, suiteConfig, resolvedTestFiles, args.testsPath, buildOptions);
                        break;
                    case SuiteType.REMOTE:
                        newSuite = SuiteFactory.buildRemoteSuite(index + 1, suiteConfig, resolvedTestFiles, args.testsPath, buildOptions);
                        break;
                    case SuiteType.VM:
                        newSuite = SuiteFactory.buildVMSuite(index + 1, suiteConfig, resolvedTestFiles, args.testsPath, buildOptions);
                        break;
                }

                suites.push(newSuite);
            } catch (err) {
                throw new Error(util.format("Error building suite %s:%s%s", AbstractSuite.getIdentifier(index + 1, suiteConfig.name), os.EOL, err.message));
            }
        });

        return suites;
    }

    private static buildLocalSuite(id: number, config: ISuiteConfig, testFiles: string[], testPath: string, buildOptions: ISuiteBuildOptions): LocalSuite {
        // No additional checks required for the local suite
        return new LocalSuite(id, testFiles, testPath, buildOptions);
    }

    private static buildRemoteSuite(id: number, config: ISuiteConfig, testFiles: string[], testPath: string, buildOptions: ISuiteBuildOptions): RemoteSuite {
        // Make sure the suite defines a "remoteIp" property
        if (!config.remoteIp) {
            throw new Error("The suite does not have a 'remoteIp' property");
        }

        // Make sure the suite defines a "remotePort" property
        if (!config.remotePort) {
            throw new Error("The suite does not have a 'remotePort' property");
        }

        // Make sure the "remotePort" property is a valid port
        if (!RemotebuildUtils.isPortValid(config.remotePort)) {
            throw new Error("The suite has an invalid 'remotePort' property: the value must be the string representation of a number between 1 and 65535");
        }

        // At this point the properties seem valid, so build the suite
        return new RemoteSuite(id, testFiles, testPath, config.remoteIp, config.remotePort, buildOptions);
    }

    private static buildVMSuite(id: number, config: ISuiteConfig, testFiles: string[], testPath: string, buildOptions: ISuiteBuildOptions): VMSuite {
        // Make sure the suite defines a "vmTemplate" property
        if (!config.vmTemplate) {
            throw new Error("The suite does not have a 'vmTemplate' property");
        }

        // Make sure the suite defines a "vmStartupPort" property
        if (!config.vmStartupPort) {
            throw new Error("The suite does not have a 'vmStartupPort' property");
        }

        // Make sure the "vmStartupPort" property is a valid port
        if (config.vmStartupPort && !RemotebuildUtils.isPortValid(config.vmStartupPort)) {
            throw new Error("The suite has an invalid 'vmStartupPort' property: the value must be the string representation of a number between 1 and 65535");
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
        return new VMSuite(id, testFiles, testPath, config.vmTemplate, config.vmStartupPort, vmBuildOptions);
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