import { file as loadFile } from "bun";
import { glob } from "glob";
import { flatenObject } from "$scripts/Utils";

type Namespace = string;
type Language = string;
export type Locales = {
    _shared: { [key: Language]: { [key: string]: string } };
    resources: { [key: Namespace]: { [key: Language]: { [key: string]: string } } };
};

const locales = (() => {
    let isReady = false;
    let locales: Locales = { _shared: {}, resources: {} };

    const waitToLoad = () => {
        return new Promise<boolean>((resolve, reject) => {
            if (isReady) {
                return resolve(true);
            }

            let startedAt = Date.now();
            let interval = setInterval(() => {
                if (Date.now() - startedAt > 5000) {
                    clearInterval(interval);
                    reject("Timeout");
                }

                if (isReady) {
                    clearInterval(interval);
                    resolve(true);
                }
            }, 50);
        });
    };

    (async () => {
        const files = glob
            .sync("./translations/**/*.json")
            .map((x) => x.replace(/\\/g, "/"))
            .sort((a, b) => (b.includes("/_") ? -1 : 1) - (a.includes("/_") ? -1 : 1)); // _shared es tarsai utoljara rakasa

        for (const filePath of files) {
            const content = await loadFile(filePath).json();

            let [language, namespace] = filePath.split("/").slice(-2);
            namespace = namespace.replace(".json", "");

            if (!namespace.startsWith("_")) {
                if (!locales.resources[namespace]) locales.resources[namespace] = {};
                if (!locales.resources[namespace][language])
                    locales.resources[namespace][language] = {};

                locales.resources[namespace][language] = {
                    ...locales.resources[namespace][language],
                    ...flatenObject(content),
                };
            } else {
                locales._shared[language] = flatenObject(content, namespace);

                for (const resourceNamespace in locales.resources) {
                    if (!locales.resources[resourceNamespace])
                        locales.resources[resourceNamespace] = {};

                    for (const namespaceLanguage in locales.resources[
                        resourceNamespace
                    ]) {
                        if (!locales.resources[resourceNamespace][namespaceLanguage])
                            locales.resources[resourceNamespace][namespaceLanguage] = {};

                        locales.resources[resourceNamespace][namespaceLanguage] = {
                            ...locales.resources[resourceNamespace][namespaceLanguage],
                            ...flatenObject(content, namespace),
                        };
                    }
                }
            }
        }

        isReady = true;
    })();

    return {
        isReady,
        waitToLoad,
        get: () => locales,
    };
})();

export const getTranslations = async (resourceName: string) => {
    await locales.waitToLoad();

    const buildLanguage = process.env.LANGUAGE || "en";
    const result = locales.get();

    return (
        result?.resources?.[resourceName]?.[buildLanguage] ||
        result._shared[buildLanguage]
    );
};
