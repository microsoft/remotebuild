/// <reference path="../../../typings/node.d.ts" />
/// <reference path="../../../typings/q.d.ts" />
/// <reference path="../../../typings/rimraf.d.ts" />

"use strict";

import Q = require("q");
import util = require("util");

import testUtils = require("./utils");

module RemoteTest {
    export class RemoteCommand {
        private baseUrl: string;
        private testId: number;
        public command: testUtils.ICommand;

        constructor(baseUrl: string, testId: number, command: testUtils.ICommand) {
            this.baseUrl = baseUrl;
            this.testId = testId;
            this.command = command;
        }

        public pollForFinish(): Q.Promise<RemoteCommand> {
            return testUtils.pollForCommandFinish(this.baseUrl, this.testId, this.command.id).then((result: testUtils.ICommand): RemoteCommand => {
                this.command = result;
                return this;
            });
        }

        public kill(signal?: string): Q.Promise<any> {
            return testUtils.killCommand(this.baseUrl, this.testId, this.command.id, signal);
        }
    }

    export class RemoteTest {
        private baseUrl: string;
        private testId: number;

        private initializationPromise: Q.Promise<any>;

        constructor(baseUrl: string) {
            this.baseUrl = baseUrl;

            this.initializationPromise = testUtils.requestPostPromise(testUtils.makeRequestOptions(baseUrl, {})).then((response: testUtils.IRequestResult) => {
                if (response.response.statusCode != 200) {
                    throw new Error("Failed to instantiate new remote test");
                } else {
                    var test = <testUtils.ITest>JSON.parse(response.body);
                    this.testId = test.id;
                    console.info("Configuring remote test as #" + test.id);
                }
            })
        }

        public get ready(): Q.Promise<any> {
            return this.initializationPromise;
        }

        public cleanup(): Q.Promise<any> {
            if (this.testId) {
                return testUtils.requestPostPromise(testUtils.makeRequestOptions(this.baseUrl, {}, this.testId, "done"))
            }
            return Q({});
        }

        public uploadFile(fileStream: NodeJS.ReadableStream, destination: string): Q.Promise<any> {
            return testUtils.uploadFile(this.baseUrl, this.testId, destination, fileStream);
        }

        public downloadFile(source: string, destination: string): Q.Promise<void> {
            return testUtils.downloadFile(this.baseUrl, this.testId, source, destination);
        }

        public startCommand(command: string, cwd?: string): Q.Promise<RemoteCommand> {
            return testUtils.startCommand(this.baseUrl, this.testId, command, cwd).then((response: testUtils.IRequestResult): RemoteCommand => {
                if (response.response.statusCode === 200) {
                    var command = <testUtils.ICommand>JSON.parse(response.body);
                    return new RemoteCommand(this.baseUrl, this.testId, command);
                } else {
                    throw response.response;
                }
            });
        }

        public runCommandAndWait(command: string, cwd?: string): Q.Promise<RemoteCommand> {
            return this.startCommand(command, cwd).then((command: RemoteCommand) => {
                return command.pollForFinish();
            })
        }

        public runCommandAndWaitForSuccess(cmd: string, cwd?: string): Q.Promise<RemoteCommand> {
            return this.runCommandAndWait(cmd, cwd).then((command: RemoteCommand) => {
                if (command.command.status === "error") {
                    throw new Error(util.format("Command %s failed: %s\n\n%s", command.command.command, command.command.result, command.command.stderr));
                }
                return command;
            });
        }

        public runCommandsInSequence(commands: string[]): Q.Promise<any> {
            return testUtils.runCommandsInSequence(this.baseUrl, this.testId, commands);
        }
    }
}

export = RemoteTest;