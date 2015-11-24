declare module RemoteTestRunnerInterfaces {
    export interface ISuiteConfig {
        cloneVm?: boolean;
        keepVmOnTestPass?: boolean;
        name?: string;
        remoteIp?: string;
        remotePort?: string;
        setupScript?: string;
        testFiles: string[];
        type: string;
        vmTemplate?: string;
        vmStartupPort?: string;
    }

    export interface ITestConfig {
        suites: ISuiteConfig[];
    }

    export interface IParsedArgs {
        testsPath: string;
        sourcesPath?: string;
        reporter?: string;
        remain?: string[];
    }

    export interface ISuiteBuildOptions {
        mochaReporter?: string;
        name?: string;
        setupScript?: string;
        sourcesPath?: string;
    }

    export interface IVMSuiteBuildOptions extends ISuiteBuildOptions {
        cloneVm?: boolean;
        keepVmOnTestPass?: boolean;
    }
}