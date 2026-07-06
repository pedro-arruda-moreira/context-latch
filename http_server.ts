import { createServer, IncomingMessage, ServerResponse } from "node:http";

export function createServerInstance(callback: (req: IncomingMessage, res: ServerResponse) => void) {
    return createServer(callback);
}
