import fs from "fs";
import path from "path";
import crypto from "crypto";

const checksumPath = path.resolve("./.cache/.checksums.json");
const checksumList = fs.existsSync(checksumPath)
  ? JSON.parse(fs.readFileSync(checksumPath, "utf-8"))
  : {};

export function generateFileChecksum(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const fileContent = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileContent).digest("hex");
}

export async function setFileChecksum(filePath: string, checksum?: string) {
  if (!checksum) checksum = generateFileChecksum(filePath);
  checksumList[filePath] = checksum;
}

export async function isFileChecksumChanged(filePath: string, addNew = true) {
  if (!fs.existsSync(path.resolve(filePath))) return true;

  if (!checksumList[filePath]) {
    if (addNew) await setFileChecksum(filePath);
    return true;
  }

  const currentChecksum = generateFileChecksum(filePath);
  if (!currentChecksum || currentChecksum !== checksumList[filePath]) {
    if (addNew) setFileChecksum(filePath, currentChecksum);
    return true;
  }

  return false;
}

/**
 *
 * @param sourceFile
 * @param targetFile
 * @returns if the checksums are the same return true, otherwise return false
 */
export async function compareFilesChecksum(
  sourceFile: string,
  targetFile: string,
  save?: "both" | "source" | "target"
) {
  const sourceFileChecksum = generateFileChecksum(sourceFile);
  if (!sourceFileChecksum || !checksumList[sourceFile]) {
    if (save == "both" || save == "source")
      await setFileChecksum(sourceFile, sourceFileChecksum);

    return false;
  }

  const targetFileChecksum = generateFileChecksum(targetFile);
  if (!targetFileChecksum) {
    if (save == "both" || save == "target")
      await setFileChecksum(targetFile, targetFileChecksum);

    return false;
  }

  return sourceFileChecksum == targetFileChecksum;
}

export async function saveFilesChecksum() {
  if (!fs.existsSync("./.cache/")) fs.mkdirSync("./.cache/", { recursive: true });
  fs.writeFileSync(checksumPath, JSON.stringify(checksumList, null, 2));
}
