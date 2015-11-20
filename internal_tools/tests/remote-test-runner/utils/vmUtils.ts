/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/q.d.ts" />

"use strict";

import child_process = require("child_process");
import fs = require("fs");
import http = require("http");
import os = require("os");
import path = require("path");
import querystring = require("querystring");
import url = require("url");
import util = require("util");

import Q = require("q");

import remotebuildUtils = require("./remotebuildUtils");

class VMUtils {
    private static NEW_VM_SUFFIX = "runner";
    private static VBOXMANAGE_COMMAND = "vboxmanage";
    private static VM_STARTUP_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    private static vmsFolder: string = path.join(process.env.HOME, "VirtualBox VMs");
    private static vmsRunnerFolder: string = path.join(VMUtils.vmsFolder, "testRuns");
    private static runCounter: number = VMUtils.initializeCounter();

    /**
     * Starts the specified VM (or a new clone of it, if the cloneVm flag is true). Returns an IVMInfo containing info about the new VM and its remotebuild process.
     */
    public static launchNewVMWithRemotebuild(templateName: string, vmStartupPort: string, cloneVm: boolean = true): Q.Promise<VMUtils.IVMInfo> {
        if (!templateName) {
            return Q.reject<VMUtils.IVMInfo>(new Error("Error: launchNewVMWithRemotebuild() invoked with no template"));
        }

        if (!remotebuildUtils.isPortValid(vmStartupPort)) {
            return Q.reject<VMUtils.IVMInfo>(new Error("Error: launchNewVMWithRemotebuild() invoked with an invalid port: " + vmStartupPort));
        }

        var vmInfo: VMUtils.IVMInfo;
        var vmStartupPromise: Q.Deferred<VMUtils.IVMInfo> = Q.defer<VMUtils.IVMInfo>();
        var vmCommunicationServer: http.Server;

        return Q({}).then(() => {
            if (cloneVm) {
                return VMUtils.cloneVM(templateName);
            } else {
                // No need to clone the VM, so just return with the template's name as the VM name
                return Q.resolve({
                    name: templateName
                });
            }
        }).then((info: VMUtils.IVMInfo) => {
            // Save the new VM's name
            vmInfo = info;

            // Set up a server that will await contact from the new VM
            var deferred: Q.Deferred<any> = Q.defer<any>();

            function handleRequest(request: http.ServerRequest, response: http.ServerResponse): void {
                // Route request (it's either an error or a notice that the VM is ready and listening)
                // Note: this is an extremely simple server, no need for advanced routing module
                var parsedRequest = url.parse(request.url);
                var query = querystring.parse(parsedRequest.query);

                switch (parsedRequest.pathname) {
                    case "/listening":
                        // Empty response
                        response.end();

                        // The request should include a port on which Remotebuild is listening, so validate the received port
                        if (!remotebuildUtils.isPortValid(query.port)) {
                            vmStartupPromise.reject(new Error("The test VM reported an invalid port: " + query.port));
                        }

                        // Determine the VM's IP address using the request's connection
                        var ipAddr = request.connection.remoteAddress;

                        if (!ipAddr) {
                            vmStartupPromise.reject(new Error("Could not obtain the VM's IP address from the request"));
                            break;
                        }

                        // Save IP and port in the VM info
                        vmInfo.remotebuildInfo = {
                            ip: ipAddr,
                            port: query.port
                        };

                        // Resolve the VM startup promise
                        vmStartupPromise.resolve(vmInfo);
                        break;

                    case "/error":
                        // Empty response
                        response.end();

                        // Reject the VM startup promise with the error sent by the VM
                        var errorMessage: string = "The VM reported an error"

                        if (query.error) {
                            errorMessage = util.format("%s:%s=====%s%s%s=====%s",
                                errorMessage,
                                os.EOL,
                                os.EOL,
                                decodeURI(query.error),
                                os.EOL,
                                os.EOL);
                        }

                        vmStartupPromise.reject(new Error(errorMessage));
                        break;
                    default:
                        // Empty response
                        response.end();

                        // Reject the VM startup promise with a generic error
                        vmStartupPromise.reject(new Error("The test VM sent an invalid message"));
                }
            }

            vmCommunicationServer = http.createServer(handleRequest);
            vmCommunicationServer.listen(vmStartupPort, () => {
                deferred.resolve({});
            });

            return deferred.promise;
        }).then(() => {
            // Start the new VM
            return VMUtils.startVM(vmInfo.name);
        }).then(() => {
            // Start the timeout for the VM's "listening" message
            return vmStartupPromise.promise.timeout(VMUtils.VM_STARTUP_TIMEOUT);
        }).then((info: VMUtils.IVMInfo) => {
            var deferred: Q.Deferred<VMUtils.IVMInfo> = Q.defer<VMUtils.IVMInfo>();

            // The VM is ready and it has Remotebuild running, so clean up the server
            vmCommunicationServer.close(() => {
                // Resolve this promise chain with the VM's info
                deferred.resolve(info);
            });

            return deferred.promise;
        });
    }

    /*
     * Deletes the VM with the specified name. A hard shutdown is first performed, then the VM is unregistered from VIrtualBox using the --delete flag. This will delete all files
     * that are not used by other VMs (for example, a VHD that is shared with another VM won't be deleted).
     */
    public static deleteVm(vmName: string): Q.Promise<any> {
        if (!vmName) {
            return Q.reject<VMUtils.IVMInfo>(new Error("Error: deleteVm() invoked with no VM name"));
        }

        return VMUtils.hardShutDown(vmName).then(() => {
            return VMUtils.unregisterVM(vmName, true);
        });
    }

    /*
     * Clones the specified VM template into a new VM with a unique name, and registers it to VirtualBox using the --register switch. The cloned Returns an IVMInfo that only contains the VM's name.
     */
    public static cloneVM(templateName: string): Q.Promise<VMUtils.IVMInfo> {
        if (!templateName) {
            return Q.reject<VMUtils.IVMInfo>(new Error("Error: cloneVM() invoked with no template"));
        }

        var runnerName: string = VMUtils.getNewVMName(templateName);

        var args: string[] = [
            "clonevm",
            templateName,
            "--name",
            runnerName,
            "--register",
            "--basefolder",
            VMUtils.vmsRunnerFolder
        ];

        return VMUtils.invokeVboxmanageCommand(args).then(() => {
            var info: VMUtils.IVMInfo = {
                name: runnerName
            };

            return Q(info);
        });
    }

    /*
     * Starts the VM with the specified name.
     */
    public static startVM(vmName: string): Q.Promise<any> {
        if (!vmName) {
            return Q.reject<VMUtils.IVMInfo>(new Error("Error: startVM() invoked with no VM name"));
        }

        var args: string[] = [
            "startvm",
            vmName
        ];

        return VMUtils.invokeVboxmanageCommand(args);
    }

    /*
     * Performs a "hard" shutdown of the VM with the specified name. This is equivalent to pulling the power cable from a computer, so all unsaved data inside the VM will be lost.
     */
    public static hardShutDown(vmName: string): Q.Promise<any> {
        if (!vmName) {
            return Q.reject<VMUtils.IVMInfo>(new Error("Error: hardShutDown() invoked with no VM name"));
        }

        var args: string[] = [
            "controlvm",
            vmName,
            "poweroff"
        ];

        return VMUtils.invokeVboxmanageCommand(args);
    }

    /*
     * Saves the state of the VM with the specified name, and then puts it in a shutdown state. This frees up the RAM that the VM is using on the host machine, but still allows the
     * VM to be restarted later for investigation.
     */
    public static saveState(vmName: string): Q.Promise<any> {
        if (!vmName) {
            return Q.reject<VMUtils.IVMInfo>(new Error("Error: saveState() invoked with no VM name"));
        }

        var args: string[] = [
            "controlvm",
            vmName,
            "savestate"
        ];

        return VMUtils.invokeVboxmanageCommand(args);
    }

    /*
     * Unregisters the VM with the specified name from VIrtualBox. If the deleteVM argument is set to true, then the unregistration is called with the "--delete" flag, which causes
     * VirtualBox to delete the VM after the unregistration.
     */
    public static unregisterVM(vmName: string, deleteVM: boolean = false): Q.Promise<any> {
        if (!vmName) {
            return Q.reject<VMUtils.IVMInfo>(new Error("Error: unregisterVM() invoked with no VM name"));
        }

        var args: string[] = [
            "unregistervm",
            vmName
        ];

        if (deleteVM) {
            args.push("--delete");
        }

        return VMUtils.invokeVboxmanageCommand(args);
    }

    /*
     * Util method to invoke a VBoxManage command
     */
    private static invokeVboxmanageCommand(args: string[]): Q.Promise<any> {
        var deferred: Q.Deferred<any> = Q.defer<any>();
        var errorOutput: string = "";
        var cp = child_process.spawn(VMUtils.VBOXMANAGE_COMMAND, args);

        cp.on("error", (err: Error) => {
            deferred.reject(err);
        });

        cp.on("exit", (code: number) => {
            // Note: VBoxManage sometimes outputs some non-error things to stderr, so only rely on the exit code to detect whether an error has occurred or not
            if (code) {
                var subcommand = !!args && !!args[0] ? " " + args[0] : "";
                var reason: string = util.format("Exit code: %d", code);

                if (errorOutput) {
                    reason += util.format("%sstderr:%s%s", os.EOL, os.EOL, errorOutput);
                }

                var message: string = util.format("Error running 'vboxmanage%s' command:%s%s", subcommand, os.EOL, reason);

                deferred.reject(new Error(message));
            } else {
                deferred.resolve({});
            }
        });

        cp.stderr.on("data", (data: Buffer) => {
            errorOutput += data.toString();
        });

        return deferred.promise;
    }

    /**
     * Returns a new unique name for VM cloning. Appends the "Runner" suffix to the template's name, and adds a numbered suffix in case the name already exists.
     */
    private static getNewVMName(templateName: string): string {
        var newName: string = util.format("%s-%s-%d", templateName, VMUtils.NEW_VM_SUFFIX, VMUtils.runCounter);

        ++VMUtils.runCounter;

        return newName;
    }

    /**
     * Finds the highest number ID currently in use by the runner VMs, and returns one above that.
     */
    private static initializeCounter(): number {
        var idRegex: RegExp = /-(\d+)$/;
        var highestId: number = 0;
        var vms: string[] = fs.readdirSync(VMUtils.vmsRunnerFolder);

        vms.forEach((vmFullPath: string) => {
            var result: RegExpExecArray = idRegex.exec(vmFullPath);

            if (result && result.length >= 2) {
                var id: number = parseInt(result[1]);   // The captured group is at index 1

                if (!isNaN(id) && id > highestId) {
                    highestId = id;
                }
            }
        });

        return highestId + 1;
    }
}

module VMUtils {
    export interface IRemotebuildInfo {
        ip: string;
        port: string;
    }

    export interface IVMInfo {
        name: string;
        remotebuildInfo?: IRemotebuildInfo;
    }
}

export = VMUtils;