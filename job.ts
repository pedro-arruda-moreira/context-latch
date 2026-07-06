import type { ClientRequest, IncomingMessage, ServerResponse } from "node:http";

export enum JobStatus {
    QUEUED,
    SENT,
    STREAMING,
    COMPLETED,
    ERROR
}

export interface Job {
    status: JobStatus;
    request: IncomingMessage;
    response: ServerResponse;
    deadline: number;
    clientRequest?: ClientRequest;
    id: string;
    isBrowser: boolean;
}
