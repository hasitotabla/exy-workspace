import * as bun from "bun";
import fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { parse as envParse } from "dotenv";
import ora, { type Ora } from "ora";

import type { BaseResource } from "./resource/BaseResource";
import { ScriptResource } from "./resource/ScriptResource";
import { normalize } from "../Utils";

import {
    CACHE_FOLDER,
    CLEAR_BUILD,
    CLEAR_BUILD_CACHE,
    DIST_FOLDER,
    ARE_WORKERS_ENABLED,
    RESOURCE_PER_WORKER,
} from "../Consts";
import { saveFilesChecksum } from "../utility/Checksum";
import { copyConfig, copyPersistentResources } from "./Config";
import { deferredPromise } from "./helpers/Promise";

export let GLOBAL_ENV = {};

type Resource = BaseResource | ScriptResource;

export const resourceImportHierarchy: { [key: string]: ScriptResource[] } = {};
export const resources: Array<Resource> = [];

// let oraHandle: Ora | null = null;

const createWorker = async (workerId: number, resources: string[]) => {
    const worker = new Worker(new URL("./workers/Builder.ts", import.meta.url), {
        type: "module",
    });

    const { promise, resolve, reject } = deferredPromise();

    worker.onmessage = (ev) => {
        const { event, data } = ev.data;

        if (event === "done") {
            for (const [resourceName, imports] of Object.entries(data.importHierarchy)) {
                if (!resourceImportHierarchy[resourceName]) {
                    resourceImportHierarchy[resourceName] = [];
                }

                for (const resourcePath of imports as string[]) {
                    const resource = new ScriptResource(resourceName, resourcePath);

                    if (!resourceImportHierarchy[resourceName].includes(resource)) {
                        resourceImportHierarchy[resourceName].push(resource);
                    }
                }
            }

            // if (oraHandle) {
            //     oraHandle.color = "green";
            //     oraHandle.text = `Worker ${workerId} finished building resources.`;
            // }

            worker.terminate();
            resolve();
        }
    };

    worker.onerror = (err) => {
        reject(err);
    };

    worker.postMessage({ event: "build", data: resources });
    return promise;
};

export async function buildServer() {
    // oraHandle = ora("Building resources").start();

    const envPath = path.resolve("./.env");
    GLOBAL_ENV = fs.existsSync(envPath) ? envParse(fs.readFileSync(envPath)) : {};

    if (CLEAR_BUILD)
        fs.rmdirSync(path.join(DIST_FOLDER, "server-data/resources"), {
            recursive: true,
        });

    const resourceManifests = [];
    for (const file of glob.sync("src/**/manifest.json")) resourceManifests.push(file);

    if (ARE_WORKERS_ENABLED) {
        const start = Date.now();
        const workers: Promise<void>[] = [];

        const totalWorkers = Math.ceil(resourceManifests.length / RESOURCE_PER_WORKER);
        for (let i = 0; i < totalWorkers; i++) {
            const start = i * RESOURCE_PER_WORKER;
            const end = start + RESOURCE_PER_WORKER;

            const resources = resourceManifests.slice(start, end).map((x) => x.replace(/\\/g, "/"));

            workers.push(createWorker(i, resources));
        }

        // oraHandle.text = `Building ${resourceManifests.length} resources using ${totalWorkers} workers...`;
        // oraHandle.color = "blue";

        await Promise.all(workers);

        // oraHandle.text = `Finished building ${resourceManifests.length} resource with ${totalWorkers} workers in ${Date.now() - start}ms`;
        // oraHandle.color = "green";
    } else {
        const start = Date.now();

        // oraHandle.text = `Building ${resourceManifests.length}...`;
        // oraHandle.color = "blue";

        for (let file of resourceManifests) {
            file = normalize(file);

            const resourceName = file.split("/").at(-2);
            if (!resourceName) continue;

            const resource = new ScriptResource(resourceName, path.dirname(file));
            resources.push(resource);
        }

        for (const resource of resources) {
            const result = await resource.build();
            if (!result.success) {
                if (result.message !== "disabled") console.error(`Failed to build resource ${resource.name}`);
                continue;
            }

            for (const inclusion of result.data.resourceInclusions) {
                if (!resourceImportHierarchy[inclusion]) resourceImportHierarchy[inclusion] = [];

                // Prevent duplicates
                if (resourceImportHierarchy[inclusion].find((r) => r.name === resource.name)) continue;

                resourceImportHierarchy[inclusion].push(resource);
            }
        }

        // oraHandle.text = `Finished building resources in ${Date.now() - start}ms`;
        // oraHandle.color = "green";
    }

    await copyConfig();
    await copyPersistentResources();
    await saveFilesChecksum();

    if (CLEAR_BUILD_CACHE) fs.rmdirSync(path.join(CACHE_FOLDER, "build"), { recursive: true });

    // oraHandle.succeed();
}

if (import.meta && import.meta.main) {
    buildServer();
}
