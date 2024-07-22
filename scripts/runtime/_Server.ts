import { spawnSync, exec, type SpawnSyncReturns } from "node:child_process";
import path from "path";
import { DIST_FOLDER } from "../Consts";

const platformStartupParams = {
  win32: {
    txAdminPort: "40126",
    txDataPath: "../server-data",
  },
  linux: {
    txAdminPort: "40126",
    txDataPath: "../server-data",
  },
};

const defaultServerSettings = {
  serverPath: path.resolve(DIST_FOLDER, "server"),
};

export function useServer(
  settings: typeof defaultServerSettings = defaultServerSettings
) {
  let server: SpawnSyncReturns<Buffer> | null = null;

  const start = () => {
    if (server) return;

    console.log("Starting server...");

    const startupParams = Object.entries(
      platformStartupParams[process.platform as keyof typeof platformStartupParams] || {}
    )
      .map(([key, value]) => `+set ${key} ${value}`)
      .join(" ");

    server = spawnSync(`${settings.serverPath}/FXServer.exe`, [startupParams], {
      cwd: settings.serverPath,
      stdio: "inherit",
    });
  };

  const stop = () => {
    if (!server) return;

    console.log("Stopping server...");

    const killCommand =
      process.platform === "win32" ? "taskkill /F /IM FXServer.exe" : "killall FXServer";

    return new Promise((resolve) => {
      exec(killCommand).on("exit", () => resolve(true));
    });
  };

  const restartResources = async (resources: string[]) => {
    const response = await fetch("http://localhost:30120/hmr/restartResources", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Authorization: process.env.TOKEN,
      },
      body: JSON.stringify({ resources }),
    });

    const data = await response.text();
  };

  return {
    start,
    stop,
    restartResources,
  };
}
