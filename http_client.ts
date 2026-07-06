import { ClientRequest, request, type IncomingMessage } from 'node:http';

export const ERROR_STATUS_TIMED_OUT = '__TIMED_OUT__';

interface RequestOptions {
    hostname: string;
    port?: number;
    path: string;
    method: string;
    headers?: Record<string, string>;
}

export function httpRequest(
    upstreamHost: string,
    latchRequest: IncomingMessage,
    dataCallback: (chunk: any) => void,
    finishCallback: (error: Error | null) => void,
    statusCallback: (statusCode: number, headers: Record<string, string[] | undefined>) => void
): ClientRequest {
    const urlObj = new URL(latchRequest.url ?? '', `http://${upstreamHost}`);

    const defaultHeaders: Record<string, string> = {
        'Content-Type': latchRequest.headers['content-type'] || 'application/json',
    };

    const convertedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(latchRequest.headers)) {
        if (typeof value === 'string') {
            convertedHeaders[key] = value;
        } else if (Array.isArray(value)) {
            convertedHeaders[key] = value.join(',');
        }
    }

    const options: RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port ? parseInt(urlObj.port) : 80,
        path: urlObj.pathname + urlObj.search,
        method: latchRequest.method ?? 'GET',
        headers: { ...defaultHeaders, ...convertedHeaders },
    };

    return performRequest(options, latchRequest, dataCallback, finishCallback, statusCallback);
}

function performRequest(
    options: RequestOptions,
    latchRequest: IncomingMessage,
    dataCallback: (chunk: any) => void,
    finishCallback: (error: Error | null) => void,
    statusCallback: (statusCode: number, headers: Record<string, string[] | undefined>) => void
): ClientRequest {
    function maybeFinishCallback(error: Error) {
        if(error.message !== ERROR_STATUS_TIMED_OUT) {
            finishCallback(error);
        }
    }
    const upstreamRequest = request(options, (upstreamResponse) => {

        statusCallback(upstreamResponse.statusCode ?? 0, upstreamResponse.headersDistinct);

        upstreamResponse.on('data', (chunk) => {
            dataCallback(chunk);
        });

        upstreamResponse.on('end', () => {
            finishCallback(null);
        });

        upstreamResponse.on('error', (error) => {
            maybeFinishCallback(error);
        });

        upstreamResponse.on('aborted', (error) => {
            maybeFinishCallback(error);
        });
    });

    upstreamRequest.on('error', (error) => {
        maybeFinishCallback(error);
    });

    latchRequest.on('data', (chunk) => {
        upstreamRequest.write(chunk);
    });

    latchRequest.on('end', () => {
        upstreamRequest.end();
    });

    latchRequest.on('error', (error) => {
        maybeFinishCallback(error);
    });

    latchRequest.on('aborted', (error) => {
        maybeFinishCallback(error);
    });

    return upstreamRequest;
}
