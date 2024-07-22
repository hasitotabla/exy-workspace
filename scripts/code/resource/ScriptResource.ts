import fs from "fs";
import path from "path";

import {
  BaseResource,
  DEFAULT_BUILD_OPTIONS,
  type BuildOptions,
  type BuildResult,
} from "./BaseResource";
import type { ResourceResolvedItem, ResourceScriptEnv } from "./Manifest";
import { BUNDLE_SCRIPTS } from "../../Consts";
import { isFileChecksumChanged } from "../../utility/Checksum";
import { useLuaBuilder } from "../builder/LuaBuilder";

export class ScriptResource extends BaseResource {
  constructor(name: string, path: string) {
    super(name, path);
  }

  public async build(
    options: Partial<BuildOptions> = DEFAULT_BUILD_OPTIONS
  ): Promise<BuildResult> {
    let resourceInclusions: string[] = [];

    let didChecksumChange = false;
    let scriptsToBuild: {
      [key in ResourceScriptEnv]: Array<ResourceResolvedItem>;
    } = {
      shared: [],
      server: [],
      client: [],
    };

    for (const scriptEnv of ["shared", "server", "client"] as ResourceScriptEnv[]) {
      const scripts = this._manifest[`${scriptEnv}_scripts`];
      if (!scripts) continue;

      for (const script of scripts) {
        const scriptPath = typeof script === "string" ? script : script.src;

        // TODO: megfixelni ezt a szart
        let resolved = this.resolveFilePath(scriptPath).filter(
          async (x) =>
            BUNDLE_SCRIPTS ||
            options?.force ||
            !fs.existsSync(x.target) ||
            (await isFileChecksumChanged(x.source, true))
        );

        scriptsToBuild[scriptEnv] = [...scriptsToBuild[scriptEnv], ...resolved];
        resourceInclusions = [
          ...resourceInclusions,
          ...resolved
            .map((x) => x.resourceName)
            .filter((x) => x !== this._name && !resourceInclusions.includes(x)),
        ];

        if (resolved.length > 0) didChecksumChange = true;
      }
    }

    if (!didChecksumChange && !options?.force) {
      console.log(`Skipping build for ${this._name}`);
      return { success: true, data: { resourceInclusions } };
    }

    const luaBuilder = useLuaBuilder({
      resourceName: this._name,
      outputTarget: this._outputTarget,
      env: this._env,
    });

    if (BUNDLE_SCRIPTS) {
      for (const scriptEnv of ["server", "client"] as ResourceScriptEnv[])
        await luaBuilder.buildAndBundle(
          [...scriptsToBuild.shared, ...scriptsToBuild[scriptEnv]],
          scriptEnv
        );
    } else {
      for (const scriptEnv of ["server", "client"] as ResourceScriptEnv[]) {
        const combinedScripts = [...scriptsToBuild.shared, ...scriptsToBuild[scriptEnv]];

        for (const script of combinedScripts) {
          const parsedFile = path.parse(script.source);
          await luaBuilder.compileSource(
            scriptEnv,
            script.source,
            script.target.replace(
              parsedFile.base,
              `${parsedFile.name}_${scriptEnv}${parsedFile.ext}`
            )
          );
        }
      }
    }

    this.copyResourceFiles();
    this.generateResourceManifest({
      shared_scripts: this._manifest.shared_scripts ?? [],
      server_scripts: this._manifest.server_scripts ?? [],
      client_scripts: this._manifest.client_scripts ?? [],
    });
    this.deleteBuildFolder();

    return { success: true, data: { resourceInclusions } };
  }
}
