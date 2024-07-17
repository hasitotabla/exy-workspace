import { $ } from "bun";
import fs from "fs";
import path from "path";
import axios from "axios";
import { load as htmlparse } from "cheerio";
import node7z from "node-7z";
import ora, { type Ora } from "ora";

import { downloadFile } from "../Utils";
import { DIST_FOLDER } from "../Consts";

async function getLatestRelease(
  platform: string,
  branch: "master" | "recommended" | "latest"
): Promise<string | null> {
  let htmlData = "";

  try {
    const { data } = await axios.get(
      `https://runtime.fivem.net/artifacts/fivem/${platform}/master/`
    );
    if (!data) {
      throw new Error("No data returned from the server");
    }

    htmlData = data;
  } catch (error) {
    console.error(error);
    return null;
  }

  const $ = htmlparse(htmlData);
  let partialUrl = "";

  switch (branch) {
    case "master": {
      const button = $(".panel-block.is-active");
      if (!button) {
        console.error("No active button found");
        return null;
      }

      const url = button.attr("href");
      if (!url) {
        console.error("No href attribute found");
        return null;
      }

      partialUrl = url.replace("./", "");

      break;
    }

    case "latest": {
      const anchor = $("a.panel-block.is-active");
      if (!anchor) {
        console.error("No active anchor found");
        return null;
      }

      const url = anchor.attr("href");
      if (!url) {
        console.error("No href attribute found");
        return null;
      }

      partialUrl = url.replace("./", "");
      break;
    }

    case "recommended":
    default: {
      const button = $(".panel-block a");
      if (!button) {
        console.error("No active button found");
        return null;
      }

      const url = button.attr("href");
      if (!url) {
        console.error("No href attribute found");
        return null;
      }

      partialUrl = url.replace("./", "");
      break;
    }
  }

  return `https://runtime.fivem.net/artifacts/fivem/${platform}/master/${partialUrl}`;
}

async function extractServer(fileName: string, outputFolder: string): Promise<boolean> {
  switch (process.platform) {
    case "win32": {
      const promise = new Promise<boolean>((resolve, reject) => {
        node7z
          .extractFull(`.cache/${fileName}`, outputFolder, {
            $bin:
              process.platform == "win32"
                ? path.resolve("./scripts/vendor/7z.exe")
                : "7z",
          })
          .on("error", (err) => reject(err))
          .on("end", () => {
            fs.rmSync(".cache/", { recursive: true });
            resolve(true);
          });
      });

      return promise;
    }

    // TODO: Implement this shit
    case "linux":
      //   const promise = new Promise<boolean>((resolve, reject) => {
      //     const result = $`tar -xvf .cache/${fileName} -C ${outputFolder}`;
      //     console.log(result);

      //     // fs.rmSync(".cache/", { recursive: true });
      //     // resolve(true);
      //   });

      //   return promise;

      return false;

    default:
      return false;
  }
}

export async function updateServer(
  forceUpdate = false,
  spinnerHandle: Ora | null = null
): Promise<boolean> {
  if (spinnerHandle) {
    spinnerHandle.text = "Checking for updates...";
    spinnerHandle.color = "green";
  }

  const latestReleaseUrl = await getLatestRelease(
    process.platform == "win32" ? "build_server_windows" : "build_proot_linux",
    "latest"
  );
  if (!latestReleaseUrl) {
    if (spinnerHandle) spinnerHandle.fail("Failed to get latest release URL");

    return false;
  }

  if (!fs.existsSync("./.cache")) {
    fs.mkdirSync("./.cache", { recursive: true });
  }

  const fileName = process.platform === "win32" ? "server.7z" : "fx.tar.xz";
  await downloadFile(latestReleaseUrl, `./.cache/${fileName}`);

  if (!fs.existsSync(`./.cache/${fileName}`)) {
    if (spinnerHandle) spinnerHandle.fail("Failed to download the latest release");
    return false;
  }

  const serverBinFolder = path.resolve(DIST_FOLDER, "server");
  if (!fs.existsSync(serverBinFolder)) {
    fs.mkdirSync(serverBinFolder, { recursive: true });
  }

  if (spinnerHandle) spinnerHandle.text = "Extracting the latest release...";

  const success = await extractServer(fileName, serverBinFolder);
  if (!success) {
    if (spinnerHandle) spinnerHandle.fail("Failed to extract the latest release");
    return false;
  }

  fs.rmSync(`./.cache/${fileName}`, { force: true });
  if (spinnerHandle) spinnerHandle.text = "Server updated successfully!";

  return true;
}

if (import.meta && import.meta.main) {
  const spinner = ora("Updating server...").start();
  const result = await updateServer(false, spinner);

  if (!result) {
    spinner.fail("Failed to update the server");
  } else {
    spinner.succeed("Server updated successfully");
  }
}
