import fs from "fs";
import path from "path";
import { $ } from "bun";
import { glob } from "glob";
import { format } from "prettier";
import { writeFile } from "./Utils";

const BUILD_FOLDER = path.resolve("./.cache/convert");

const getLuaScript = (manifest: string) => {
    return `
local json = require('scripts.vendor.lua.json')
local tbl = require('scripts.vendor.lua.table')        

iprint = function(...)
    local args = { ... };
    local output = {};

    for _, arg in ipairs(args) do 
        if (type(arg) == "table") then 
            table.insert(output, tbl.stringify(arg));
        else 
            table.insert(output, ((arg ~= nil) and tostring(arg) or "nil"));
        end 
    end 

    print(unpack(output));
end

local manifestData = {};

local sharedConverters = {
    toString = function(value, key, manifest) manifest[key] = value; return manifest; end,
    toArray = function(value, key, manifest) manifest[key] = value; return manifest; end,

    strToGroup = function(value, key, manifest) 
        if (not manifest[key]) then 
            manifest[key] = {};
        end

        table.insert(manifest[key], value);
        return manifest;
    end, 

    arrayToGroup = function(value, key, manifest) 
        if (not manifest[key]) then 
            manifest[key] = {};
        end

        for _, v in ipairs(value) do 
            table.insert(manifest[key], v);
        end

        return manifest;
    end
};

sharedConverters.strToKeyedGroup = function(overrideKey)
    return function(value, key, manifest) 
        if (not manifest[overrideKey]) then 
            manifest[overrideKey] = {};
        end

        table.insert(manifest[overrideKey], value);
        return manifest;
    end
end

sharedConverters.arrayToKeyedGroup = function(overrideKey)
    return function(value, key, manifest) 
        if (not manifest[overrideKey]) then 
            manifest[overrideKey] = {};
        end

        for _, v in ipairs(value) do 
            table.insert(manifest[overrideKey], v);
        end

        return manifest;
    end
end 

sharedConverters.exportToEnv = function(env)
    return function(value, key, manifest) 
        if (not manifest.exports) then 
            manifest.exports = {};
        end

        manifest.exports[value] = env;
        return manifest;
    end;
end 

sharedConverters.exportsToEnv = function(env)
    return function(value, key, manifest) 
        if (not manifest.exports) then 
            manifest.exports = {};
        end

        for _, v in ipairs(value) do 
            manifest.exports[v] = env;
        end

        return manifest;
    end;
end

local propertyConverters = {
    fxVersion = sharedConverters.toString, game = sharedConverters.toString,
    resource_manifest_version = sharedConverters.toString,

    client_script = sharedConverters.strToKeyedGroup("client_scripts"), 
    server_script = sharedConverters.strToKeyedGroup("server_scripts"),
    shared_script = sharedConverters.strToKeyedGroup("shared_scripts"),

    client_scripts = sharedConverters.arrayToGroup,
    server_scripts = sharedConverters.arrayToGroup,
    shared_scripts = sharedConverters.arrayToGroup,

    export = sharedConverters.exportToEnv("shared"),
    exports = sharedConverters.exportsToEnv("shared"),
    server_export = sharedConverters.exportToEnv("server"),
    server_exports = sharedConverters.exportsToEnv("server"),
    client_export = sharedConverters.exportToEnv("client"),
    client_exports = sharedConverters.exportsToEnv("client"),

    ui_page = sharedConverters.toString,
    before_level_meta = sharedConverters.toString,
    after_level_meta = sharedConverters.toString,
    replace_level_meta = sharedConverters.toString,
    data_file = sharedConverters.strToKeyedGroup("data_files"),
    data_files = sharedConverters.arrayToGroup,
    this_is_a_map = sharedConverters.toString,
    loadscreen = sharedConverters.toString,
    loadscreen_manual_shutdown = sharedConverters.toString,
    map = sharedConverters.toString,
    lua54 = sharedConverters.toString,
    provides = sharedConverters.arrayToGroup,
    webpack_config = sharedConverters.toString,

    file = sharedConverters.strToKeyedGroup("files"),
    files = sharedConverters.arrayToGroup,

    dependency = sharedConverters.strToKeyedGroup("dependencies"),
    dependencies = sharedConverters.arrayToGroup,
};

local createConverter = function(prop)
    if (not prop) then 
        return;
    end

    return (function(initialData)
        local nestedFuncCall;
        manifestData = propertyConverters[prop](initialData, prop, manifestData);

        nestedFuncCall = function(additionalData)
            manifestData = propertyConverters[prop](additionalData, prop, manifestData);
            return nestedFuncCall;
        end
    
        return nestedFuncCall;
    end);
end 

-- 
-- 
-- 

local settingsBuilder = function(prop)
    if (not prop) then 
        return;
    end

    return (function(initialData)
        local nestedFuncCall;

        if (not manifestData.settings) then 
            manifestData.settings = {};
        end

        if (not manifestData.settings[prop]) then 
            manifestData.settings[prop] = {};
        end

        local settingIndex = #manifestData.settings[prop] + 1;
        manifestData.settings[prop][settingIndex] = {};

        table.insert(manifestData.settings[prop][settingIndex], initialData);

        nestedFuncCall = function(additionalData)
            table.insert(manifestData.settings[prop][settingIndex], additionalData);
            return nestedFuncCall;
        end
    
        return nestedFuncCall;
    end);
end 

local settings = {
    "chat_theme", "resource_type", "spawnpoint",
};

-- 
-- Nope
-- 

local nop; nop = function() return nop; end
local nopFunctions = {
    "name", "description", "author", "version",
    "repository", "rdr3_warning", "game", "games", "fx_version", 
    "vehicle_generator"
};

for prop, _ in pairs(propertyConverters) do 
    _G[prop] = createConverter(prop);
end

for _, prop in ipairs(nopFunctions) do 
    _G[prop] = nop;
end

for _, prop in ipairs(settings) do 
    _G[prop] = settingsBuilder(prop);
end

-- 
-- Manifest
-- 

${manifest}

--
-- Output
-- 

-- for key, value in pairs(manifestData) do 
--     if (
--         type(value) == "table" and 
--         value[1] and type(value[1]) == "table" and 
--         value[1][1]
--     ) then 
--         manifestData[key] = value[1][1];
--     end 
-- end 

--iprint(manifestData)
print(json.encode(manifestData))`;
};

const propertyOrder: { [key: string]: number } = {
    shared_scripts: 4,
    server_scripts: 5,
    client_scripts: 6,

    exports: 7,

    ui_page: 8,
    files: 9,
};

(async () => {
    if (!fs.existsSync(BUILD_FOLDER)) {
        fs.mkdirSync(BUILD_FOLDER, { recursive: true });
    }

    const manifests = glob.sync("./src/**/{fxmanifest,__resource}.lua").map((x) => x.replace(/\\/g, "/"));

    for (const manifest of manifests) {
        // if (!manifest.includes("skater")) continue;

        const resourceName = path.basename(path.dirname(manifest));
        const outputPath = path.resolve(path.dirname(manifest), `manifest.json`);
        const manifestContent = fs.readFileSync(manifest, "utf-8");
        const convertPath = path.resolve(BUILD_FOLDER, `${resourceName}.lua`);

        const luaScript = getLuaScript(manifestContent);
        fs.writeFileSync(convertPath, luaScript);

        let result: any;

        try {
            const output = await $`./scripts/vendor/lua/bin/luajit.exe ${convertPath}`.text();
            result = JSON.parse(output.slice(0, -1));
        } catch (error) {
            console.error(error);
            process.exit(1);
        }

        const ordered = Object.keys(result)
            .sort((a, b) => (propertyOrder[a] || 9999) - (propertyOrder[b] || 9999))
            .reduce((obj, key) => {
                obj[key] = result[key];
                return obj;
            }, {} as any) as any;

        const formatted: any = await format(JSON.stringify(ordered), { parser: "json" });

        fs.unlinkSync(convertPath);
        fs.writeFileSync(outputPath, formatted);
    }

    fs.rmdirSync(BUILD_FOLDER, { recursive: true });
})();
