import * as fs from "fs";
import * as path from "path";

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

  const buildResource = async (name: string, path: string): Promise<string[] | null> => {
    const resource = ScriptResource.create(name, path);
    const result = await resource.build();

    if (!result.success) {
      console.error(`Failed to build resource ${name}`);
      return null;
    }

    if (!resourceImportHierarchy[name]) {
      return [name];
    }

    let childResources = [];
    for (const resource of resourceImportHierarchy[name]) {
      resource.build({ reloadManifest: true });
      childResources.push(resource.name);
    }

    console.log("order", [name, ...childResources]);

    return [name, ...childResources];
  };

  const onFileChange = async (filePath: string) => {
    if (!filePath) return;

    const resourceData = getResourceDetailsFromPath(filePath);
    if (!resourceData) return;

    const { name: resourceName, path: resourcePath } = resourceData;
    if (fileChanges[resourceName]) clearTimeout(fileChanges[resourceName]);

    fileChanges[resourceName] = setTimeout(async () => {
      const resourcesToRestart = await buildResource(resourceName, resourcePath);
      if (!resourcesToRestart) return;

      server.restartResources(resourcesToRestart);
    }, 500);

    // fileChanges[resourceName] = setTimeout(async () => {
    //   const resource = ScriptResource.create(resourceName, resourcePath);
    //   const result = await resource.build();

    //   if (!result.success) {
    //     console.error(`Failed to build resource ${resourceName}`);
    //     return;
    //   }

    //   server.restartResources([...result.data.resourceInclusions, resourceName]);
    // }, 500);
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
