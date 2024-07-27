import fs from "fs";
import path from "path";
import esbuild, { type Plugin } from "esbuild";
import Preprocessor from "$scripts/utility/Preprocess";

import type { RuntimeBuilder } from "../Types";
import type { ResourceScriptEnv } from "../types/Manifest";
import { ENV_EXPOSED_PREFIXES } from "$scripts/Consts";

export interface ITypescriptBuilderOptions {}

const defaultBuilderOptions: Partial<ITypescriptBuilderOptions> = {
  env: {},
};

export const useTypescriptBuilder: RuntimeBuilder<ITypescriptBuilderOptions> = (
  options
) => {
  const _options = { ...defaultBuilderOptions, ...options } as Required<typeof options>;

  const preprocessSource = (scriptPath: string, header: string) => {
    const contents = fs.readFileSync(scriptPath, "utf-8");
    if (!contents) throw new Error(`Failed to read file: ${scriptPath}`);

    try {
      const instance = new Preprocessor();
      return instance.process(`${header}\n\n${contents}`);
    } catch (error) {
      console.error(`Failed to preprocess file: ${scriptPath}`);
      return null;
    }
  };

  const createPlugin = (env: ResourceScriptEnv): Plugin => {
    let header = ``;

    header += `/* #define SCRIPT_ENV ${env} */`;
    header += `/* #define RESOURCE_NAME ${_options.resourceName} */`;

    if (env === "shared") header += `/* #define IS_SHARED */\n`;
    if (env === "server" || env === "shared") header += `/* #define IS_SERVER */\n`;
    if (env === "client" || env === "shared") header += `/* #define IS_CLIENT */\n`;

    header += Object.keys(_options?.env || {})
      .filter((x) => ENV_EXPOSED_PREFIXES.some((y) => x.startsWith(y)))
      .reduce<string[]>(
        (Prev, Curr) => [
          ...Prev,
          `/* #define ${Curr} ${
            typeof _options?.env[Curr] === "string"
              ? `'${_options?.env[Curr]}'`
              : _options?.env[Curr]
          } */`,
        ],
        []
      )
      .join("\n");

    return {
      name: "preprocessor",
      setup(build) {
        build.onLoad(
          {
            filter: /.*/,
          },
          async (args) => {
            const processed = preprocessSource(args.path, header);
            if (!processed) return null;

            return {
              contents: processed,
              loader: "ts",
            };
          }
        );
      },
    };
  };

  return {
    build: async (scripts) => {
      const manifestItems: {
        [key in ResourceScriptEnv]: Array<string>;
      } = {
        shared: [],
        server: [],
        client: [],
      };

      for (const env of ["server", "client"] as ResourceScriptEnv[]) {
        const envScripts = {
          ...scripts.shared,
          ...scripts[env],
        };

        if (envScripts.length === 0) continue;
        if (envScripts.length > 1)
          throw new Error("Only one entrypoint is allowed for server and client.");

        const entryFile = envScripts[0];
        if (!entryFile) {
          console.warn(`No entrypoint found for ${env} scripts.`);
          continue;
        }

        await esbuild.build({
          target: env === "server" ? "node16" : "es2020",
          entryPoints: [entryFile.source],
          platform: env === "server" ? "node" : "neutral",
          outfile: path.resolve(_options.outputTarget, `${env}_bundle.js`),

          bundle: true,
          minifyWhitespace: true,
          charset: "utf8",

          logLevel: "info",
          absWorkingDir: process.cwd(),
          metafile: true,

          plugins: [createPlugin(env)],
        });

        manifestItems[env] = [`${env}_bundle.js`];
      }

      return { manifest: manifestItems };
    },
    filter: (fileName) => fileName.endsWith(".ts"),
  };
};
