// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference path="../../typings/node.d.ts" />
/// <reference path="../../typings/Q.d.ts" />
/// <reference path="../../typings/tacoUtils.d.ts" />
/// <reference path="../../typings/rimraf.d.ts" />
/// <reference path="../../typings/cordovaExtensions.d.ts" />

"use strict";

import child_process = require ("child_process");
import fs = require ("fs");
import path = require ("path");
import Q = require ("q");
import rimraf = require ("rimraf");
import semver = require ("semver");

import Builder = require ("../common/builder");
import plist = require ("./plist");
import resources = require("../resources/resourceManager");
import utils = require ("taco-utils");

import BuildInfo = utils.BuildInfo;
import CordovaConfig = utils.CordovaConfig;
import Logger = utils.Logger;
import TacoPackageLoader = utils.TacoPackageLoader;
import UtilHelper = utils.UtilHelper;

process.on("message", function (buildRequest: { buildInfo: BuildInfo; language: string }): void {
    var buildInfo: BuildInfo = BuildInfo.createNewBuildInfoFromDataObject(buildRequest.buildInfo);
    process.env.TACO_LANG = buildRequest.language;
    if (IOSBuilder.running) {
        buildInfo.updateStatus(BuildInfo.ERROR, "BuildInvokedTwice");
        process.send(buildInfo);
        process.exit(1);
    } else {
        IOSBuilder.running = true;
    }

    var cordovaVersion: string = buildInfo["vcordova"];
    buildInfo.updateStatus(BuildInfo.BUILDING, "AcquiringCordova");
    process.send(buildInfo);
    TacoPackageLoader.lazyRequire<Cordova.ICordova540>("cordova", "cordova@" + cordovaVersion, buildInfo.logLevel).done(function (pkg: Cordova.ICordova540): void {
        var iosBuilder: IOSBuilder = new IOSBuilder(buildInfo, pkg);

        iosBuilder.build().done(function (resultBuildInfo: BuildInfo): void {
            process.send(resultBuildInfo);
        });
    }, function (err: Error): void {
        buildInfo.updateStatus(BuildInfo.ERROR, "RequireCordovaFailed", cordovaVersion, err.toString());
        process.send(buildInfo);
    });
});

class IOSBuilder extends Builder {
    public static running: boolean = false;
    private cfg: CordovaConfig;

    constructor(currentBuild: BuildInfo, cordova: Cordova.ICordova540) {
        super(currentBuild, cordova);

        this.cfg = CordovaConfig.getCordovaConfig(currentBuild.appDir);
    }

    protected beforePrepare(): Q.Promise<any> {
        if (semver.lt(this.currentBuild["vcordova"], "5.3.3") && semver.gte(process.versions.node, "4.0.0")) {
            var preferences = this.cfg.preferences();
            if (preferences["target-device"] || preferences["deployment-target"]) {
                throw new Error(resources.getString("UnsupportedCordovaAndNodeVersion"));
            }
        }
        return Q({});
    }

    protected afterCompile(): Q.Promise<any> {
        return this.renameApp();
    }

    protected package(): Q.Promise<any> {
        var deferred: Q.Deferred<any> = Q.defer();
        var self: IOSBuilder = this;

        // need quotes around ipa paths for xcrun exec to work if spaces in path
        var appDirName: string = this.cfg.id() + ".app";
        var ipaFileName: string = this.currentBuild["appName"] + ".ipa";
        var pathToCordovaApp: string = UtilHelper.quotesAroundIfNecessary(path.join("platforms", "ios", "build", "device", appDirName));
        var fullPathToIpaFile: string = UtilHelper.quotesAroundIfNecessary(path.join(process.cwd(), "platforms", "ios", "build", "device", ipaFileName));

        child_process.exec("xcrun -v -sdk iphoneos PackageApplication " + pathToCordovaApp + " -o " + fullPathToIpaFile, {},
            function (error: Error, stdout: Buffer, stderr: Buffer): void {
                Logger.log("xcrun.stdout: " + stdout);
                Logger.log("xcrun.stderr: " + stderr);
                if (error) {
                    deferred.reject(error);
                } else {
                    var plistFileName: string = self.currentBuild["appName"] + ".plist";
                    var fullPathToPlistFile: string = path.join(process.cwd(), "platforms", "ios", "build", "device", plistFileName);
                    plist.createEnterprisePlist(self.cfg, fullPathToPlistFile);
                    deferred.resolve({});
                }
            });

        return deferred.promise;
    }

    private renameApp(): Q.Promise<any> {
        // We want to make sure that the .app file is named according to the package Id
        // in order to avoid issues with unicode names and to allow us to identify which
        // application to attach to for debugging.
        var deferred: Q.Deferred<any> = Q.defer();
        var isDeviceBuild: boolean = this.currentBuild.options === "--device";
        var oldName: string = path.join("platforms", "ios", "build", isDeviceBuild ? "device" : "emulator", this.currentBuild["appName"] + ".app");
        var newName: string = path.join("platforms", "ios", "build", isDeviceBuild ? "device" : "emulator", this.cfg.id() + ".app");

        if (oldName !== newName && fs.existsSync(oldName)) {
            var clearOldData: Q.Deferred<any> = Q.defer();
            if (fs.existsSync(newName)) {
                rimraf(newName, function (error: Error): void {
                    if (error) {
                        clearOldData.reject(error);
                    } else {
                        clearOldData.resolve({});
                    }
                });
            } else {
                clearOldData.resolve({});
            }

            clearOldData.promise.then(function (): void {
                fs.rename(oldName, newName, function (err: Error): void {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        deferred.resolve({});
                    }
                });
            });
        } else {
            deferred.resolve({});
        }

        return deferred.promise;
    }

    protected setSupportProperties(): Q.Promise<any> {
        // Sets properties necessary to support later version of XCode
        var self: any = this;

        // Get the version of XCode currently installed
        let execDeferred: Q.Deferred<string> = Q.defer<string>();
        child_process.exec("xcodebuild -version", function (error, stdout, stderr) {
            if (error) {
                execDeferred.reject(new Error(resources.getString("XCode8VersionCheckWarning", error.message)));
            } else {
                execDeferred.resolve(stdout.toString());
            }
        });

        // If the version of XCode isn't current enough to require DEVELOPMENT_TEAM to
        // be set, just skip it.
        return execDeferred.promise.then(function parseXcodeVersion(execOutput: string) {
            const xcodeVersionRegex = /^Xcode (\d+(\.\d+)?)/;
            const match = execOutput.match(xcodeVersionRegex);
            if (match && match[1]) {
                if (parseInt(match[1], 10) >= 8) {
                    return self.ensureDevelopmentTeam();
                } else {
                    return;
                }
            } else {
                throw(new Error(resources.getString("XCode8VersionCheckWarningCommandOutput", execOutput)));
            }
        }).fail(function (err) {
            Logger.logError(err.message);
            return;
        });
    }

    private ensureDevelopmentTeam(): Q.Promise<any> {
        // Set Development Team in build.xcconfig.
        try {
            var buildJson: IBuildJson = require(path.join(this.currentBuild.appDir, "build.json"));
        }
        catch (e) {
            throw(new Error(resources.getString("XCode8InvalidBuildJson")));
        }

        if (!buildJson.ios || !buildJson.ios[this.currentBuild.configuration] || !buildJson.ios[this.currentBuild.configuration].developmentTeam)
        {
            throw(new Error(resources.getString("XCode8BuildJsonMissingDevelopmentTeam")));
        }
        var developmentTeam: string = buildJson.ios[this.currentBuild.configuration].developmentTeam;

        var encoding: string = "utf-8";
        var filepath: string = path.join("platforms", "ios", "cordova", "build.xcconfig");
        var xcconfig: string = fs.readFileSync(filepath, encoding);

        if (xcconfig.indexOf("DEVELOPMENT_TEAM") === -1) {
            var developmentTeamLine: string = "\nDEVELOPMENT_TEAM = " + developmentTeam;

            xcconfig += developmentTeamLine;
            fs.writeFileSync(filepath, xcconfig, encoding);
        }

        return Q({});
    }
}

interface IBuildJson {
    ios?: {
        debug?: IBuildConfigurationOverride;
        release?: IBuildConfigurationOverride;
        [key: string]: IBuildConfigurationOverride;
    };
}

interface IBuildConfigurationOverride {
    developmentTeam?: string;
    codeSignIdentity?: string;
}