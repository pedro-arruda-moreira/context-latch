export function log(id: string, message: string) {
    if(id.indexOf("browser") > -1) {
        return;
    }
    console.log(`[${new Date().toLocaleTimeString()}] [${id}] ${message}`);
}
