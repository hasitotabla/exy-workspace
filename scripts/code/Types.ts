import type { ResourceResolvedItem, ResourceScriptEnv } from "./types/Manifest";

type MaybePromise<T = any> = Promise<T> | T;

export type RuntimeBuilderSharedOptions = {
    resourceName: string;
    resourceRoot: string;
    outputTarget: string;
    env: { [key: string]: string };
};

export type RuntimeBuilder<RuntimeSpecificOptions = any> = (
    options: Partial<RuntimeBuilderSharedOptions & RuntimeSpecificOptions>,
) => {
    build: (scripts: {
        [key in ResourceScriptEnv]: Array<ResourceResolvedItem>;
    }) => MaybePromise<{
        manifest: {
            [key in ResourceScriptEnv]: Array<string>;
        };
    }>;
    filter: (fileName: string) => boolean;

    //   [key: string]: any;
};
