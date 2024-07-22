import fs from "fs";
import path from "path";
import crypto from "crypto";
import { $, sleep } from "bun";
import { spawnSync } from "node:child_process";
// @ts-ignore
import * as luamin from "luamin";

import {
  CACHE_FOLDER,
  DEBUG_ENABLED,
  ENV_EXPOSED_PREFIXES,
  MINIFY_OUTPUT,
} from "../../Consts";
import type { ResourceResolvedItem, ResourceScriptEnv } from "../resource/Manifest";
import { generateString } from "../../Utils";

export interface ILuaBuilderOptions {
  resourceName: string;
  outputTarget: string;
  env: { [key: string]: string };
}

const isLunix = () => ["linux", "darwin"].includes(process.platform);

const preprocessScriptPath = path.resolve(
  `./scripts/vendor/lua/preprocess${isLunix() ? ".sh" : ".cmd"}`
);

const defaultLuaBuilderOptions: Partial<ILuaBuilderOptions> = {
  env: {},
};

export function useLuaBuilder(options: Partial<ILuaBuilderOptions>) {
  const _options = { ...defaultLuaBuilderOptions, ...options } as ILuaBuilderOptions;
  const buildSessionId = generateString(8);

  if (!_options.outputTarget)
    throw new Error(`Output target does not exist: ${_options.outputTarget}`);

  const runPreprocessor = async (sourcePath: string, targetPath: string) => {
    try {
      const targetFolder = path.dirname(targetPath);
      if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });

      if (isLunix())
        spawnSync(
          "sh",
          [
            preprocessScriptPath,
            DEBUG_ENABLED ? "--silent" : "",
            "-o",
            sourcePath,
            targetPath,
          ],
          { encoding: "utf8", stdio: DEBUG_ENABLED ? "inherit" : "ignore" }
        );
      else
        spawnSync(
          preprocessScriptPath,
          [DEBUG_ENABLED ? "--silent" : "", "-o", sourcePath, targetPath],
          { encoding: "utf8", stdio: DEBUG_ENABLED ? "inherit" : "ignore" }
        );

      for (let i = 0; i < 15; i++) {
        if (fs.existsSync(targetPath)) break;

        if (i === 1)
          console.log(
            `Waiting for preprocessor to finish for file '${sourcePath}:${targetPath}'...`
          );

        await sleep(100);
      }

      if (!fs.existsSync(targetPath)) {
        console.error(`Preprocessor failed for file '${sourcePath}:${targetPath}'`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const buildAndBundle = async (
    scripts: Array<ResourceResolvedItem>,
    scriptEnv: ResourceScriptEnv
  ) => {
    let bundledContent = ``;

    for (const script of scripts) {
      const compiledScript = await compileSource(scriptEnv, script.source);
      if (typeof compiledScript !== "string") continue;

      bundledContent += `\n\n-- ${script.source}\ndo${
        MINIFY_OUTPUT
          ? compiledScript
          : // padding non-minified code to make it look better (and collapsable)
            compiledScript
              .split("\n")
              .map((x) => "\t" + x)
              .join("\n")
      }\nend`;
    }

    if (MINIFY_OUTPUT) bundledContent = luamin.minify(bundledContent);

    const bundleFileName = `${scriptEnv}_bundle.lua`;
    const outputPath = path.join(_options.outputTarget, bundleFileName);

    if (bundledContent === "") return;

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, bundledContent);
  };

  const compileSource = async (
    scriptEnv: ResourceScriptEnv,
    sourcePath: string,
    targetPath?: string
  ): Promise<string | boolean> => {
    const preprocessedSource = getSourceCode(sourcePath, scriptEnv);

    const parsedPath = path.parse(sourcePath);
    const tempFileName = `${parsedPath.name}_${scriptEnv}${parsedPath.ext}`;

    const tempBuildPath = path.join(
      CACHE_FOLDER,
      `build`,
      _options.resourceName,
      `${tempFileName}`
    );

    fs.mkdirSync(path.dirname(tempBuildPath), { recursive: true });

    if (fs.existsSync(tempBuildPath)) fs.unlinkSync(tempBuildPath);
    fs.writeFileSync(tempBuildPath, preprocessedSource);

    if (targetPath) {
      return runPreprocessor(tempBuildPath, targetPath);
    }

    const tempOutputPath = `${tempBuildPath}_${generateString(8)}.out`;
    if (!runPreprocessor(tempBuildPath, tempOutputPath)) {
      return false;
    }

    if (!fs.existsSync(tempOutputPath)) {
      console.error(`Failed to preprocess ${sourcePath}`);
      return false;
    }

    const processedFileContent = fs.readFileSync(tempOutputPath, { encoding: "utf-8" });

    fs.unlinkSync(tempBuildPath);
    fs.unlinkSync(tempOutputPath);

    return processedFileContent;
  };

  const getSourceCode = (source: string, scriptEnv: ResourceScriptEnv) => {
    let content = fs.readFileSync(source, { encoding: "utf-8" });
    let headers = `
      !local SCRIPT_ENV = '${scriptEnv}';\n
      !local RESOURCE_NAME = '${_options.resourceName ?? "unknown"}';\n
    `;

    if (scriptEnv === "shared")
      headers += `!local IS_SHARED = true;\n!local IS_SERVER = true;\n!local IS_CLIENT = true;\n`;
    if (scriptEnv === "server") headers += `!local IS_SERVER = true;\n`;
    if (scriptEnv === "client") headers += `!local IS_CLIENT = true;\n`;

    // for (const env of ["shared", "server", "client"] as IResourceScriptEnv[])
    //   if (env === scriptEnv) headers += `!local IS_${env.toUpperCase()} = true;\n`;

    headers += Object.keys(_options?.env || {})
      .filter((x) => ENV_EXPOSED_PREFIXES.some((y) => x.startsWith(y)))
      .reduce<string[]>(
        (Prev, Curr) => [
          ...Prev,
          `!local ${Curr} = ${
            typeof _options.env[Curr] === "string"
              ? `'${_options.env[Curr]}'`
              : _options.env[Curr]
          };`,
        ],
        []
      )
      .join("\n");

    content = `${headers}\n\n${content.substring(content.charCodeAt(0) > 60000 ? 1 : 0)}`;
    return content;
  };

  return {
    compileSource,
    buildAndBundle,
  };
}
