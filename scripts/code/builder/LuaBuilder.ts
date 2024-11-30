import fs from "fs";
import path from "path";
import crypto from "crypto";
import { $, sleep } from "bun";
import { spawnSync } from "node:child_process";
// @ts-ignore
import * as luamin from "luamin";

import {
    BUILDER_SILENT,
    BUNDLE_SCRIPTS,
    CACHE_FOLDER,
    CLEAR_BUILD_CACHE,
    ENV_EXPOSED_PREFIXES,
    MINIFY_OUTPUT,
    OBFUSCATE_SCRIPTS,
    VERBOSE_BUILD,
} from "../../Consts";
import type { ResourceResolvedItem, ResourceScriptEnv } from "../types/Manifest";
import { generateString } from "../../Utils";
import type { RuntimeBuilder } from "../Types";
import type { Required } from "$scripts/Types";
import { obfuscator } from "../helpers/Obfuscator";

export interface ILuaBuilderOptions {}

const isLunix = () => ["linux", "darwin"].includes(process.platform);

const preprocessScriptPath = path.resolve(`./scripts/vendor/lua/preprocess${isLunix() ? ".sh" : ".cmd"}`);

const defaultBuilderOptions: Partial<ILuaBuilderOptions> = {
    env: {},
};

export const useLuaBuilder: RuntimeBuilder<ILuaBuilderOptions> = (options) => {
    const _options = { ...defaultBuilderOptions, ...options } as Required<typeof options>;

    if (!_options.outputTarget) throw new Error(`Output target does not exist: ${_options.outputTarget}`);

    const runPreprocessor = async (sourcePath: string, targetPath: string) => {
        try {
            const targetFolder = path.dirname(targetPath);
            if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });

            if (isLunix())
                spawnSync(
                    "sh",
                    [
                        preprocessScriptPath,
                        !BUILDER_SILENT ? "--silent" : "",
                        "-o",
                        "--backtickstrings",
                        "--jitsyntax",
                        sourcePath,
                        targetPath,
                    ],
                    { encoding: "utf8", stdio: VERBOSE_BUILD ? "inherit" : "ignore" },
                );
            else
                spawnSync(
                    preprocessScriptPath,
                    [
                        !BUILDER_SILENT ? "--silent" : "",
                        "-o",
                        "--backtickstrings",
                        "--jitsyntax",
                        sourcePath,
                        targetPath,
                    ],
                    { encoding: "utf8", stdio: VERBOSE_BUILD ? "inherit" : "ignore" },
                );

            for (let i = 0; i < 15; i++) {
                if (fs.existsSync(targetPath)) break;

                if (i === 1)
                    console.log(
                        `Waiting for preprocessor to finish for file '${sourcePath}:${targetPath}'...`,
                    );

                await sleep(100);
            }

            if (!fs.existsSync(targetPath)) {
                console.error(`Preprocessor failed for file '${sourcePath}:${targetPath}'`);
                return false;
            }

            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    };

    const buildAndBundle = async (scripts: Array<ResourceResolvedItem>, scriptEnv: ResourceScriptEnv) => {
        let bundledContent = ``;

        for (const script of scripts) {
            const compiledScript = await buildSource(scriptEnv, script.source);
            if (typeof compiledScript !== "string") continue;

            bundledContent += `\n\n-- ${script.source}\ndo\n${
                MINIFY_OUTPUT ? compiledScript
                    // padding non-minified code to make it look better (and collapsable)
                : (
                    compiledScript
                        .split("\n")
                        .map((x) => "\t" + x)
                        .join("\n")
                )
            }\nend`;
        }

        try {
            if (MINIFY_OUTPUT) {
                bundledContent = luamin.minify(bundledContent);
            }
        } catch (error) {
            console.error(`Failed to minify ${_options.resourceName}'s bundle: ${error}`);
        }

        const bundleFileName = `${scriptEnv}_bundle.lua`;
        const outputPath = path.join(_options.outputTarget, bundleFileName);

        if (bundledContent === "") return;

        if (OBFUSCATE_SCRIPTS && scriptEnv !== "server")
            bundledContent = await obfuscateSource(bundledContent);

        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, bundledContent);
    };

    const buildSource = async (
        scriptEnv: ResourceScriptEnv,
        sourcePath: string,
        targetPath?: string,
        obfuscate = false,
    ): Promise<string | boolean> => {
        const preprocessedSource = getSourceCode(sourcePath, scriptEnv);

        const parsedPath = path.parse(sourcePath);
        const tempFileName = `${parsedPath.name}_${scriptEnv}${parsedPath.ext}`;

        const tempBuildPath = path.join(CACHE_FOLDER, `build`, _options.resourceName, `${tempFileName}`);

        fs.mkdirSync(path.dirname(tempBuildPath), { recursive: true });

        if (fs.existsSync(tempBuildPath) && CLEAR_BUILD_CACHE) fs.unlinkSync(tempBuildPath);
        fs.writeFileSync(tempBuildPath, preprocessedSource);

        // if (targetPath) {
        //   return runPreprocessor(tempBuildPath, targetPath);
        // }

        const tempOutputPath = `${tempBuildPath}_${generateString(8)}.out`;
        if (!runPreprocessor(tempBuildPath, tempOutputPath)) {
            return false;
        }

        if (!fs.existsSync(tempOutputPath)) {
            console.error(`Failed to preprocess ${sourcePath}`);
            return false;
        }

        let processedFileContent = fs.readFileSync(tempOutputPath, { encoding: "utf-8" });

        processedFileContent = processedFileContent
            .split("\n")
            .filter((x) => x.trim() !== "")
            .join("\n");

        if (obfuscate && scriptEnv !== "server") {
            processedFileContent = await obfuscateSource(processedFileContent);
        }

        if (CLEAR_BUILD_CACHE) {
            fs.unlinkSync(tempBuildPath);
            fs.unlinkSync(tempOutputPath);
        }

        if (targetPath) {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, processedFileContent);

            return true;
        }

        return processedFileContent;
    };

    const obfuscateSource = async (source: string): Promise<string> => {
        const obfuscated = await obfuscator.obfuscate(source);
        if (!obfuscated) throw new Error(`Failed to obfuscate source`);

        return obfuscated;
    };

    const getSourceCode = (source: string, scriptEnv: ResourceScriptEnv) => {
        let content = fs.readFileSync(source, { encoding: "utf-8" });
        let headers = `
            !local SCRIPT_ENV = '${scriptEnv}';
            !local RESOURCE_NAME = '${_options.resourceName ?? "unknown"}';

            !local IS_SERVER = ${scriptEnv === "server"};
            !local IS_CLIENT = ${scriptEnv === "client"};
            !local IS_SHARED = ${scriptEnv === "shared"};
        `;

        headers += Object.keys(_options?.env || {})
            .filter((x) => scriptEnv === "server" || ENV_EXPOSED_PREFIXES.some((y) => x.startsWith(y)))
            .reduce<string[]>(
                (Prev, Curr) => [
                    ...Prev,
                    `!local ${Curr} = ${
                        typeof _options?.env[Curr] === "string" ?
                            `'${_options?.env[Curr]}'`
                        :   _options?.env[Curr]
                    };`,
                ],
                [],
            )
            .join("\n");

        content = `${headers}\n\n${content.substring(content.charCodeAt(0) > 60000 ? 1 : 0)}`;
        return content;
    };

    return {
        filter: (fileName: string) => fileName.endsWith(".lua"),
        build: async (scripts) => {
            const manifestItems: {
                [key in ResourceScriptEnv]: Array<string>;
            } = {
                shared: [],
                server: [],
                client: [],
            };

            if (BUNDLE_SCRIPTS) {
                for (const scriptEnv of ["server", "client"] as ResourceScriptEnv[])
                    await buildAndBundle([...scripts.shared, ...scripts[scriptEnv]], scriptEnv);

                manifestItems.server = ["server_bundle.lua"];
                manifestItems.client = ["client_bundle.lua"];
            } else {
                for (const scriptEnv of ["server", "client"] as ResourceScriptEnv[]) {
                    const combinedScripts = [...scripts.shared, ...scripts[scriptEnv]];

                    for (const script of combinedScripts) {
                        const parsedSource = path.parse(script.source);
                        await buildSource(
                            scriptEnv,
                            script.source,
                            script.target.replace(
                                parsedSource.base,
                                `${parsedSource.name}_${scriptEnv}${parsedSource.ext}`,
                            ),
                            OBFUSCATE_SCRIPTS,
                        );

                        const parsedTarget = path.parse(script.targetManifest);
                        manifestItems[scriptEnv] = [
                            ...manifestItems[scriptEnv],
                            script.targetManifest.replace(
                                parsedTarget.base,
                                `${parsedTarget.name}_${scriptEnv}${parsedTarget.ext}`,
                            ),
                        ];
                    }
                }
            }

            return { manifest: manifestItems };
        },
    };
};
