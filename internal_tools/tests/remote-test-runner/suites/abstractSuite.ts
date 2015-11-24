/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/q.d.ts" />
/// <reference path="../typings/remoteTestRunnerInterfaces.d.ts" />

"use strict";

import util = require("util");

import Q = require("q");

import ISuiteBuildOptions = RemoteTestRunnerInterfaces.ISuiteBuildOptions;

abstract class AbstractSuite {
    public static getIdentifier(id: number, name: string): string {
        var displayName: string = name ? util.format(" '%s'", name) : "";

        return util.format("#%d%s", id, displayName);
    }

    protected id: number;
    protected testFiles: string[];
    protected testPackage: string;
    protected mochaReporter: string;
    protected setupScript: string;
    protected sourcesPath: string;
    protected name: string;

    public get identifier(): string {
        return AbstractSuite.getIdentifier(this.id, this.name);
    }

    public constructor(id: number, files: string[], testPath: string, options?: ISuiteBuildOptions) {
        this.id = id;
        this.testFiles = files;
        this.testPackage = testPath;

        // Check build options
        this.mochaReporter = options && options.mochaReporter || "";
        this.name = options && options.name || "";
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