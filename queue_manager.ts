import { JobStatus, type Job } from "./job.js";
import { log } from "./log.js";


const queue: Job[] = []

export function enqueue(job: Job) {
    queue.push(job);
}

setInterval(() => {
    log('QueueManager', `Current queue length: ${queue.length}`);
}, 25000);

function shiftFromIndex(index: number) {
    if (index < 0 || index >= queue.length) {
        return;
    }
    queue.splice(index, 1);
}

export function startQueueManager(
    maxInflightRequests: number | undefined,
    tickTime: number,
    jobSender: (job: Job) => void,
    jobCanceller: (job: Job) => void
) {
    setInterval(() => {
        if (queue.length <= 0) {
            return;
        }
        const currentTime = Date.now();
        let inflightRequests = 0;
        for (let i = 0; i < queue.length;) {
            const job = queue[i]!!;
            if (job.status >= JobStatus.COMPLETED) {
                shiftFromIndex(i);
                continue;
            }
            if (!job.isBrowser && currentTime > job.deadline && job.status < JobStatus.STREAMING) {
                log(job.id, 'Job has exceeded its deadline. Cancelling job.');
                jobCanceller(job);
                shiftFromIndex(i);
                continue;
            }
            if (job.status === JobStatus.STREAMING || job.status === JobStatus.SENT) {
                i++;
                if (!job.isBrowser) {
                    inflightRequests++;
                }
                continue;
            }
            const aboveInflightLimit = maxInflightRequests !== undefined && inflightRequests >= maxInflightRequests;
            if (aboveInflightLimit) {
                if (job.isBrowser) {
                    jobSender(job);
                }
            } else {
                jobSender(job);
                inflightRequests++;
            }
            i++;
        }
    }, tickTime);
}
