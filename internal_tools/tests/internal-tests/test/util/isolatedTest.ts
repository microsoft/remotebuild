/// <reference path="../../../typings/node.d.ts" />
/// <reference path="../../../typings/q.d.ts" />
/// <reference path="../../../typings/rimraf.d.ts" />

"use strict";

import child_process = require("child_process");
import fs = require("fs");
import mkdirp = require("mkdirp");
import path = require("path");
import Q = require("q");
import rimraf = require("rimraf");

class IsolatedTest {
    public rootFolder: string;

    private static TestRoot: string = path.join("/", "tmp", "taco-test-agent");
    private static TestCount: number = IsolatedTest.nextTest();

    private env: typeof process.env;
    private testId: number;

    private runCommands: child_process.ChildProcess[];

    constructor() {
        this.testId = IsolatedTest.TestCount++;
        this.rootFolder = path.join(IsolatedTest.TestRoot, "" + this.testId);
        this.runCommands = [];
        mkdirp.sync(this.rootFolder);
        this.env = {
            ORIGINALHOME: process.env.HOME,
            HOME: this.rootFolder,
            ORIGINALAPDATA: process.env.APPDATA,
            APPDATA: this.rootFolder
        };
    }

    private static nextTest(): number {
        try {
            var folders = fs.readdirSync(IsolatedTest.TestRoot);
            var highest = folders.map((folder: string): number => parseInt(folder, 0))
                .filter((num: number): boolean => !isNaN(num))
                .sort((a: number, b: number): number => b - a)[0] || 0;
            return highest + 1;
        } catch (e) {
            return 1;
        }
    }

    public cleanup(cleanFolder: boolean): Q.Promise<any> {
        this.runCommands.forEach((proc: child_process.ChildProcess) => proc && proc.kill());
        if (cleanFolder) {
            return Q.denodeify(rimraf)(this.rootFolder);
        } else {
            return Q({});
        }
    }

    public exec(command: string, options: child_process.IExecOptions, cb: (err: Error, stdout: Buffer, stderr: Buffer) => void): child_process.ChildProcess {
        options = JSON.parse(JSON.stringify(options)) || {}; // Take a copy
        options.env = options.env || {};
        options.env.__proto__ = process.env; // Include all our environment, except what we have explicitly replaced
        Object.keys(this.env).forEach((key: string) => {
            options.env[key] = this.env[key];
        });
        if (options.cwd && options.cwd.charAt(0) !== "/") { // Treat relative paths as relative to the test root
            options.cwd = path.join(this.rootFolder, options.cwd);
        } else if (!options.cwd) {
            options.cwd = this.rootFolder;
        }
        console.info(command);
        var proc = child_process.exec(command, options, cb);
        this.runCommands.push(proc);
        return proc;
    }

    public promiseExec(command: string, options: child_process.IExecOptions = {}): Q.Promise<{ stdout: Buffer, stderr: Buffer }> {
        var deferred = Q.defer<{ stdout: Buffer, stderr: Buffer }>();
        this.exec(command, options, (err: Error, stdout: Buffer, stderr: Buffer): void => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve({ stdout: stdout, stderr: stderr });
            }
        });
        return deferred.promise;
    }

    public spawn(command: string, args: string[], options: IsolatedTest.ISpawnOptions): child_process.ChildProcess {
        options = JSON.parse(JSON.stringify(options)) || {}; // Take a copy
        options.env = options.env || {};
        options.env.__proto__ = process.env; // Include all our environment, except what we have explicitly replaced
        Object.keys(this.env).forEach((key: string) => {
            options.env[key] = this.env[key];
        });
        var proc = child_process.spawn(command, args, options);
        this.runCommands.push(proc);
        return proc;
    }
}

module IsolatedTest {
    export interface ISpawnOptions {
        cwd?: string;
        stdio?: any;
        custom?: any;
        env?: any;
        detached?: boolean;
        uid?: Number; // See https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options. See https://github.com/Microsoft/TACO/issues/18
        gid?: Number; // See https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options. See https://github.com/Microsoft/TACO/issues/18
    }
}

export = IsolatedTest;