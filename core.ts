import { JobStatus, type Job } from "./job.js";
import { enqueue, startQueueManager } from "./queue_manager.js";
import { createServerInstance } from "./http_server.js";
import { ERROR_STATUS_TIMED_OUT, httpRequest } from "./http_client.js";
import { log } from "./log.js";

export enum UpstreamType {
    ANTHROPIC,
    OPENAI
}

export interface Config {
    port: number;
    tickTime: number;
    deadline: number;
    upstreamHost: string;
    maxInflightRequests?: number;
    upstreamType: UpstreamType;
    debug?: boolean;
}

let globalConfig: Config;

function sendJob(job: Job) {
    job.status = JobStatus.SENT;
    log(job.id, 'Sending request to upstream host.');
    const { request, response } = job;
    response.on('close', () => {
        if (job.status !== JobStatus.COMPLETED) {
            log(job.id, 'Response closed before completion. Cancelling job.');
            doCancelJob(job);
        }
    });
    job.clientRequest = httpRequest(globalConfig.upstreamHost, request, (chunk) => {
        const chunkStr: String = chunk.toString();
        if (!!globalConfig.debug) {
            log(job.id, `Received chunk: ${chunkStr}`);
        }
        if (job.isBrowser) {
            job.status = JobStatus.STREAMING;
        } else if (job.status !== JobStatus.STREAMING) {
            if (globalConfig.upstreamType === UpstreamType.ANTHROPIC && chunkStr.length > 2) {
                log(job.id, 'Streaming started.');
                job.status = JobStatus.STREAMING;
            } else if (chunkStr.indexOf('data:') > -1) {
                log(job.id, 'Streaming started.');
                job.status = JobStatus.STREAMING;
            }
        }
        if (job.status === JobStatus.STREAMING) {
            response.write(chunk);
        }
    }, (error) => {
        if (error) {
            log(job.id, 'Error occurred while processing request.');
            doCancelJob(job);
        } else {
            response.end();
            log(job.id, 'Request completed successfully.');
            job.status = JobStatus.COMPLETED;
        }
    }, (statusCode, headers) => {
        response.statusCode = statusCode;
        for (const [key, value] of Object.entries(headers)) {
            if (!value) continue;
            response.appendHeader(key, value);
        }
    });
}

function doCancelJob(job: Job) {
    job.status = JobStatus.ERROR;
    const { request, response } = job;
    job.clientRequest?.destroy(new Error(ERROR_STATUS_TIMED_OUT));
    try {
        response.statusCode = 529;
        response.setHeader('Content-Type', 'text/plain');
        response.write(`[context-latch] [Job:${job.id}] Request cancelled due to timeout. Failed by ${Date.now() - job.deadline} ms.`);
    } catch (e) {
        log(job.id, 'Error while writing to response: ' + e);
    }
    response.end();
    request.destroy(new Error(ERROR_STATUS_TIMED_OUT));
    log(job.id, 'Request cancelled due to timeout.');
}

function isBrowserRequest(ua: string | string[] | undefined): boolean {
    if (!ua) {
        return false;
    }
    if (typeof ua === 'string') {
        return ua.indexOf('Mozilla') > -1;
    } else {
        return isBrowserRequest(ua[0]);
    }
}


export function doStart(config: Config) {

    globalConfig = config;

    startQueueManager(
        config.maxInflightRequests,
        config.tickTime,
        sendJob,
        doCancelJob
    );

    const server = createServerInstance((req, res) => {
        const isBrowser = isBrowserRequest(req.headers['user-agent']);
        let id = Math.random().toString(36).substring(2, 15);
        if (isBrowser) {
            id = `browser-${id}`;
        }
        const job: Job = {
            status: JobStatus.QUEUED,
            request: req,
            response: res,
            deadline: Date.now() + config.deadline,
            id: id,
            isBrowser: isBrowser
        };
        res.on('destroy', () => {
            job.status = JobStatus.ERROR;
        });
        log(job.id, 'Request received and queued.');
        enqueue(job);
    });


    server.listen(config.port, 'localhost', () => {
        console.log(`Server is running on http://localhost:${config.port}`);
    });
}
