import type {
  IResourceManifest,
  ResourceResolvedItem,
  ResourceScriptEnv,
} from "./Manifest";

export type MaybePromise<T> = T | Promise<T>;

export interface IResourceHooks {
  finished: () => void;

  preBuild: () => void;
  postBuild: () => {
    manifest: IResourceManifest;
  };

  postResolve: (data: {
    scripts: {
      [key in ResourceScriptEnv]: Array<ResourceResolvedItem>;
    };
  }) => {
    scripts: {
      [key in ResourceScriptEnv]: Array<ResourceResolvedItem>;
    };
  };
}

export type ResourceHookSharedData<T extends keyof IResourceHooks = any> = {
  resourceName: string;
  resourcePath: string;
  outputTarget: string;
  manifest: IResourceManifest;

  data: Parameters<IResourceHooks[T]>;
};
