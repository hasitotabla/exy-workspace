import type { IResourceManifest, ResourceResolvedItem, ResourceScriptEnv } from "./Manifest";

export type MaybePromise<T> = T | Promise<T>;
export type ResourceScripts = {
    [key in ResourceScriptEnv]: Array<ResourceResolvedItem>;
};

export interface IResourceHooks {
    finished: (data: {}) => void;

    preBuild: (data: {}) => void;
    postBuild: (data: {}) => {
        // manifest: IResourceManifest;
    };

    postResolve: (data: { scripts: ResourceScripts }) => {
        scripts: ResourceScripts;
    };
}

export type ResourceHookSharedData<T extends keyof IResourceHooks = any> = {
    resourceName: string;
    resourcePath: string;
    outputTarget: string;
    manifest: IResourceManifest;

    data: Parameters<IResourceHooks[T]>;
};
