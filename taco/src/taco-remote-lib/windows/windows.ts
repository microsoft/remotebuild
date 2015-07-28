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
/// <reference path="../../typings/zip-stream.d.ts" />
/// <reference path="../../typings/express.d.ts" />
/// <reference path="../ITargetPlatform.d.ts" />

"use strict";

import child_process = require("child_process");
import fs = require("fs");
import net = require("net");
import os = require("os");
import path = require("path");
import util = require("util");
import packer = require("zip-stream");

import resources = require("../resources/resourceManager");
import utils = require("taco-utils");

import BuildInfo = utils.BuildInfo;
import ProcessLogger = utils.ProcessLogger;
import UtilHelper = utils.UtilHelper;

class WindowsAgent implements ITargetPlatform {
    constructor(config: { get(key: string): any; }) {
    }

    public canServiceRequest(buildInfo: BuildInfo): boolean {
        return os.platform() === "win32" && buildInfo.buildPlatform.toLowerCase() === "windows";
    }

    public runOnDevice(buildInfo: BuildInfo, req: Express.Request, res: Express.Response): void {
        res.send(404);
    }

    public downloadBuild(buildInfo: BuildInfo, req: Express.Request, res: Express.Response, callback: (err: any) => void): void {
        res.send(404);
    }

    public emulateBuild(buildInfo: utils.BuildInfo, req: Express.Request, res: Express.Response): void {
        res.send(404);
    }

    public deployBuildToDevice(buildInfo: utils.BuildInfo, req: Express.Request, res: Express.Response): void {
        res.send(404);
    }

    public debugBuild(buildInfo: utils.BuildInfo, req: Express.Request, res: Express.Response): void {
        res.send(404);
    }

    public createBuildProcess(): child_process.ChildProcess {
        return child_process.fork(path.join(__dirname, "windowsBuild.js"), [], { silent: true });
    }
}

export = WindowsAgent;