/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/q.d.ts" />
/// <reference path="../typings/remoteTestRunnerInterfaces.d.ts" />

"use strict";

import Q = require("q");

import RemoteSuite = require("./remoteSuite");

import ISuiteBuildOptions = RemoteTestRunnerInterfaces.ISuiteBuildOptions;

class VMSuite extends RemoteSuite {
    private vmTemplate: string;
    private vmStartupPort: string;

    public constructor(files: string[], testPath: string, vmTemplate: string, vmStartupPort: string = "3030", buildOptions?: ISuiteBuildOptions) {
        // For the VM suite, we will only know the remote IP and the remotebuild test agent port after we launch the VM, so initialize these members with empty values
        super(files, testPath, "", "", buildOptions);

        this.vmTemplate = vmTemplate;
        this.vmStartupPort = vmStartupPort;
    }

    protected setup(): Q.Promise<any> {
        // Launch a new VM based on the specified template

        // Now that a new VM is running, this suite is just a normal remote suite


        throw new Error("Not implemented");
    }

    protected launch(): Q.Promise<any> {
        throw new Error("Not implemented");
    }
}

export = VMSuite;