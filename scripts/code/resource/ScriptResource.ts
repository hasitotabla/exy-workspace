import fs from "fs";
import path from "path";

import {
    BaseResource,
    DEFAULT_BUILD_OPTIONS,
    type BuildOptions,
    type BuildResult,
} from "./BaseResource";
import type {
    ResourceManifestScripts,
    ResourceResolvedItem,
    ResourceScriptEnv,
} from "../types/Manifest";
import { BUNDLE_SCRIPTS, FORCE_REBUILD } from "../../Consts";
import { isFileChecksumChanged } from "../../utility/Checksum";

import { useLuaBuilder } from "../builder/LuaBuilder";
import { useTypescriptBuilder } from "../builder/TSBuilder";
import { useCSharpBuilder } from "../builder/CSBuilder";

const BUILDERS = [useLuaBuilder, useTypescriptBuilder, useCSharpBuilder];

export class ScriptResource extends BaseResource {
    constructor(name: string, path: string) {
        super(name, path);
    }

    public async build(
        options: Partial<BuildOptions> = DEFAULT_BUILD_OPTIONS
    ): Promise<BuildResult> {
        if (this.resourceRoot.includes("[disabled]")) {
            return { success: false, message: "disabled" };
        }

        await this.callHook("preBuild");

        let resourceInclusions: string[] = [];

        let didChecksumChange = false;
        let scriptsToBuild: {
            [key in ResourceScriptEnv]: Array<ResourceResolvedItem>;
        } = {
            shared: [],
            server: [],
            client: [],
        };

        for (const scriptEnv of ["shared", "server", "client"] as ResourceScriptEnv[]) {
            const scripts = this._manifest[`${scriptEnv}_scripts`];
            if (!scripts) continue;

            for (const script of scripts) {
                const scriptPath = typeof script === "string" ? script : script.src;

                // TODO(hasitotabla): checksum change detection
                let resolved = this.resolveFilePath(scriptPath).filter(
                    async (x) =>
                        BUNDLE_SCRIPTS ||
                        options?.force ||
                        !fs.existsSync(x.target) ||
                        (await isFileChecksumChanged(x.source, true))
                );

                scriptsToBuild[scriptEnv] = [...scriptsToBuild[scriptEnv], ...resolved];
                resourceInclusions = [
                    ...resourceInclusions,
                    ...resolved
                        .map((x) => x.resourceName)
                        .filter(
                            (x) => x !== this._name && !resourceInclusions.includes(x)
                        ),
                ];

                if (resolved.length > 0) didChecksumChange = true;
            }
        }

        const result = await this.callHook("postResolve", { scripts: scriptsToBuild });
        if (result) {
            scriptsToBuild = result.scripts;
        }

        // TODO(hasitotabla): fix checksum change detection
        // if (!didChecksumChange && !FORCE_REBUILD) {
        //     console.log(`Skipping build for ${this._name}`);
        //     return { success: true, data: { resourceInclusions } };
        // }

        const builtScriptsManifest: ResourceManifestScripts = {
            shared: [],
            server: [],
            client: [],
        };
        for (const runtimeBuilder of BUILDERS) {
            const builder = runtimeBuilder({
                resourceName: this._name,
                resourceRoot: this.resourceRoot,
                outputTarget: this._outputTarget,
                env: this._env,
            });

            const runtimeScripts = {
                shared: scriptsToBuild.shared.filter((x) => builder.filter(x.source)),
                server: scriptsToBuild.server.filter((x) => builder.filter(x.source)),
                client: scriptsToBuild.client.filter((x) => builder.filter(x.source)),
            };

            const numOfRuntimeScripts = Object.values(runtimeScripts).reduce(
                (prev, curr) => prev + curr.length,
                0
            );

            if (numOfRuntimeScripts < 1) {
                continue;
            }

            const { manifest } = await builder.build({
                shared: runtimeScripts.shared,
                server: runtimeScripts.server,
                client: runtimeScripts.client,
            });

            for (const env of ["server", "client"] as ResourceScriptEnv[]) {
                builtScriptsManifest[env] = [
                    ...builtScriptsManifest[env],
                    ...manifest[env],
                ];
            }
        }

        await this.callHook("postBuild");

        this.copyResourceFiles();
        this.generateResourceManifest(builtScriptsManifest);
        this.deleteBuildFolder();
        this.removeTemporaryFilesFromManifest();

        await this.callHook("finished");

        return { success: true, data: { resourceInclusions } };
    }
}
