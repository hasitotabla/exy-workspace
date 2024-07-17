export type IResourceScriptEnv = "shared" | "server" | "client";
export type IResourceScript = string;
export type IResourceGameType = "gta5" | "gta4" | "rdr3";
export type IResourceResolvedItem = {
  resourceName: string;

  source: string;
  sourceManifest: string;

  target: string;
  targetManifest: string;
};

type IResourceDegenerateBoolean = "yes" | "no";

export interface IResourceManifest {
  fx_version: string;
  game: IResourceGameType | IResourceGameType[];
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

  shared_scripts: Array<string>;
  client_scripts: Array<string>;
  server_scripts: Array<string>;

  server_files: Array<string>;
  files: Array<string>;

  exports: Array<string>;

  import_deps: {
    __default__: Array<string>;
    [key: string]: Array<string>;
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
        for (const item of value) {
          output += `${convertManifestValue(item)},\n`;
        }
        output += "}";

        return output;
      } else {
        let output = "{\n";
        for (const key in value) {
          output += `${key} = ${convertManifestValue(value[key])},\n`;
        }
        output += "}";

        return output;
      }

    case "string":
    default:
      return `"${value}"`;
  }
};
