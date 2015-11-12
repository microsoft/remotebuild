/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/q.d.ts" />
/// <reference path="../typings/remoteTestRunnerInterfaces.d.ts" />

"use strict";

import Q = require("q");

import AbstractSuite = require("./abstractSuite");

class LocalSuite extends AbstractSuite {
    public constructor(files: string[]) {
        super(files);
    }

    protected launch(): Q.Promise<any> {
        throw new Error("Not implemented");
    }
}

export = LocalSuite;