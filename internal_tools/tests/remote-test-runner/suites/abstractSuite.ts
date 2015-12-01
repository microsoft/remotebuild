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
    protected timeout: number;

    public get identifier(): string {
        return AbstractSuite.getIdentifier(this.id, this.name);
    }

    public get suiteTimeout(): number {
        return this.timeout;
    }

    public constructor(id: number, files: string[], testPath: string, options?: ISuiteBuildOptions) {
        this.id = id;
        this.testFiles = files;
        this.testPackage = testPath;

        // Check build options
        if (options) {
            this.mochaReporter = options.mochaReporter || "";
            this.name = options.name || "";
            this.setupScript = options.setupScript || "";
            this.sourcesPath = options.sourcesPath || "";
            this.timeout = options.timeout || 0;
        }
    }

    public run(): Q.Promise<any> {
        var runPromise: Q.Promise<any> = this.setup().then(() => {
            return this.launch();
        });

        if (this.timeout) {
            runPromise = runPromise.timeout(this.timeout);
        }

        return runPromise.finally(() => {
            return this.cleanup();
        });
    }

    protected setup(): Q.Promise<any> {
        // Default implementation is no-op
        return Q.resolve({});
    }

    protected cleanup(): Q.Promise<any> {
        // Default implementation is no-op
        return Q.resolve({});
    }

    protected abstract launch(): Q.Promise<any>;
}

export = AbstractSuite;