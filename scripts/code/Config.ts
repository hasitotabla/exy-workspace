import fs from "fs";
import path from "path";

import { CONFIG_FILES } from "../Consts";

export function copyConfig() {
  for (const { source, destination } of CONFIG_FILES) {
    if (!fs.existsSync(source)) {
      console.error(`Config file not found: ${source}`);
      continue;
    }

    fs.copyFileSync(source, destination);
  }
}
