import * as bun from "bun";

import fs from "fs";
import path from "path";

export const DEBUG_ENABLED = bun.argv.includes("--debug") ?? true;
export const BUNDLE_SCRIPTS = bun.argv.includes("--bundle") ?? false;
export const MINIFY_OUTPUT = bun.argv.includes("--minify") ?? false;

export const RESOURCE_PER_WORKER = 5;
export const IS_WORKERS_ENABLED = false;

export const DIST_FOLDER = path.resolve("./.dist");
export const CACHE_FOLDER = path.resolve("./.cache");
export const ENV_EXPOSED_PREFIXES = ["SHARED_", "CLIENT_"];

export const CONFIG_FILES = [
  { source: "config/server.cfg", destination: ".dist/server-data/server.cfg" },
];
