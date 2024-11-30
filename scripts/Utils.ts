import fs from "fs";
import axios from "axios";

export function getPlatform() {
    return process.platform;
}

export const normalize = (str: string) => str.replace(/\\/g, "/");
export const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export const sanitizeBrackets = (Path: string) => Path.replace(/[\[\]]/g, (Match) => `\\${Match}`);

export const generateString = (length: number) =>
    Array.from({ length }, () => Math.random().toString(36)[2]).join("");

export const writeFile = (filePath: string, data: string) => {
    const targetPath = filePath.replace(/\\/g, "/").split("/").slice(0, -1);
    if (!fs.existsSync(targetPath.join("/"))) {
        fs.mkdirSync(targetPath.join("/"), { recursive: true });
    }

    fs.writeFileSync(filePath, data);
};

export const copyFile = (source: string, target: string) => {
    const targetPath = target.split("/").slice(0, -1);
    if (!fs.existsSync(targetPath.join("/"))) {
        fs.mkdirSync(targetPath.join("/"), { recursive: true });
    }

    fs.copyFileSync(source, target);
};

export const getCpuCores = () => require("os").cpus().length;

export const flatenObject = (obj: Record<string, any>, prefix = "") => {
    const result: Record<string, any> = {};

    for (const key in obj) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (typeof value === "object") {
            Object.assign(result, flatenObject(value, newKey));
        } else {
            result[newKey] = value;
        }
    }

    return result;
};

export async function downloadFile(downloadUrl: string, outputPath: string) {
    if (!downloadUrl) throw new Error("No URL provided");
    if (!outputPath) throw new Error("No output path provided");

    const targetPath = outputPath.split("/").slice(0, -1);
    if (!fs.existsSync(targetPath.join("/"))) {
        fs.mkdirSync(targetPath.join("/"), { recursive: true });
    }

    const writer = fs.createWriteStream(outputPath);

    try {
        const response = await axios({
            method: "get",
            url: downloadUrl,
            responseType: "stream",
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        return true;
    } catch (error) {
        return false;
    }
}
