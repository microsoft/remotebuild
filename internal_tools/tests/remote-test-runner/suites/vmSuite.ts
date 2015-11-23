/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/q.d.ts" />
/// <reference path="../typings/remoteTestRunnerInterfaces.d.ts" />

"use strict";

import Q = require("q");

import RemoteSuite = require("./remoteSuite");
import VMUtils = require("../utils/vmUtils");

import ISuiteBuildOptions = RemoteTestRunnerInterfaces.ISuiteBuildOptions;
import IVMSuiteBuildOptions = RemoteTestRunnerInterfaces.IVMSuiteBuildOptions;
import IVMInfo = VMUtils.IVMInfo;

class VMSuite extends RemoteSuite {
    private vmInfo: IVMInfo;
    private vmTemplate: string;
    private vmStartupPort: string;
    private keepVmOnTestPass: boolean;
    private cloneVm: boolean;

    public constructor(files: string[], testPath: string, vmTemplate: string, vmStartupPort: string, buildOptions?: IVMSuiteBuildOptions) {
        // For the VM suite, we will only know the remote IP and the remotebuild test agent port after we launch the VM, so initialize the RemoteSuite base class with empty values
        super(files, testPath, "", "", buildOptions);

        this.vmTemplate = vmTemplate;
        this.vmStartupPort = vmStartupPort;

        // Check build options
        this.keepVmOnTestPass = buildOptions.hasOwnProperty("keepVmOnTestPass") ? buildOptions.keepVmOnTestPass : false;
        this.cloneVm = buildOptions.hasOwnProperty("cloneVm") ? buildOptions.cloneVm : true;
    }

    protected setup(): Q.Promise<any> {
        // Launch a new VM based on the specified template
        return VMUtils.launchNewVMWithRemotebuild(this.vmTemplate, this.vmStartupPort, this.cloneVm).then((vmInfo: IVMInfo) => {
            this.vmInfo = vmInfo;
            this.remoteIp = vmInfo.remotebuildInfo.ip;
            this.remotePort = vmInfo.remotebuildInfo.port;
        }).then(() => {
            // Now that a new VM is running, this suite is just a normal remote suite
            return super.setup();
        });
    }

    protected launch(): Q.Promise<any> {
        // Launch the tests normally as if this was a remote suite
        return super.launch().then(() => {
            // Tests passed, so delete the VM, UNLESS:
            //     -cloneVm is false (which means we are in the original VM)
            //         or
            //     -keepVmOnTestPass is true
            if (!this.cloneVm || this.keepVmOnTestPass) {
                return Q.resolve({});
            }

            return VMUtils.deleteVm(this.vmInfo.name);
        }, (err: any) => {
            // Tests failed, so save the VM's state and then propagate the error
            return VMUtils.saveState(this.vmInfo.name).then(() => {
                return Q.reject(err);
            });
        });
    }
}

export = VMSuite;