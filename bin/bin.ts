#!/usr/bin/env node

import { readFileSync } from "fs";
import { mainInit } from "../index.js";


const filePath = process.argv[2];
const fileContent = filePath ? readFileSync(filePath, "utf-8") : null;
if (!fileContent) {
    console.error("No config file provided or file is empty.");
    process.exit(1);
}

mainInit(JSON.parse(fileContent));