## Why

The prompt agent can identify the upstream `/website-to-video` skill, but today it can only provide catalog-aware prompt coaching and must stop before claiming the full HyperFrames pipeline ran. We need a cheap, bounded workflow runner that performs the real capture, artifact, validation, and Studio handoff steps asynchronously, while deferring expensive voice and final rendering until the user explicitly opts in.

## What Changes

- Add an async website-to-video workflow run lifecycle with start, status, continue, and cancel operations.
- Add a container-backed workflow execution path for bounded HyperFrames work: website capture, pipeline artifact assembly, composition file creation, lint, validate, and snapshots.
- Persist workflow runs, progress, logs, generated artifacts, snapshots, and Studio project handoff under the authenticated tenant context, using the project storage abstraction so Bunny Storage receives project files/folders when configured.
- Persist any workflow-created stage videos or later approved renders through the Bunny Stream-backed render/media path, recording Stream metadata instead of treating video bytes as generic files.
- Expose workflow-aware prompt agent tools so the TanStack AI agent can request approval, start a real run, monitor progress, and present artifacts without blocking a chat turn.
- Add cost and safety controls: public URL validation, SSRF protection, timeouts, artifact size caps, capture caching, per-tenant quotas, and low-idle container configuration.
- Defer voice/TTS/timing and final MP4 rendering by default; skipped steps are reported honestly instead of represented as completed artifacts.

## Capabilities

### New Capabilities

- `website-to-video-workflow-runner`: Executes the bounded `/website-to-video` pipeline in a container-backed workflow and produces Studio-ready artifacts.
- `workflow-run-lifecycle`: Manages tenant-scoped workflow runs, status, artifacts, cancellation, failure handling, quotas, and persistence.
- `prompt-agent-workflow-control`: Lets the TanStack AI prompt agent start, monitor, continue, and cancel workflow runs through explicit user-approved tools.

### Modified Capabilities

- None.

## Impact

- Worker API routes for workflow start/status/continue/cancel.
- Cloudflare container bindings and container server code for the workflow runner.
- Database migrations for workflow run state and artifact metadata.
- Project storage abstraction and Bunny Storage workspace layout for workflow outputs, folders, snapshots, and optional capture cache entries, with legacy R2 fallback where the existing storage layer allows it.
- Bunny Stream metadata for workflow-created stage videos and explicitly approved renders.
- Prompt agent system prompt, tool contract, tool handlers, and UI status cards.
- Tests for workflow authorization, URL safety, lifecycle transitions, cost controls, artifact persistence, and prompt-agent approval boundaries.
