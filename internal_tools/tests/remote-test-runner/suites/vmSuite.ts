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
    private mustCloneVM: boolean;

    public constructor(id: number, files: string[], testPath: string, vmTemplate: string, vmStartupPort: string, buildOptions?: IVMSuiteBuildOptions) {
        // For the VM suite, we will only know the remote IP and the remotebuild-test-agent port after we launch the VM, so initialize the RemoteSuite base class with empty values
        super(id, files, testPath, "", "", buildOptions);

        this.vmTemplate = vmTemplate;
        this.vmStartupPort = vmStartupPort;

        // Check build options
        if (buildOptions) {
            this.keepVmOnTestPass = buildOptions.hasOwnProperty("keepVmOnTestPass") ? buildOptions.keepVmOnTestPass : false;
            this.mustCloneVM = buildOptions.hasOwnProperty("cloneVm") ? buildOptions.cloneVm : true;
        }
    }

    public run(): Q.Promise<any> {
        // After this suite runs, we need to clean up the VM. Note: We don't do this in the cleanup() function, because we need to do different thing based on whether there was a success or a
        // failure, and the cleanup() method is invoked inside a finally clause, which does not let us do that
        return super.run().then(() => {
            // Tests passed, so delete the VM, EXCEPT in one of the following cases, where we just perform a hard shut down instead:
            //     -cloneVm is false (which means we are in the original VM)
            //     -keepVmOnTestPass is true
            if (!this.mustCloneVM || this.keepVmOnTestPass) {
                return VMUtils.hardShutDown(this.vmInfo.name);
            }

            return VMUtils.deleteVm(this.vmInfo.name);
        }, (err: any) => {
            // Tests failed, so save the VM's state and then propagate the error
            return VMUtils.saveState(this.vmInfo.name).then(() => {
                return Q.reject(err);
            });
        });
    }

    protected setup(): Q.Promise<any> {
        // Launch a new VM based on the specified template
        return VMUtils.launchNewVMWithRemotebuild(this.vmTemplate, this.vmStartupPort, this.mustCloneVM).then((vmInfo: IVMInfo) => {
            this.vmInfo = vmInfo;
            this.remoteIp = vmInfo.remotebuildInfo.ip;
            this.remotePort = vmInfo.remotebuildInfo.port;

            // We need to log the name of the VM this suite is running in, because VM clone names are generated dynamically
            console.log("Running in VM '%s'", this.vmInfo.name);
        }).then(() => {
            // Now that the target VM is running, this suite is just a normal remote suite
            return super.setup();
        });
    }

    protected launch(): Q.Promise<any> {
        // Launch the tests normally as if this was a remote suite
        return super.launch();
    }
}

export = VMSuite;