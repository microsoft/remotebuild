/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/q.d.ts" />
/// <reference path="../typings/remoteTestRunnerInterfaces.d.ts" />

"use strict";

import Q = require("q");

import ISuiteBuildOptions = RemoteTestRunnerInterfaces.ISuiteBuildOptions;

abstract class AbstractSuite {
    protected testFiles: string[];
    protected testPackage: string;
    protected mochaReporter: string;
    protected setupScript: string;
    protected sourcesPath: string;

    public constructor(files: string[], testPath: string, options?: ISuiteBuildOptions) {
        this.testFiles = files;
        this.testPackage = testPath;

        // Check build options
        this.mochaReporter = options && options.mochaReporter || "";
        this.setupScript = options && options.setupScript || "";
        this.sourcesPath = options && options.sourcesPath || "";
    }

    public run(): Q.Promise<any> {
        return this.setup().then(() => {
            return this.launch();
        });
    }

    protected setup(): Q.Promise<any> {
        // Default implementation is no-op
        return Q.resolve({});
    }

    protected abstract launch(): Q.Promise<any>;
}

export = AbstractSuite;