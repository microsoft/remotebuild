/**
 *******************************************************
 *                                                     *
 *   Copyright (C) Microsoft. All rights reserved.     *
 *                                                     *
 *******************************************************
 */

// Barebones typing for edge, added as-needed

declare module Edge {
    export interface ICompiledEdgeFunc<In, Out> {
        (input: In, sync: Boolean): Out;
        (input: In, callback: (error: Error, result: Out) => void): void;
    }
    export function func<In, Out>(inlineOrPath: string): ICompiledEdgeFunc<In, Out>;
    export function func<In, Out>(commentedOutFunction: () => void): ICompiledEdgeFunc<In, Out>;
}

declare module "edge" {
    export = Edge;
}