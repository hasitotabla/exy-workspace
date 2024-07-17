import * as fs from "fs";
import * as path from "path";

import { useServer } from "./_Server";
import { normalize } from "../Utils";
import { ScriptResource } from "../code/resource/ScriptResource";
import { buildServer } from "../code/Build";

async function main() {
  const server = useServer();
  const fileChanges: { [key: string]: Timer } = {};

  const getResourceDetailsFromPath = (
    filePath: string
  ): { name: string; path: string } | null => {
    const splitted = filePath.split("/");
    console.log(filePath);
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

  const onFileChange = (filePath: string) => {
    if (!filePath) return;

    const resourceData = getResourceDetailsFromPath(filePath);
    if (!resourceData) return;

    const { name: resourceName, path: resourcePath } = resourceData;
    if (fileChanges[resourceName]) clearTimeout(fileChanges[resourceName]);

    fileChanges[resourceName] = setTimeout(async () => {
      const resource = ScriptResource.create(resourceName, resourcePath);
      const result = await resource.build();

      if (!result.success) {
        console.error(`Failed to build resource ${resourceName}`);
        return;
      }

      server.restartResources([...result.data.resourceInclusions, resourceName]);
    }, 500);
  };

  fs.watch(
    "./src",
    { recursive: true },
    (event, fileName) => fileName && onFileChange(normalize(fileName))
  );

  await buildServer();
  server.start();
}

if (import.meta && import.meta.main) {
  main();
}
