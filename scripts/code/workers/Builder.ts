import fs from "fs";
import path from "path";

import { normalize } from "$scripts/Utils";
import { WorkerWrapper } from "../helpers/Worker";
import { ScriptResource } from "../resource/ScriptResource";

const buildResources = async (manifests: string[]) => {
    const resources: ScriptResource[] = [];
    const importHierarchy: { [key: string]: string[] } = {};

    for (let file of manifests) {
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
            if (!importHierarchy[inclusion]) {
                importHierarchy[inclusion] = [];
            }

            // Prevent duplicates
            if (importHierarchy[inclusion].find((r) => r === resource.name)) {
                continue;
            }

            importHierarchy[inclusion].push(resource.resourceRoot);
        }
    }

    self.postMessage({ event: "done", data: { importHierarchy } });
};

self.onmessage = (ev) => {
    const { event, data } = ev.data;

    switch (event) {
        case "build": {
            buildResources(data);
        }
    }
};
