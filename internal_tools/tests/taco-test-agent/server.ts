/// <reference path="../typings/remotebuild.d.ts" />
/// <reference path="../typings/express.d.ts" />
/// <reference path="../typings/Q.d.ts" />
/// <reference path="../typings/mkdirp.d.ts" />
/// <reference path="../typings/rimraf.d.ts" />

"use strict";

import child_process = require("child_process");
import express = require("express");
import fs = require("fs");
import mkdirp = require("mkdirp");
import path = require("path");
import Q = require("q");
import rimraf = require("rimraf");

class TestAgentFactory implements RemoteBuild.IServerModuleFactory {
    public create(remoteBuildConf: RemoteBuild.IRemoteBuildConfiguration,
        moduleConfig: RemoteBuild.IServerModuleConfiguration,
        serverCapabilities: RemoteBuild.IServerCapabilities
        ): Q.Promise<TestAgentServer> {
        return Q(new TestAgentServer());
    }

    public test(): Q.Promise<any> {
        return Q({});
    }

    public printHelp(): void {
        console.info("taco-test-agent is intended only for internal use, allowing remote control of a test machine. It is in no way secured for general purpose use.");
    }

    public getConfig(remoteBuildConf: RemoteBuild.IRemoteBuildConfiguration,
        moduleConfig: RemoteBuild.IServerModuleConfiguration): RemoteBuild.IServerModuleConfiguration {
        return moduleConfig;
    }
}

interface ICommand {
    id: number;
    status: string;
    command: string;
    result: string;
    stderr?: string;
    code?: number;
    signal?: string;
    timeTaken?: number;

    proc: child_process.ChildProcess;
}

interface ITest {
    id: number;
    folder: string;
    commands: { [commandId: number]: ICommand };
    nextCommand: number;
}

type IHandler = (req: express.Request, res: express.Response) => void;

class TestAgentServer implements RemoteBuild.IServerModule {
    private tests: { [testId: number]: ITest };
    private nextId: number;
    private basePath: string;
    private deletionQueue: number[];
    private testsToKeep: number = 10;

    constructor() {
        this.tests = {};
        this.deletionQueue = [];
        this.basePath = path.join(process.env.HOME || process.env.APPDATA, "taco-test-agent");
        mkdirp.sync(this.basePath);
        var folders = fs.readdirSync(this.basePath);
        var sortedFolders = folders.map((folder: string): number => parseInt(folder, 10))
            .sort((l: number, r: number): number => r - l);
        // Pick the next number higher than the highest we find
        this.nextId = (sortedFolders[0] || 0) + 1;
        console.info("Starting with test #" + this.nextId);
    }

    public getRouter(): Express.Router {
        var router = express.Router();
        router.post("/test", this.newTest());
        router.get("/test/:id", this.getTest());
        router.post("/test/:id/keep", this.keepTest());
        router.post("/test/:id/delete", this.deleteTest());
        router.post("/test/:id/done", this.finishTest());
        router.post("/test/:id/file", this.putFile());
        router.get("/test/:id/file", this.getFile());
        router.post("/test/:id/command", this.newCommand());
        router.post("/test/:id/command/:command/kill", this.killCommand());
        router.get("/test/:id/command/:command", this.getCommand());
        return router;
    }

    public shutdown(): void {
        // Clean up base path folder?
        // Or leave it there so we can analyse test results?
    }

    private cleanUpRunningProcesses(test: ITest): void {
        // Terminate any pending commands in case a test didn't clean up
        Object.keys(test.commands).forEach((commandId: string): void => {
            var command = test.commands[parseInt(commandId, 10)];
            if (command.proc) {
                command.proc.kill();
            };
        });
    }

    private cleanAndDeleteTest(testToDelete: number): void {
        var test = this.tests[testToDelete];
        if (test) {
            delete this.tests[testToDelete];
            rimraf(test.folder, function (err: Error) {
                console.warn(err);
            });

            this.cleanUpRunningProcesses(test);
        }
    };

    private newTest(): IHandler {
        return (req: express.Request, res: express.Response) => {
            var id = this.nextId++;
            var testPath = path.join(this.basePath, "" + id);
            mkdirp.sync(testPath);
            this.tests[id] = {
                id: id,
                commands: {},
                folder: testPath,
                nextCommand: 1
            };
            res.status(200).json(this.tests[id]);

            this.deletionQueue.push(id);
            // Clean up tests if we have too many hanging around.
            while (this.deletionQueue.length > this.testsToKeep) {
                var testToDelete = this.deletionQueue.shift();
                this.cleanAndDeleteTest(testToDelete);
            }
        }
    }

    private getTest(): IHandler {
        return (req: express.Request, res: express.Response) => {
            var id = req.params.id;
            if (this.tests[id]) {
                res.status(200).json(this.tests[id]);
            } else {
                res.sendStatus(404);
            }
        };
    }

    private keepTest(): IHandler {
        return (req: express.Request, res: express.Response) => {
            var id = req.params.id;
            if (this.tests[id]) {
                var index = this.deletionQueue.indexOf(parseInt(id, 10));
                if (index >= 0) {
                    this.deletionQueue.splice(index, 1);
                }
                res.status(200).json(this.tests[id]);
            } else {
                res.sendStatus(404);
            }
        };
    }

    private finishTest(): IHandler {
        return (req: express.Request, res: express.Response) => {
            var id = req.params.id;
            if (this.tests[id]) {
                this.cleanUpRunningProcesses(this.tests[id]);
                res.status(200).json(this.tests[id]);
            } else {
                res.sendStatus(404);
            }
        };
    }

    private deleteTest(): IHandler {
        return (req: express.Request, res: express.Response) => {
            var id = req.params.id;
            if (this.tests[id]) {
                var index = this.deletionQueue.indexOf(parseInt(id, 10));
                if (index >= 0) {
                    this.deletionQueue.splice(index, 1);
                }
                this.cleanAndDeleteTest(parseInt(id, 10));
                res.sendStatus(200);
            } else {
                res.sendStatus(404);
            }
        };
    }

    private putFile(): IHandler {
        return (req: express.Request, res: express.Response) => {
            var id = req.params.id;
            if (!this.tests[id]) {
                res.sendStatus(404);
                return;
            }
            var destination = path.join(this.tests[id].folder, req.query.path);
            var folder = path.dirname(destination);
            mkdirp.sync(folder);
            var toStream = fs.createWriteStream(destination);
            req.pipe(toStream).on("finish", () => {
                res.sendStatus(200);
            }).on("error", (err: Error) => {
                res.status(500).end(err.toString());
            });
        }
    }

    private getFile(): IHandler {
        return (req: express.Request, res: express.Response) => {
            var id = req.params.id;
            if (!this.tests[id]) {
                res.sendStatus(404);
                return;
            }
            var source = path.join(this.tests[id].folder, req.query.path);
            if (!fs.existsSync(source)) {
                res.sendStatus(404);
                return;
            }
            var fromStream = fs.createReadStream(source);
            fromStream.pipe(res);
        };
    }

    private newCommand(): IHandler {
        return (req: express.Request, res: express.Response) => {
            var id = req.params.id;
            if (!this.tests[id]) {
                res.sendStatus(404);
                return;
            }
            var command = req.query.cmd;
            var cwd = req.query.cwd;
            var commandid = this.tests[id].nextCommand++
            var cmd: ICommand = this.tests[id].commands[commandid] = {
                id: commandid,
                status: "started",
                command: command,
                result: "",
                proc: null
            };
            // We don't want to include the process when we JSON.stringify
            // even though we do want the value to stick around
            Object.defineProperty(cmd, "proc", {
                enumerable: false
            });
            var env: typeof process.env = {
                TEST_ID: id,
                ORIGINALHOME: process.env.HOME,
                HOME: this.tests[id].folder,
                ORIGINALAPDATA: process.env.APPDATA,
                APPDATA: this.tests[id].folder
            };
            env.__proto__ = process.env;

            cwd = path.join(this.tests[id].folder, cwd || "");

            var startTime = process.hrtime();
            cmd.proc = child_process.exec(command.split("/").join(path.sep), { cwd: cwd, env: env }, (err: Error, stdout: Buffer, stderr: Buffer) => {
                if (err) {
                    cmd.status = "error";
                } else {
                    cmd.status = "done";
                }
                cmd.result = stdout.toString();
                cmd.stderr = stderr.toString();
            });
            cmd.proc.on("exit", function (code: number, signal: string) {
                if (code) {
                    cmd.status = "error";
                }
                cmd.code = code;
                cmd.signal = signal;

                var timeTaken = process.hrtime(startTime);
                cmd.timeTaken = timeTaken[0] * 1000 + timeTaken[1] / 1000000;
            });
            res.status(200).json(this.tests[id].commands[commandid]);
        }
    }

    private killCommand(): IHandler {
        return (req: express.Request, res: express.Response) => {
            var id = req.params.id;
            var command = req.params.command;
            if (this.tests[id] && this.tests[id].commands[command]) {
                console.info("Killing " + this.tests[id].commands[command].proc.pid + " with " + (req.query.signal || "default"));
                if (req.query.signal) {
                    this.tests[id].commands[command].proc.kill(req.query.signal);
                } else {
                    this.tests[id].commands[command].proc.kill();
                }
                res.sendStatus(200);
            } else {
                res.sendStatus(404);
            }
        }
    }

    private getCommand(): IHandler {
        return (req: express.Request, res: express.Response) => {
            var id = req.params.id;
            var command = req.params.command;
            if (this.tests[id] && this.tests[id].commands[command]) {
                res.status(200).json(this.tests[id].commands[command]);
            } else {
                res.sendStatus(404);
            }
        };
    }
}

export = new TestAgentFactory();
