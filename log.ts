export function log(id: string, message: string) {
    console.log(`[${new Date().toISOString()}] [${id}] ${message}`);
}