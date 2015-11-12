/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/Q.d.ts" />
/// <reference path="../typings/request.d.ts" />

"use strict";

import child_process = require("child_process");
import fs = require("fs");
import Q = require("q");
import request = require("request");
import stream = require("stream");
import util = require("util");

class RemotebuildUtils {
    /**
     * Helper function to convert a request.get into a promise
     */
    public static requestGetPromise(options: request.Options): Q.Promise<TestUtils.IRequestResult> {
        var deferred = Q.defer<any>();

        request.get(options, (error: any, response: any, body: any): void => {
            if (error) {
                deferred.reject(error);
            } else {
                deferred.resolve({ response: response, body: body });
            }
        });
        return deferred.promise;
    }

    /**
     * Helper function to convert a request.post into a promise
     */
    public static requestPostPromise(options: request.Options): Q.Promise<TestUtils.IRequestResult> {
        var deferred = Q.defer<any>();

        request.post(options, (error: any, response: any, body: any): void => {
            if (error) {
                deferred.reject(error);
            } else {
                deferred.resolve({ response: response, body: body });
            }
        });
        return deferred.promise;
    }

    public static makeRequestOptions(baseUrl: string, options: request.Options, testId?: number, path?: string): request.Options {
        if (testId) {
            options.url = util.format("%s/test/%d/%s", baseUrl, testId, path);
        } else {
            options.url = util.format("%s/test", baseUrl);
        }
        return options;
    }

    /**
     * Upload a given ReadableStream to a file on the remote server.
     */
    public static uploadFile(baseUrl: string, testId: number, destination: string, fileStream: NodeJS.ReadableStream): Q.Promise<TestUtils.IRequestResult> {
        var deferred = Q.defer<any>();

        fileStream.pipe(request.post(RemotebuildUtils.makeRequestOptions(baseUrl, { qs: { path: destination } }, testId, "file"), (error: any, response: any, body: any): void => {
            if (error) {
                deferred.reject(error);
            } else {
                deferred.resolve({ response: response, body: body });
            }
        }));
        return deferred.promise;
    }

    /**
     * Download file to a given location
     */
    public static downloadFile(baseUrl: string, testId: number, source: string, destination: string): Q.Promise<void> {
        var options: request.Options = {
            qs: { path: source }
        };
        var fileStream = fs.createWriteStream(destination);
        var deferred = Q.defer<void>();
        request.get(RemotebuildUtils.makeRequestOptions(baseUrl, options, testId, "file"))
            .on("error", (error: any) => { deferred.reject(error); })
            .pipe(fileStream)
            .on("finish", () => { deferred.resolve(void 0); });

        return deferred.promise;
    }

    public static pollForCommandFinish(baseUrl: string, testId: number, commandId: number): Q.Promise<TestUtils.ICommand> {
        return RemotebuildUtils.requestGetPromise(RemotebuildUtils.makeRequestOptions(baseUrl, {}, testId, "command/" + commandId)).then((response: TestUtils.IRequestResult): TestUtils.ICommand | Q.Promise<TestUtils.ICommand> => {
            if (response.response.statusCode === 200) {
                var commandResult = <TestUtils.ICommand>JSON.parse(response.body);
                if (commandResult.status !== "started") {
                    return commandResult;
                } else {
                    return Q.delay(1000).then(() => RemotebuildUtils.pollForCommandFinish(baseUrl, testId, commandId));
                }
            } else {
                throw response.response;
            }
        })
    }

    public static startCommand(baseUrl: string, testId: number, command: string, cwd?: string): Q.Promise<TestUtils.IRequestResult> {
        console.info(baseUrl + "\tRunning command: " + command);
        var qs: { cmd: string; cwd?: string } = { cmd: command };
        if (cwd) {
            qs.cwd = cwd;
        }
        return RemotebuildUtils.requestPostPromise(RemotebuildUtils.makeRequestOptions(baseUrl, { qs: qs }, testId, "command"))
    }

    public static killCommand(baseUrl: string, testId: number, commandId: number, signal?: string): Q.Promise<TestUtils.ICommand> {
        var options: request.Options;
        if (signal) {
            options = {};
        } else {
            options = {
                qs: { signal: signal }
            };
        }
        console.log("Killing command #" + commandId);
        return RemotebuildUtils.requestPostPromise(RemotebuildUtils.makeRequestOptions(baseUrl, options, testId, "command/" + commandId + "/kill"))
            .then((response: TestUtils.IRequestResult): Q.Promise<TestUtils.ICommand> => {
                if (response.response.statusCode === 200) {
                    return RemotebuildUtils.pollForCommandFinish(baseUrl, testId, commandId);
                } else {
                    throw response.response;
                }
            });
    }

    public static runCommandAndWait(baseUrl: string, testId: number, command: string, cwd?: string): Q.Promise<TestUtils.ICommand> {
        return RemotebuildUtils.startCommand(baseUrl, testId, command, cwd)
            .then((response: TestUtils.IRequestResult): Q.Promise<TestUtils.ICommand> => {
                if (response.response.statusCode !== 200) {
                    throw new Error("Error in command " + command);
                }
                var cmd = <TestUtils.ICommand>JSON.parse(response.body);
                return RemotebuildUtils.pollForCommandFinish(baseUrl, testId, cmd.id);
            });
    }

    /**
     * Submit a command to run on the remote server, and wait for it to complete.
     * If the command fails, then return a rejected promise, otherwise return a resolved promise.
     */
    public static runCommandAndWaitForSuccess(baseUrl: string, testId: number, cmd: string, cwd?: string): Q.Promise<TestUtils.ICommand> {
        return RemotebuildUtils.runCommandAndWait(baseUrl, testId, cmd, cwd).then((command: TestUtils.ICommand): TestUtils.ICommand => {
            if (command.status === "error") {
                throw new Error(util.format("Command %s failed: %s\n\n%s", cmd, command.result, command.stderr));
            }
            return command;
        });
    }

    /**
     * Run a sequence of command on the remote server expecting them all to succeed.
     */
    public static runCommandsInSequence(baseUrl: string, testId: number, commands: string[]): Q.Promise<any> {
        return commands.reduce((previous: Q.Promise<any>, cmd: string): Q.Promise<any> => {
            return previous.then(() => RemotebuildUtils.runCommandAndWaitForSuccess(baseUrl, testId, cmd));
        }, Q({}));
    };

    /**
     * A streaming string replace, for modifying files in-flight.
     */
    public static streamReplace(token: string, replace: string): NodeJS.ReadWriteStream {
        var replaceTransformer = new stream.Transform();
        var replaceRegex = new RegExp(token, "g");
        replaceTransformer._transform = function (chunk: any, encoding: string, next: Function): void {
            // Since we are given chunks with no guarantees about where the chunk breaks occur, 
            // split the input into lines and delay processing the last line until more input
            // arrives or input is over
            var input: string = chunk.toString();
            var lines: string[] = input.split("\n");
            if (this.partialLine) {
                lines[0] = this.partialLine + lines[0];
            }
            this.partialLine = lines.pop();

            lines.forEach((line: string): void => {
                this.push(line.replace(token, replace) + "\n");
            });
            next();
        }
        replaceTransformer._flush = function (done: Function): void {
            if (this.partialLine) {
                this.push(this.partialLine.replace(replaceRegex, replace));
            }

            done();
        }

        return replaceTransformer;
    }

    public static stringStream(content: string): NodeJS.ReadableStream {
        var result = new stream.Readable();
        result._read = function () { }; // no-op
        result.push(content);
        result.push(null);
        return result;
    }

    public static promiseFromStream(stream: NodeJS.ReadableStream | NodeJS.WritableStream): Q.Promise<any> {
        var deferred = Q.defer();
        stream.on("end", function (): void {
            deferred.resolve({});
        });
        stream.on("finish", function (): void {
            deferred.resolve({});
        });
        stream.on("error", function (err: Error): void {
            deferred.reject(err);
        });
        return deferred.promise;
    }

    public static isPortValid(port: string): boolean {
        var portNumber = parseInt(port);

        if (isNaN(portNumber) || portNumber <= 0 || portNumber > 65535) {
            return false;
        }

        return true;
    }
}

module TestUtils {
    export interface IResponse {
        statusCode: number
    }

    export interface IRequestResult {
        response: IResponse,
        body: any
    }

    export interface ICommand {
        id: number;
        status: string;
        command: string;
        result: string;
        stderr?: string;
    }

    export interface ITest {
        id: number;
        folder: string;
        commands: { [commandId: number]: ICommand };
        nextCommand: number;
    }
}

export = RemotebuildUtils;
