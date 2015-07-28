/**
﻿ *******************************************************
﻿ *                                                     *
﻿ *   Copyright (C) Microsoft. All rights reserved.     *
﻿ *                                                     *
﻿ *******************************************************
﻿ */

/// <reference path="../../typings/node.d.ts" />
/// <reference path="../../typings/Q.d.ts" />
/// <reference path="../../typings/tacoUtils.d.ts" />
/// <reference path="../../typings/rimraf.d.ts" />
/// <reference path="../../typings/cordovaExtensions.d.ts" />

"use strict";

import Q = require ("q");

import Builder = require ("../common/builder");
import resources = require ("../resources/resourceManager");
import utils = require ("taco-utils");

import BuildInfo = utils.BuildInfo;
import CordovaConfig = utils.CordovaConfig;
import TacoPackageLoader = utils.TacoPackageLoader;

var running = false;

process.on("message", function (buildRequest: { buildInfo: BuildInfo; language: string }): void {
    var buildInfo = BuildInfo.createNewBuildInfoFromDataObject(buildRequest.buildInfo);
    process.env.TACO_LANG = buildRequest.language;
    if (running) {
        buildInfo.updateStatus(BuildInfo.ERROR, "BuildInvokedTwice");
        process.send(buildInfo);
        process.exit(1);
    } else {
        running = true;
    }

    var cordovaVersion: string = buildInfo["vcordova"];
    buildInfo.updateStatus(BuildInfo.BUILDING, "AcquiringCordova");
    process.send(buildInfo);
    TacoPackageLoader.lazyRequire<Cordova.ICordova>("cordova", "cordova@" + cordovaVersion, buildInfo.logLevel).done(function (pkg: Cordova.ICordova): void {
        var winBuilder = new WindowsBuilder(buildInfo, pkg);
        winBuilder.build().done(function (resultBuildInfo: BuildInfo): void {
            process.send(resultBuildInfo);
        });
    }, function (err: Error): void {
        buildInfo.updateStatus(BuildInfo.ERROR, "RequireCordovaFailed", cordovaVersion, err.toString());
        process.send(buildInfo);
    });
});

class WindowsBuilder extends Builder {

}