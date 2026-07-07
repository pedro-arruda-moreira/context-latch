export function log(id: string, message: string) {
    console.log(`[${new Date().toLocaleTimeString()}] [${id}] ${message}`);
}
