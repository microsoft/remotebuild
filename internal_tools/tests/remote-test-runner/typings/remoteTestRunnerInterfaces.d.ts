declare module RemoteTestRunnerInterfaces {
    export interface ISuiteConfig {
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
        setupScript?: string;
        sourcesPath?: string;
    }
}