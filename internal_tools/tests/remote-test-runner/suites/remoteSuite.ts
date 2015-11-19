/// <reference path="../typings/fstream.d.ts" />
/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/q.d.ts" />
/// <reference path="../typings/remoteTestRunnerInterfaces.d.ts" />
/// <reference path="../typings/rimraf.d.ts" />
/// <reference path="../typings/tar.d.ts" />

"use strict";

import child_process = require("child_process");
import fs = require("fs");
import os = require("os");
import path = require("path");
import util = require("util");
import zlib = require("zlib");

import fstream = require("fstream");
import Q = require("q");
import rimraf = require("rimraf");
import tar = require("tar");

import AbstractSuite = require("./abstractSuite");
import RemoteTestModule = require("../utils/remoteTest");

import RemoteCommand = RemoteTestModule.RemoteCommand;
import IReaderProps = fstream.IReaderProps;
import ISuiteBuildOptions = RemoteTestRunnerInterfaces.ISuiteBuildOptions;
import RemoteTest = RemoteTestModule.RemoteTest;

class RemoteSuite extends AbstractSuite {
    private static REMOTE_UNZIP_SCRIPT: string = "unzip.js";

    protected remoteIp: string;
    protected remotePort: string;
    protected remoteTest: RemoteTest;

    private testPackageName: string;

    public get remotebuildTestUrl(): string {
        return util.format("http://[%s]:%s/test", this.remoteIp, this.remotePort);
    }

    public constructor(files: string[], testPath: string, ip: string, port: string, buildOptions?: ISuiteBuildOptions) {
        super(files, testPath, buildOptions);
        this.remoteIp = ip;
        this.remotePort = port;
    }

    protected setup(): Q.Promise<any> {
        // Connect to the remotebuild test agent
        this.remoteTest = new RemoteTest(this.remotebuildTestUrl);

        return this.remoteTest.ready.then((results: string[]) => {
            // Install the test package remotely
            return this.uploadTestPackage();
        }).then(() => {
            // Upload the sources folder to the remote test if necessary
            if (this.sourcesPath) {
                return this.uploadSources();
            }
        }).then(() => {
            // Upload and run the setup script if necessary
            if (this.setupScript) {
                return this.remoteSetup();
            }
        }).then(() => {
            // Lastly, install "mocha" for the remote test
            this.remoteTest.runCommandAndWaitForSuccess("npm install mocha");
        });
    }

    protected launch(): Q.Promise<any> {
        // Build the base mocha command
        var command: string = util.format("cd node_modules/%s && node ../mocha/bin/mocha %s", this.testPackageName, this.testFiles.join(" "));

        // Append the reporter if one was specified
        if (this.mochaReporter) {
            command += " --reporter " + this.mochaReporter;
        }

        // Invoke the mocha command remotely and wait for the command to finish
        return this.remoteTest.runCommandAndWaitForSuccess(command).then((remoteCommand: RemoteCommand) => {
            // Print the output of the remote mocha command to stdout to see the mocha report
            console.log("Output:");
            console.log(remoteCommand.command.result);
        })
    }

    /**
     * Packs the test package, sends it over to the remote test, cleans the local .tgz archive that was created as part of the packing step, and installs the package for the remote test.
     */
    private uploadTestPackage(): Q.Promise<any> {
        var testPackageTgzFullPath: string;
        var testPackageTgz: string;

        return Q({}).then(() => {
            // Pack the test package
            return this.packTestPackage();
        }).then((testPackage: string) => {
            // Save the full path to the packed test package, and save the first part
            testPackageTgzFullPath = testPackage;
            testPackageTgz = path.basename(testPackageTgzFullPath);

            // Upload the test package to the remote test
            return this.remoteTest.uploadFile(fs.createReadStream(testPackageTgzFullPath), testPackageTgz);
        }).then(() => {
            // Clean the local .tgz file, now that it is uploaded
            rimraf.sync(testPackageTgzFullPath);

            // Install the test package remotely
            return this.remoteTest.runCommandAndWaitForSuccess("npm install " + testPackageTgz);
        }).then((cmd: RemoteCommand) => {
            // The first line of the "npm install" command's output contains the package's name (in the form of "packageName@a.b.c node_modules\packageName"), which we need to save to eventually
            // navigate to it
            this.testPackageName = cmd.command.result.substring(0, cmd.command.result.indexOf("@"));

            return Q.resolve({});
        });
    }

    /**
     * Invokes "npm pack" on the command line to pack the test package. This is done with the OS' temporary directory set as the current working directory to ensure the .tgz is created in a safe
     * place. Returns a promise resolved with the full path to the created .tgz package.
     */
    private packTestPackage(): Q.Promise<string> {
        var deferred: Q.Deferred<any> = Q.defer<string>();
        var errorOutput: string = "";
        var output: string = "";
        var cp = child_process.spawn("npm", ["pack", this.testPackage], { cwd: os.tmpdir() });

        cp.on("error", (err: Error) => {
            deferred.reject(new Error(util.format("Error running 'npm pack' on the test package:%s%s", os.EOL, err.message)))
        });

        cp.on("exit", (code: number) => {
            if (code) {
                var reason: string = util.format("Exit code: %d", code);

                if (errorOutput) {
                    reason += util.format("%sstderr:%s%s", os.EOL, os.EOL, errorOutput);
                }

                var message: string = util.format("Error running 'npm pack' on the test package:%s%s", os.EOL, reason);

                deferred.reject(new Error(message));
            } else {
                // NPM outputs the name of the .tgz file that was created as part of 'npm pack' to stdout, so use that as the basename and the temporary dir as the dirname
                deferred.resolve(path.join(os.tmpdir(), output));
            }
        });

        cp.stdout.on("data", (data: Buffer) => {
            output += data.toString();
        });

        cp.stderr.on("data", (data: Buffer) => {
            errorOutput += data.toString();
        });

        return deferred.promise;
    }

    /**
     * Compresses the specified sources folder, sends it over to the remote test, and decompresses it remotely.
     */
    private uploadSources(): Q.Promise<any> {
        var sourcesFolderName: string = path.basename(this.sourcesPath);
        var sourcesTgzName = sourcesFolderName + ".tgz";
        var fileReader = new fstream.Reader({ path: this.sourcesPath, type: "Directory" });
        var gzipStream = fileReader.pipe(tar.Pack()).pipe(zlib.createGzip());

        // Upload the sources as .tgz
        return this.remoteTest.uploadFile(gzipStream, sourcesTgzName).then(() => {
            // Upload the unzip script
            return this.remoteTest.uploadFile(fs.createReadStream(path.join(__dirname, "..", "remoteScripts", "unzip.js")), RemoteSuite.REMOTE_UNZIP_SCRIPT);
        }).then(() => {
            // Install tar remotely
            return this.remoteTest.runCommandAndWaitForSuccess("npm install tar");
        }).then(() => {
            // Run the unzip script remotely
            return this.remoteTest.runCommandAndWaitForSuccess(util.format("node %s %s %s", RemoteSuite.REMOTE_UNZIP_SCRIPT, sourcesTgzName, sourcesFolderName));
        });
    }

    /**
     * Runs the setup script remotely.
     */
    private remoteSetup(): Q.Promise<any> {
        return this.remoteTest.runCommandAndWaitForSuccess(util.format("node node_modules/%s/%s", this.testPackageName, this.setupScript));
    }
}

export = RemoteSuite;