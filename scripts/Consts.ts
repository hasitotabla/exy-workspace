import path from "path";
import { useArguments } from "./utility/Arguments";

const args = useArguments();

export const VERBOSE_BUILD = args.includes("--verbose");
export const BUILDER_SILENT = args.includes("--silent");

export const DEBUG_ENABLED = args.includes("--debug");
export const BUNDLE_SCRIPTS = args.includes("--bundle");
export const MINIFY_OUTPUT = args.includes("--minify");
export const CLEAR_BUILD = args.includes("--clear");
export const FORCE_REBUILD = args.includes("--rebuild");

export const RESOURCE_PER_WORKER = 2;
export const ARE_WORKERS_ENABLED = false;
export const CLEAR_BUILD_CACHE = false;
export const OBFUSCATE_SCRIPTS = false;

export const DIST_FOLDER = path.resolve("./.dist");
export const CACHE_FOLDER = path.resolve("./.cache");
export const ENV_EXPOSED_PREFIXES = ["SHARED_", "CLIENT_"];

export const CONFIG_FILES = [
  { source: "config/server.cfg", destination: ".dist/server-data/server.cfg" },
];
