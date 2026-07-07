# AGENTS.md

## Project: context-latch

context-latch is a local proxy that prevents LLM cold-start timeouts for developers running local LLMs on GPUs with limited VRAM. It queues incoming HTTP requests so the GPU never exceeds `num_parallel`, while keeping client connections alive until a slot is available.

## Architecture

```
Client ──► context-latch ──► Local LLM (llama.cpp / ollama / llama-swap)
           └─ request queue
              scheduler tick (tickTime ms)
              deadline → 529 retry
```

### Key components

| File | Purpose |
|---|---|
| `bin/bin.ts` | CLI entry point. Reads config JSON, converts `upstreamType` string to enum, calls `mainInit`. |
| `core.ts` | Core logic. Creates HTTP server, routes requests to queue, forwards them to upstream, handles streaming and 529 cancellation. |
| `queue_manager.ts` | Request queue + background scheduler. Pushes requests through to the GPU when slots are free. |
| `http_client.ts` | Upstream HTTP request client. Proxies headers/body to the target LLM server. |
| `http_server.ts` | Thin wrapper around `node:http.createServer`. |
| `job.ts` | `Job` interface and `JobStatus` enum. |
| `log.ts` | Simple timestamped logger. |
| `index.ts` | Re-exports `doStart` as `mainInit`. |

### Core logic

- **Queueing:** Every incoming request is queued. A `setInterval` (every `tickTime` ms) checks if a GPU slot is available (`inflightRequests < maxInflightRequests`). When a slot opens, the next queued job is forwarded to the upstream.
- **Streaming:** While streaming, the proxy forwards raw chunks from upstream to the client. If the response closes before completion, the job is cancelled.
- **Deadline / 529:** If a job's `deadline` (relative to when the job arrived) is exceeded and it hasn't started streaming, the proxy returns a **529** to the client. Clients like OpenClaude treat 529 as a signal to retry, which resets the cold start. The deadline is set slightly below 180,000 ms (the client's own timeout) to avoid the client giving up first.
- **Browser bypass:** Requests detected as coming from a browser (`User-Agent` contains `Mozilla` and the request is sent via the `isBrowser` flag) bypass the queue entirely and always go straight to the GPU. This avoids interrupting the UX of browser-based chat clients.
- **Upstream type:** `ANTHROPIC` requests are forwarded with the raw chunk. `OPENAI` requests have chunks filtered for lines starting with `data:` (SSE format) before forwarding.

### Important constants

| Name | Value | Description |
|---|---|---|
| `tickTime` | `333` ms | Scheduler interval |
| `QUEUE_LOG_INTERVAL` | `25000` ms | Periodic queue length log |
| `ERROR_STATUS_TIMED_OUT` | `'__TIMED_OUT__'` | Marker to suppress retry on cancel |

## Development

```bash
npm run build          # TypeScript compilation
npx context-latch config_sample/config.json  # Run
```

## Constraints

- **Local tool only.** Never deployed to Docker / Kubernetes. Bind to `localhost` is intentional.
- **Node >= 20**. Uses ESM modules.
- **No mocks.** This runs against real HTTP services.

## Code review notes

See the review comments for known issues. High-priority items:

1. `Math.random()` for job IDs → use `crypto.randomUUID()`.
2. `parseInt(urlObj.port)` missing radix → use `Number(urlObj.port)`.
3. No config validation → `config as Config` bypasses type safety.
4. Global state (`const queue`) and module-level `setInterval` — not testable.
