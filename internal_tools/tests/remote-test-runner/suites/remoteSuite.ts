/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/q.d.ts" />
/// <reference path="../typings/remoteTestRunnerInterfaces.d.ts" />

"use strict";

import util = require("util");

import Q = require("q");

import AbstractSuite = require("./abstractSuite");

import ISuiteBuildOptions = RemoteTestRunnerInterfaces.ISuiteBuildOptions;

class RemoteSuite extends AbstractSuite {
    protected remoteIp: string;
    protected remotePort: string;

    public get remotebuildTestUrl(): string {
        return util.format("http://[%s]:%s/test", this.remoteIp, this.remotePort);
    }

    public constructor(files: string[], testPath: string, ip: string, port: string, buildOptions?: ISuiteBuildOptions) {
        super(files, testPath, buildOptions);
        this.remoteIp = ip;
        this.remotePort = port;
    }

    public constructor(files: string[], testPath: string, ip: string, port: string, buildOptions?: ISuiteBuildOptions) {
        super(files, testPath, buildOptions);
        this.remoteIp = ip;
        this.remotePort = port;
    }

    protected setup(): Q.Promise<any> {
        // Connect to the remotebuild test agent

        // NPM pack the test folder

        // Upload the test folder

        // Upload the sources folder if necessary

        // NPM install the test folder

        // Run the setup script if necessary


        throw new Error("Not implemented");
    }

    protected launch(): Q.Promise<any> {
        // Invoke mocha remotely and wait for the command to finish

        // Print the output of the mocha command to stdout


        throw new Error("Not implemented");
    }
}

export = RemoteSuite;