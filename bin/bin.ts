#!/usr/bin/env node

import { readFileSync } from "fs";
import { mainInit } from "../index.js";
import { UpstreamType, type Config } from "../core.js";


const filePath = process.argv[2];
const fileContent = filePath ? readFileSync(filePath, "utf-8") : null;
if (!fileContent) {
    console.error("No config file provided or file is empty.");
    process.exit(1);
}

const config: Record<string, any> = JSON.parse(fileContent);

if (config.upstreamType && typeof config.upstreamType === 'string') {
    if (config.upstreamType.toLowerCase().indexOf('an') > -1) {
        config.upstreamType = UpstreamType.ANTHROPIC;
    } else {
        config.upstreamType = UpstreamType.OPENAI;
    }
} else {
    config.upstreamType = UpstreamType.OPENAI;
}

const validatedConfig: Config = config as Config;

mainInit(validatedConfig);
