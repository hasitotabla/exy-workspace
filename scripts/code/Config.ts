import fs from "fs";
import path from "path";

import { CONFIG_FILES, DIST_FOLDER } from "../Consts";
import { glob } from "glob";

export function copyConfig() {
  for (const { source, destination } of CONFIG_FILES) {
    if (!fs.existsSync(source)) {
      console.error(`Config file not found: ${source}`);
      continue;
    }

    fs.copyFileSync(source, destination);
  }
}

export function copyPersistentResources() {
  const target = path.resolve(DIST_FOLDER, "server-data/resources");
  const sources = glob
    .sync("config/resources/**/{fxmanifest,__resource}.lua")
    .map((x) => path.resolve(x.replace(/\\/g, "/").split("/").slice(0, -1).join("/")));

  for (const file of sources) {
    const resourceName = file.split("\\").at(-1) as string;
    const destination = path.join(target, "[__persistent__]", resourceName);

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(file, destination, { recursive: true });
  }
}
