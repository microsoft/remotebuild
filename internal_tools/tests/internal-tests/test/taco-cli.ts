/// <reference path="../../typings/mocha.d.ts" />
/// <reference path="../../typings/Q.d.ts" />
/// <reference path="../../typings/should.d.ts" />
/// <reference path="../../typings/mkdirp.d.ts" />
/// <reference path="../../typings/request.d.ts" />
/// <reference path="../../typings/fstream.d.ts" />
/// <reference path="../../typings/tar.d.ts" />

"use strict";

import fs = require("fs");
import fstream = require("fstream");
import http = require("http");
import mkdirp = require("mkdirp");
import os = require("os");
import path = require("path");
import Q = require("q");
import querystring = require("querystring");
import request = require("request");
import should = require("should");
import tar = require("tar");
import url = require("url");
import util = require("util");
import zlib = require("zlib");

import testUtils = require("./util/utils");
import IsolatedTest = require("./util/isolatedTest");

var remoteTestWinServerName: string = process.env.TACO_REMOTE_TEST_WIN_ADDRESS || "tacotestwin.redmond.corp.microsoft.com";
var remoteTestWinServerPort: string = process.env.TACO_REMOTE_TEST_WIN_PORT || 12344;
var remoteTestWinServer: string = util.format("http://%s:%d/test", remoteTestWinServerName, remoteTestWinServerPort);

var sourcesLocation: string = process.env.TACO_COMPILED_FOLDER || path.join(process.env.TACO_ROOT, "build", "packages", "node_modules");

var appCallbackPort = 12345;

describe("taco-cli E2E", function (): void {
    this.timeout(10 * 60 * 1000);

    before(function () {
        // We require that these tests run on a mac
        should(os.platform()).equal("darwin");
    });

    /**
     * Connect to a server running remotebuild and taco-test-agent
     * Create a new test instance, and send over pre-built sources that we intend to test.
     * Also disables telemetry so it does not lock up tests.
     * 
     * Returns the test number that was created.
     */
    function initializeServerWithContent(testServerUrl: string): Q.Promise<number> {
        var testId: number;
        return testUtils.requestPostPromise(testUtils.makeRequestOptions(testServerUrl, {})).then((response: testUtils.IRequestResult) => {
            if (response.response.statusCode != 200) {
                throw new Error("Failed to instantiate new test");
            } else {
                var test = <testUtils.ITest>JSON.parse(response.body);
                testId = test.id;
                console.info("Configuring test as #" + test.id);
            }
        }).then(() => {
            // upload the compiled sources we wish to test
            var fileReader = new fstream.Reader({ path: sourcesLocation, type: "Directory" });
            var gzipStream = fileReader.pipe(tar.Pack()).pipe(zlib.createGzip());

            console.info("Transferring files");
            return testUtils.uploadFile(testServerUrl, testId, "build/packages.tgz", gzipStream)
        }).then(() => {
            // Unzip compiled sources
            return testUtils.requestPostPromise(testUtils.makeRequestOptions(testServerUrl, { qs: { cmd: "npm install tar" } }, testId, "command"));
        }).then((response: testUtils.IRequestResult) => {
            if (response.response.statusCode !== 200) {
                throw new Error("Error preparing to unzip");
            }
            var command = <testUtils.ICommand>JSON.parse(response.body);

            var unzipScriptFile = fs.createReadStream(path.join(__dirname, "taco-cli", "unzip.js"));

            return Q.all<any>([
                testUtils.pollForCommandFinish(testServerUrl, testId, command.id),
                testUtils.uploadFile(testServerUrl, testId, "unzip.js", unzipScriptFile)
            ]);
        }).spread((command: testUtils.ICommand) => {
            if (command.status === "error") {
                throw new Error("Failed to prepare for unzipping\n" + command.result);
            }
            return testUtils.runCommandAndWait(testServerUrl, testId, "node unzip.js build/packages.tgz build/packages");
        }).then((command: testUtils.ICommand) => {
            if (command.status === "error") {
                throw new Error("Failed to prepare for unzipping\n" + command.result);
            }

            // Fix up local package dependencies
            return testUtils.uploadFile(testServerUrl, testId, "build/packages/updateDynamicDependencies.js", fs.createReadStream(path.join(__dirname, "..", "updateDynamicDependencies.js")));
        }).then(() => {
            return testUtils.runCommandAndWait(testServerUrl, testId, "cd build/packages && node updateDynamicDependencies.js");
        }).then((command: testUtils.ICommand) => {
            if (command.status === "error") {
                throw new Error("Failed to update dynamic dependencies\n" + command.result);
            }
            
            // Disable telemetry so we don't get asked
            return Q.all([
                testUtils.uploadFile(testServerUrl, testId, ".taco_home/TelemetrySettings.json", fs.createReadStream(path.join(__dirname, "taco-cli", "TelemetrySettings.json"))),
                testUtils.uploadFile(testServerUrl, testId, "taco_home/TelemetrySettings.json", fs.createReadStream(path.join(__dirname, "taco-cli", "TelemetrySettings.json")))
            ]);
        }).then(() => {
            return testId;
        });
        // at this point, the sources have been transferred and configured so they may be installed, and telemetry is disabled
    }

    describe("iOS tests", function () {
        var currentIsolatedTest: IsolatedTest;

        beforeEach(function (): Q.Promise<any> {
            currentIsolatedTest = new IsolatedTest();
            
            // Disable telemetry
            var telemetryPath = path.join(__dirname, "taco-cli", "TelemetrySettings.json");
            var telemetryDestinationFolder = path.join(currentIsolatedTest.rootFolder, ".taco_home");
            var telemetryDestinationPath = path.join(telemetryDestinationFolder, "TelemetrySettings.json");
            mkdirp.sync(telemetryDestinationFolder);

            return testUtils.promiseFromStream(fs.createReadStream(telemetryPath).pipe(fs.createWriteStream(telemetryDestinationPath)));
        });

        afterEach(function (): Q.Promise<any> {
            // Clean up the mac test instance
            return currentIsolatedTest.cleanup(this.currentTest.state !== "failed");
        });

        it("should be able to run an app on the iOS simulator", function (): Q.Promise<any> {
            // In this test we want to build and run an app in the iOS simulator
            // First we create a project with a plugin that lets us get non-HTTPS content
            return currentIsolatedTest.promiseExec(util.format("npm install %s/taco-cli.tgz", sourcesLocation))
                .then(() => currentIsolatedTest.promiseExec("node_modules/.bin/taco create myProject"))
                .then(() => currentIsolatedTest.promiseExec("../node_modules/.bin/taco plugin add cordova-plugin-transport-security", { cwd: "myProject" }))
                .then(() => currentIsolatedTest.promiseExec("../node_modules/.bin/taco platform add ios", { cwd: "myProject" }))
                .then(() => {
                    // Then modify index.html to call back to the host machine, so we know that
                    // the app started correctly and had the plugin correctly installed
                    var appCallback = fs.createReadStream(path.join(__dirname, "taco-cli", "appCallback.html"));
                    var destination = fs.createWriteStream(path.join(currentIsolatedTest.rootFolder, "myProject", "www", "index.html"));
                    var serverReplaceToken = "TEST_SERVER_REPLACE_TOKEN";
                    var serverAddress = util.format("\"http://localhost:%d\"", appCallbackPort);

                    var replaceTransformer = testUtils.streamReplace(serverReplaceToken, serverAddress);
                    return testUtils.promiseFromStream(appCallback.pipe(replaceTransformer).pipe(destination));
                }).then(() => currentIsolatedTest.promiseExec("../node_modules/.bin/taco build ios", { cwd: "myProject" }))
                .then(() => {
                    // Now run the app, and listen for the callback
                    var deferred = Q.defer();
                    var appCallbackServer = http.createServer(function (req, res) {
                        var parsedUrl = url.parse(req.url);
                        console.info(req.url);
                        if (req.method === "GET" && parsedUrl.pathname === "/deviceready") {
                            res.end();
                            deferred.resolve({});
                        }
                        if (parsedUrl.pathname === "/failure") {
                            deferred.reject(req);
                        }
                    });

                    appCallbackServer.listen(appCallbackPort);

                    return currentIsolatedTest.promiseExec("../node_modules/.bin/taco run ios --nobuild", { cwd: "myProject" })
                        .then((result: { stdout: Buffer, stderr: Buffer }) => {
                            console.info(result.stdout.toString());
                            console.error(result.stderr.toString());
                            Q.delay(120000).then(() => deferred.reject(new Error("Timed out")));
                            return deferred.promise;
                        }).finally(() => appCallbackServer.close());
                });
        });

        describe("remotebuild tests", function () {
            var winTestId: number;
            var remotebuildMacPort = 12346;
            var remotebuildProcess: NodeJSChildProcess.ChildProcess;
            var remotebuildIsolatedTest: IsolatedTest;

            before(function (): Q.Promise<any> {
                remotebuildIsolatedTest = new IsolatedTest();
                // No need to disable telemetry here.

                // Configure a windows machine to be the taco-cli client to the remotebuild server
                var windowsSetup = initializeServerWithContent(remoteTestWinServer).then((testId: number) => {
                    winTestId = testId;
                    return testUtils.runCommandsInSequence(remoteTestWinServer, winTestId, [
                        "npm install build/packages/taco-cli",
                        "node_modules/.bin/taco create myProject",
                        "cd myProject && ../node_modules/.bin/taco plugin add cordova-plugin-transport-security" // Needed for communication with non-HTTPS server, and also tests that plugins work
                    ]).then(() => {
                        // Extract a list of ip addresses to connect to on the mac
                        return remotebuildIsolatedTest.promiseExec("ifconfig -au inet | grep -o 'inet [0-9]\\+\\(\\.[0-9]\\+\\)\\{3\\}' | grep -o '[.0-9]\\+'");
                    }).then((result: { stdout: Buffer, stderr: Buffer }): Q.Promise<any> => {
                        // Replace the index.html page with a page that calls back to the remote server
                        var appCallback = fs.createReadStream(path.join(__dirname, "taco-cli", "appCallback.html"));
                        var serverReplaceToken = "TEST_SERVER_REPLACE_TOKEN";
                        var serverAddress = result.stdout.toString().split("\n").map((address: string): string => {
                            return util.format("\"http://%s:%d\"", address, appCallbackPort);
                        }).join(", ");

                        var replaceTransformer = testUtils.streamReplace(serverReplaceToken, serverAddress);
                        appCallback.pipe(replaceTransformer);
                        return testUtils.uploadFile(remoteTestWinServer, winTestId, "myProject/www/index.html", replaceTransformer);
                    });
                });

                // install remotebuild and configure for secure connections
                return remotebuildIsolatedTest.promiseExec(util.format("npm install %s/remotebuild.tgz", sourcesLocation))
                    .then(() => remotebuildIsolatedTest.promiseExec("mkdir .taco_home"))
                    .then(() => remotebuildIsolatedTest.promiseExec(util.format("node_modules/.bin/remotebuild saveconfig --port=%d --secure=true", remotebuildMacPort)))
                    .then(() => remotebuildIsolatedTest.promiseExec("node_modules/.bin/remotebuild certificates reset"))
                    .then(() => remotebuildIsolatedTest.promiseExec("node_modules/.bin/remotebuild certificates generate"))
                    .then(() => remotebuildIsolatedTest.promiseExec("ln -s $ORIGINALHOME/Library Library"))
                    .then(() => {
                        // Claim to have accepted homebrew installation already to avoid having to specify sudo password
                        var sourceStream = fs.createReadStream(path.join(__dirname, "taco-cli", ".taco-remote"));
                        var destStream = fs.createWriteStream(path.join(remotebuildIsolatedTest.rootFolder, ".taco_home", ".taco-remote"));
                        return Q.all([
                            testUtils.promiseFromStream(sourceStream.pipe(destStream)),
                            windowsSetup
                        ]);
                    }).then(() => {
                        // Read the client certificate PIN
                        var certs = fs.readdirSync(path.join(remotebuildIsolatedTest.rootFolder, ".taco_home", "remote-builds", "certs", "client"));
                        should(certs).property("length").be.greaterThan(0);
                        var pin = certs[0];

                        // Start the remotebuild server
                        remotebuildProcess = remotebuildIsolatedTest.spawn(path.join(remotebuildIsolatedTest.rootFolder, "node_modules", ".bin", "remotebuild"), [], { stdio: ["inherit", "inherit", "inherit"] });

                        // Determine this computer's IP address (Prefering ipv4 since ipv6 addresses do not work with security right now)
                        var networkInterfaces = os.networkInterfaces();
                        var addresses: { address: string, family: string }[] = networkInterfaces["en0"];
                        var ipv4Addresses = addresses.filter((addr) => addr.family === "IPv4");

                        // Configure the windows client to talk to this server
                        var remoteConfigCommand = util.format("node configureRemote.js node_modules/.bin/taco ios %s %d %d", ipv4Addresses[0].address, remotebuildMacPort, pin);
                        return testUtils.uploadFile(remoteTestWinServer, winTestId, "configureRemote.js", fs.createReadStream(path.join(__dirname, "taco-cli", "configureRemote.js"))).then(() => {
                            return testUtils.runCommandAndWaitForSuccess(remoteTestWinServer, winTestId, remoteConfigCommand);
                        }).then(() => {
                            // Ensure that we successfully configured an iOS remote
                            return testUtils.runCommandAndWaitForSuccess(remoteTestWinServer, winTestId, "node_modules/.bin/taco remote list").then((commandResult: testUtils.ICommand) => {
                                if (commandResult.result.indexOf("ios") < 0) {
                                    throw new Error("Failed to set remote iOS server");
                                }
                            });
                        });
                    })
            });

            after(function () {
                remotebuildProcess.kill();
                // Clean up idevicedebugserverproxy since starting remotebuild repeatedly can leave old processes around in a bad state sometimes
                return Q.all<any>([
                    remotebuildIsolatedTest.promiseExec("killall idevicedebugserverproxy"),
                    testUtils.requestPostPromise(testUtils.makeRequestOptions(remoteTestWinServer, {}, winTestId, "done"))
                ]);

            });

            it("should be able to launch an app on a device using remotebuild", function (): Q.Promise<any> {
                return Q({}).then(() => {
                    // Start listening for the app to callback
                    var deferred = Q.defer();
                    var appCallbackServer = http.createServer(function (req, res) {
                        var parsedUrl = url.parse(req.url);
                        console.info(req.url);
                        if (req.method === "GET" && parsedUrl.pathname === "/deviceready") {
                            res.end();
                            deferred.resolve({});
                        }
                        if (parsedUrl.pathname === "/failure") {
                            deferred.reject(req);
                        }
                    });

                    appCallbackServer.listen(appCallbackPort);

                    // Kick off a "taco run ios --device" and wait for it to complete
                    return testUtils.runCommandAndWaitForSuccess(remoteTestWinServer, winTestId, "../node_modules/.bin/taco run ios --device", "myProject")
                        .then(() => {
                            Q.delay(180000).then(() => deferred.reject("Timed out"));
                            return deferred.promise;
                        }).finally(() => {
                            appCallbackServer.close();
                        });
                });
            });


            it("should report emulation failures appropriately", function (): Q.Promise<any> {
                return Q({}).then(() => {

                    // Kick off a "taco run ios --emulator --target fakeDevice" and wait for it to complete
                    return testUtils.runCommandAndWait(remoteTestWinServer, winTestId, "../node_modules/.bin/taco run ios --target fakeDevice", "myProject")
                        .then((commandResult: testUtils.ICommand) => {
                            should(commandResult.status).equal("error");
                        });
                });
            });
        });

        /*
        // "cordova run ios --device" with cordova-ios < 4.X never terminates, and we can't even crash the app
        // to get it to close because it's attached a debugger to it which we can't communicate with via
        // the command line!
        it.skip("should be able to run an app on an iOS device", function () {
            // In this test we want to build and run an app in the iOS simulator
            // First we create a project
            return testUtils.runCommandsInSequence(remoteTestMacServer, macTestId, [
                "npm install build/packages/taco-cli",
                "node_modules/.bin/taco create myProject",
                "cd myProject && ../node_modules/.bin/taco plugin add cordova-plugin-transport-security",
                "cd myProject && ../node_modules/.bin/taco platform add ios",
                "ln -s $ORIGINALHOME/Library Library" // Device builds depend on ~/Library in order to find provisioning profiles
            ]).then(() => {
                // Extract a list of ip addresses
                return testUtils.runCommandAndWaitForSuccess(remoteTestMacServer, macTestId, "ifconfig -au inet | grep -o 'inet [0-9]\\+\\(\\.[0-9]\\+\\)\\{3\\}' | grep -o '[.0-9]\\+'");
            }).then((ipsCommandResult: testUtils.ICommand): Q.Promise<any> => {
                // Replace the index.html page with a page that calls back to the remote server
                var appCallback = fs.createReadStream(path.join(__dirname, "taco-cli", "appCallback.html"));
                var serverReplaceToken = "TEST_SERVER_REPLACE_TOKEN";
                var serverAddress = ipsCommandResult.result.split("\n").map((address: string): string => {
                    return util.format("\"http://%s:%d\"", address, 12345 + macTestId);
                }).join(", ");

                var replaceTransformer = testUtils.streamReplace(serverReplaceToken, serverAddress);
                appCallback.pipe(replaceTransformer);
                return testUtils.uploadFile(remoteTestMacServer, macTestId, "myProject/www/index.html", replaceTransformer);
            }).then(() => {
                // Add the appCrash plugin
                return Q.all([
                    testUtils.uploadFile(remoteTestMacServer, macTestId, "appCrashPlugin/crash.js", fs.createReadStream(path.join(__dirname, "taco-cli", "appCrashPlugin", "crash.js"))),
                    testUtils.uploadFile(remoteTestMacServer, macTestId, "appCrashPlugin/plugin.xml", fs.createReadStream(path.join(__dirname, "taco-cli", "appCrashPlugin", "plugin.xml"))),
                    testUtils.uploadFile(remoteTestMacServer, macTestId, "appCrashPlugin/src/ios/crash.m", fs.createReadStream(path.join(__dirname, "taco-cli", "appCrashPlugin", "src", "ios", "crash.m"))),
                    testUtils.uploadFile(remoteTestMacServer, macTestId, "appCrashPlugin/src/ios/crash.h", fs.createReadStream(path.join(__dirname, "taco-cli", "appCrashPlugin", "src", "ios", "crash.h")))
                ]).then(() => {
                    return testUtils.runCommandAndWaitForSuccess(remoteTestMacServer, macTestId, "../node_modules/.bin/taco plugin add ~/appCrashPlugin", "myProject");
                });
            }).then(() => {
                // Run a script on the remote server
                var replaceTransformer = testUtils.streamReplace("TACO_APP_CALLBACK_PORT", 12345 + macTestId);
                fs.createReadStream(path.join(__dirname, "taco-cli", "appCallback.js")).pipe(replaceTransformer);
                return testUtils.uploadFile(remoteTestMacServer, macTestId, "appCallback.js", replaceTransformer);
            }).then(() => {
                return testUtils.startCommand(remoteTestMacServer, macTestId, "../node_modules/.bin/taco run ios --device", "myProject");
            }).then((response: testUtils.IRequestResult) => {
                if (response.response.statusCode !== 200) {
                    throw new Error("Unable to start 'taco run ios -device'");
                }
                var commandResult = <testUtils.ICommand>JSON.parse(response.body);

                // We pass a larger timeout here because launching on a device can be super slow
                return testUtils.runCommandAndWaitForSuccess(remoteTestMacServer, macTestId, "node appCallback.js 180000").finally(() => {
                    // "run ios --device" does not terminate the process, so we must clean up after ourselves
                    return testUtils.pollForCommandFinish(remoteTestMacServer, macTestId, commandResult.id);
                });
            });
        });*/
    });
    // TODO: test typescript template
});
