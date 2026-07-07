# context-latch

Smooth out LLM cold starts with intelligent request latching!

A local proxy for developers running local LLMs on GPUs with limited VRAM. It batches incoming requests into a queue so the GPU never exceeds `num_parallel`, while keeping client connections alive so they don't time out waiting for a slot.

## How it works

When `num_parallel` is low (1–2), a GPU can only process a few requests at a time. Without context-latch, any extra requests arriving while the GPU is busy will fail or time out.

context-latch sits between your client (e.g. Claude Desktop, OpenClaude CLI) and the local LLM server (llama.cpp, ollama, llama-swap):

1. Incoming requests are queued immediately.
2. A background scheduler ticks every `tickTime` ms and forwards queued requests only when a GPU slot opens.
3. If a queued request exceeds `deadline` (and is still waiting), the proxy returns a **529** — clients like OpenClaude treat a 529 as a signal to retry, which resets the cold start.
4. Browser requests bypass the queue entirely and always go straight to the GPU.

## Configuration

Copy `config_sample/config.json` to your project and adjust:

| Field | Required | Description |
|---|---|---|
| `port` | yes | Port the proxy listens on |
| `tickTime` | yes | Interval in ms to check for free GPU slots |
| `deadline` | yes | Max wait time in ms before returning 529 |
| `upstreamHost` | yes | Target LLM server host (e.g. `localhost:8080`) |
| `upstreamType` | no | `ANTHROPIC` or `OPENAI` (default: `OPENAI`) |
| `maxInflightRequests` | no | Parallel requests allowed on the GPU — matches `num_parallel` of the target LLM (default: no limit) |

## Install

```bash
npm install -g context-latch
```

## Usage

```bash
context-latch ./path/to/config.json
```
