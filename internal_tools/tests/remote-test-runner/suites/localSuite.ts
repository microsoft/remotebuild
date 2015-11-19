/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/q.d.ts" />
/// <reference path="../typings/remoteTestRunnerInterfaces.d.ts" />

"use strict";

import Q = require("q");

import AbstractSuite = require("./abstractSuite");

import ISuiteBuildOptions = RemoteTestRunnerInterfaces.ISuiteBuildOptions;

class LocalSuite extends AbstractSuite {
    public constructor(files: string[], testPath: string, buildOptions?: ISuiteBuildOptions) {
        super(files, testPath, buildOptions);
    }

    protected launch(): Q.Promise<any> {
        throw new Error("Not implemented");
    }
}

export = LocalSuite;