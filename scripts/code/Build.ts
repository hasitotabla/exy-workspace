import * as bun from "bun";
import fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { parse as envParse } from "dotenv";

import type { BaseResource } from "./resource/BaseResource";
import { ScriptResource } from "./resource/ScriptResource";
import { normalize } from "../Utils";

import { CACHE_FOLDER, DIST_FOLDER, IS_WORKERS_ENABLED } from "../Consts";
import { saveFilesChecksum } from "../utility/Checksum";
import { copyConfig } from "./Config";

export let GLOBAL_ENV = {};

const FORCE_REBUILD = bun.argv.includes("--rebuild");
const CLEAN_BUILD = bun.argv.includes("--clean");

type Resource = BaseResource | ScriptResource;

export const resourceImportHierarchy: { [key: string]: ScriptResource[] } = {};
export const resources: Array<Resource> = [];

export async function buildServer() {
  const envPath = path.resolve("./.env");
  GLOBAL_ENV = fs.existsSync(envPath) ? envParse(fs.readFileSync(envPath)) : {};

  if (CLEAN_BUILD)
    fs.rmdirSync(path.join(DIST_FOLDER, "server-data/resources"), { recursive: true });

  const resourceManifests = [];
  for (const file of glob.sync("src/**/manifest.yaml")) resourceManifests.push(file);

  const workers = [];
  if (IS_WORKERS_ENABLED) {
    throw new Error("Workers are not implemented yet.");
  } else {
    for (let file of resourceManifests) {
      file = normalize(file);

      const resourceName = file.split("/").at(-2);
      if (!resourceName) continue;

      const resource = new ScriptResource(resourceName, path.dirname(file));
      resources.push(resource);
    }

    for (const resource of resources) {
      const result = await resource.build();
      if (!result.success) {
        console.error(`Failed to build resource ${resource.name}`);
        continue;
      }

      for (const inclusion of result.data.resourceInclusions) {
        if (!resourceImportHierarchy[inclusion]) resourceImportHierarchy[inclusion] = [];

        // Prevent duplicates
        if (resourceImportHierarchy[inclusion].find((r) => r.name === resource.name))
          continue;

        resourceImportHierarchy[inclusion].push(resource);
      }
    }
  }

  copyConfig();
  saveFilesChecksum();

  fs.rmdirSync(path.join(CACHE_FOLDER, "build"), { recursive: true });
}

if (import.meta && import.meta.main) {
  buildServer();
}
