import { $ } from "bun";
import fs from "fs";
import path from "path";

import type { RuntimeBuilder } from "../Types";
import type { ResourceResolvedItem, ResourceScriptEnv } from "../types/Manifest";
import { glob } from "glob";
import { normalize } from "$scripts/Utils";
import { CACHE_FOLDER } from "$scripts/Consts";

interface ICSharpBuilderOptions {}

const defaultBuilderOptions: Partial<ICSharpBuilderOptions> = {
    env: {},
};

export const useCSharpBuilder: RuntimeBuilder<ICSharpBuilderOptions> = (options) => {
    const _options = { ...defaultBuilderOptions, ...options } as Required<typeof options>;

    const baseBuildFolder = path.join(CACHE_FOLDER, `build`, _options.resourceName);
    if (!fs.existsSync(baseBuildFolder))
        fs.mkdirSync(baseBuildFolder, { recursive: true });

    const filterRegex = new RegExp(
        `${_options.resourceName}\.(Server|Client)\.net\.dll$`,
        "gm"
    );

    const buildEnv = async (
        env: ResourceScriptEnv,
        scriptsInEnv: ResourceResolvedItem[]
    ): Promise<string[]> => {
        if (scriptsInEnv.length === 0) return [];
        if (scriptsInEnv.length > 1) {
            throw new Error(
                "C# builder does not support multiple scripts in the same environment"
            );
        }

        const script = scriptsInEnv[0];

        const sourceFolder = path.dirname(script.source);
        const targetFolder = path.dirname(script.target);
        const targetManifest = path.dirname(script.targetManifest);

        const buildFolder = path.join(baseBuildFolder, env);
        try {
            const result = await $`dotnet publish -c Release -o ${buildFolder}`.cwd(
                sourceFolder
            );
            if (result.exitCode !== 0) {
                throw new Error("Failed to build C# project");
            }

            // console.log(result.stdout);
        } catch (error) {
            console.log(`Failed to build C# project!`);
            console.error(error);
        }

        const copiedFiles = glob
            .sync("**/*.dll", { cwd: buildFolder, nodir: true })
            .map((x) => normalize(x))
            .filter(
                (x) =>
                    filterRegex.test(x) ||
                    (x.startsWith("CitizenFX.Core.") && env === "client")
            )
            .sort(
                (a, b) =>
                    (b.startsWith("CitizenFX.Core.") ? 1 : 0) -
                    (a.startsWith("CitizenFX.Core.") ? 1 : 0)
            );

        for (const file of copiedFiles) {
            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder, { recursive: true });
            }

            fs.copyFileSync(path.join(buildFolder, file), path.join(targetFolder, file));
        }

        return copiedFiles.map((x) => normalize(path.join(targetManifest, x)));
    };

    return {
        build: async (scripts) => {
            return {
                manifest: {
                    shared: [],
                    server: await buildEnv("server", scripts.server),
                    client: await buildEnv("client", scripts.client),
                },
            };
        },
        filter: (fileName: string) => fileName.endsWith(".cs"),
    };
};
