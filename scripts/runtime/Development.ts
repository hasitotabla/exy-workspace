import * as fs from "fs";
import * as path from "path";
import gitignore from "@gerhobbelt/gitignore-parser";

import { useServer } from "./_Server";
import { normalize } from "../Utils";
import { ScriptResource } from "../code/resource/ScriptResource";
import { buildServer, resourceImportHierarchy } from "../code/Build";

const resourcesInclusions: { [key: string]: string[] } = {};

async function main() {
  const server = useServer();
  const fileChanges: { [key: string]: Timer } = {};

  const getResourceDetailsFromPath = (
    filePath: string
  ): { name: string; path: string } | null => {
    const splitted = filePath.split("/");
    for (let i = splitted.length; i > 0; i--) {
      const resourcePath = path.join("src", ...splitted.slice(0, i), "manifest.yaml");

      if (fs.existsSync(resourcePath)) {
        return {
          name: splitted[i - 1],
          path: normalize(path.dirname(resourcePath)),
        };
      }
    }

    return null;
  };

  const isPathIgnored = (filePath: string) =>
    !fs.existsSync(path.join("src", filePath)) ||
    !fs.fstatSync(fs.openSync(path.join("src", filePath), "r")).isFile() ||
    [/.*node_modules.*/, /.*\.git.*/].some((x) => x.exec(filePath));

  const buildResources = async (
    resourceName: string,
    resourcePath: string,
    updatedFile: string
  ): Promise<string[] | null> => {
    const resource = ScriptResource.create(resourceName, resourcePath);

    const isManifest = updatedFile.endsWith("manifest.yaml");
    const updateFileRelative = updatedFile.replace(resourceName, "");

    // console.log(
    //   updatedFile,
    //   updateFileRelative,
    //   !isManifest,
    //   resource.manifest?.watcher?.ignore &&
    //     gitignore.compile(resource.manifest.watcher.ignore).denies(updateFileRelative)
    // );

    if (
      !isManifest &&
      resource.manifest?.watcher?.ignore &&
      gitignore.compile(resource.manifest.watcher.ignore).denies(updateFileRelative)
    )
      return null;

    const result = await resource.build();

    if (!result.success) {
      console.error(`Failed to build resource ${resourceName}`);
      return null;
    }

    if (!resourceImportHierarchy[resourceName]) {
      return [resourceName];
    }

    let childResources = [];
    for (const resource of resourceImportHierarchy[resourceName]) {
      resource.build({ reloadManifest: true });
      childResources.push(resource.name);
    }

    return [resourceName, ...childResources];
  };

  const onFileChange = async (filePath: string) => {
    if (isPathIgnored(filePath)) return;

    const resourceData = getResourceDetailsFromPath(filePath);
    if (!resourceData) return;

    const { name: resourceName, path: resourcePath } = resourceData;
    if (fileChanges[resourceName]) clearTimeout(fileChanges[resourceName]);

    fileChanges[resourceName] = setTimeout(async () => {
      const resourcesToRestart = await buildResources(
        resourceName,
        resourcePath,
        filePath
      );
      if (!resourcesToRestart) return;

      server.restartResources(resourcesToRestart);
    }, 500);
  };

  fs.watch(
    "./src",
    { recursive: true },
    (event, fileName) => fileName && onFileChange(normalize(fileName))
  );

  server.start();
}

if (import.meta && import.meta.main) {
  console.log("Building server...");
  await buildServer();
  console.log("Build finished");

  main();
}
