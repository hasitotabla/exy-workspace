export type ResourceScriptEnv = "shared" | "server" | "client";
export type ResourceScript = string;
export type ResourceGameType = "gta5" | "gta4" | "rdr3";

export type ResourceResolvedItem = {
  resourceName: string;

  source: string;
  sourceManifest: string;

  target: string;
  targetManifest: string;
};

export type ResourceResolvedScripts = {
  [key in `${ResourceScriptEnv}_scripts`]: Array<ResourceScriptFile | string>;
};

export type ResourceManifestScripts = {
  [key in ResourceScriptEnv]: Array<string>;
};

// export type ResourceScriptFile = {
//   excludeFromManifest?: boolean;
//   src: string;
//   env: ResourceScriptEnv;
// };

export type ResourceFile = {
  src: string;
  serverOnly?: boolean;
  skipResolve?: boolean;
  skipCopy?: boolean;
};

type IResourceDegenerateBoolean = "yes" | "no";

export interface IResourceManifest {
  fx_version: string;
  game: ResourceGameType | ResourceGameType[];
  use_fxv2_oal: IResourceDegenerateBoolean;
  lua54: IResourceDegenerateBoolean;

  resource_manifest_version: string;

  info: {
    name: string;
    author: string;
    description: string;
    version: string;
  };

  env: { [key: string]: string };

  hooks: {
    [key: string]: string;
  };

  shared_scripts: Array<ResourceScriptFile | string>;
  client_scripts: Array<ResourceScriptFile | string>;
  server_scripts: Array<ResourceScriptFile | string>;

  ui_page: string;
  files: Array<ResourceFile | string>;

  exports: Array<{ function: string; env: ResourceScriptEnv } | string>;

  // Workspace specific

  import_deps: {
    __default__: Array<string>;
    [key: string]: Array<string>;
  };

  watcher: {
    ignore?: string;
  };
}

export const defaultManifestOptions: Partial<IResourceManifest> = {
  fx_version: "cerulean",
  use_fxv2_oal: "yes",
  lua54: "yes",
  game: ["gta5"],
};

export const convertManifestValue = (value: any) => {
  switch (typeof value) {
    case "number":
      return value;
    case "boolean":
      return `${value}`;

    case "object":
      // convert json object to a lua table string

      if (Array.isArray(value)) {
        let output = "{\n";
        for (const item of value) output += `\t${convertManifestValue(item)},\n`;
        output += "}";

        return output;
      } else {
        let output = "{\n";
        for (const key in value)
          output += `${key} = ${convertManifestValue(value[key])},\n`;
        output += "}";

        return output;
      }

    case "string":
    default:
      return `"${value}"`;
  }
};
