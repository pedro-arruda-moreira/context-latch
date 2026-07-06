import { doStart, type Config } from "./core.js";

// TODO
const config: Config = {
    port: 22868,
    tickTime: 500,
    deadline: 120000,
    upstreamHost: "localhost:22867",
    maxInflightRequests: 1
};

doStart(config);