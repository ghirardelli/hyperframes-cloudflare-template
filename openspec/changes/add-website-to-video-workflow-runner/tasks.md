## 1. Scope and Configuration

- [x] 1.1 Confirm the exact HyperFrames CLI commands available for capture, lint, validate, and snapshot generation in the installed `hyperframes` package.
- [x] 1.2 Add a workflow runner feature flag so the prompt agent and UI can hide the runner without disabling existing prompt coaching.
- [x] 1.3 Define default runner limits for max duration, max redirects, max screenshots, max files, max artifact bytes, max log bytes, and per-organization concurrency.
- [x] 1.4 Define the default website-to-video stage plan: preflight, capture, compose, validate, persist, complete.
- [x] 1.5 Document which upstream `/website-to-video` steps are supported in the first pass and which are explicitly skipped.
- [x] 1.6 Confirm which workflow outputs should be project workspace files, Bunny Storage artifacts, Bunny Stream stage videos, or transient cache entries.

## 2. Persistence and Types

- [x] 2.1 Add a database migration for `workflow_runs` with organization, user, optional project, skill, status, phase, input URL, options, progress, artifacts, error, and timestamps.
- [x] 2.2 Add indexes for organization-scoped run lookup, status lookup, and created-at ordering.
- [x] 2.3 Add TypeScript workflow run status, phase, artifact manifest, skipped-step, error summary, progress, storage-provider pointer, and Stream media metadata types.
- [x] 2.4 Add workflow run data-access helpers for create, get-by-tenant, update-progress, mark-succeeded, mark-failed, mark-cancelled, and attach-project.
- [x] 2.5 Add storage key helper functions for project workspace workflow artifacts, snapshots, logs, stage-video archives, and optional capture cache entries.
- [x] 2.6 Ensure workflow artifact manifests can reference `postgres`, `r2`, `bunny-storage`, and `bunny-stream` provider records.

## 3. URL Safety and Cost Controls

- [x] 3.1 Implement public URL validation for `http` and `https` only.
- [x] 3.2 Block localhost, private IPv4 ranges, private IPv6 ranges, link-local ranges, and cloud metadata service addresses before container dispatch.
- [x] 3.3 Re-validate redirected hosts and cap redirects during capture preflight.
- [x] 3.4 Enforce per-organization workflow concurrency and rate limits before creating or starting a run.
- [x] 3.5 Enforce configured duration, artifact size, screenshot count, file count, and log limits during workflow execution.
- [x] 3.6 Add bounded error messages for validation, quota, timeout, and execution failures.

## 4. Workflow Container

- [x] 4.1 Add a `WorkflowContainer` class with a short idle window and a conservative instance configuration.
- [x] 4.2 Add a Cloudflare container binding such as `WORKFLOW_CONTAINER` without changing the existing render binding.
- [x] 4.3 Add workflow container package and entrypoint wiring, reusing the existing Chromium and HyperFrames runtime dependencies where practical.
- [x] 4.4 Implement `GET /healthz` for the workflow container.
- [x] 4.5 Implement a capture endpoint that creates an isolated temp workspace and runs the bounded HyperFrames capture command.
- [x] 4.6 Implement a validate endpoint that accepts generated workspace files and runs bounded HyperFrames lint, validate, and snapshot generation.
- [x] 4.7 Ensure every container phase returns structured JSON with artifacts, warnings, command summaries, skipped steps, and bounded logs.
- [x] 4.8 Ensure temp workspaces are removed or made inaccessible after success, failure, cancellation, or timeout.

## 5. Worker Workflow API

- [x] 5.1 Add `POST /api/workflows/website-to-video` with auth, tenant checks, feature flag checks, URL validation, quota checks, and run creation.
- [x] 5.2 Add `GET /api/workflows/:runId` with organization-scoped access checks and compact artifact/status responses.
- [x] 5.3 Add `POST /api/workflows/:runId/continue` for approved continuation from awaiting-approval phases.
- [x] 5.4 Add `POST /api/workflows/:runId/cancel` for cancelling queued, running, or awaiting-approval runs.
- [x] 5.5 Implement idempotent phase dispatch from Worker to `WORKFLOW_CONTAINER`.
- [x] 5.6 Persist phase progress before and after each container call so polling reflects current state.
- [x] 5.7 Create or select the organization-scoped Studio project before persisting final workflow deliverables so the project workspace prefix is available.
- [x] 5.8 Persist large artifacts and snapshots through `writeProjectObject`, preferring Bunny Storage when configured, and store only compact provider references in workflow run metadata.
- [x] 5.9 Convert successful validated output into organization-scoped Studio project files, folders, assets, and pipeline artifact entries.
- [x] 5.10 Persist workflow-created stage videos through the Bunny Stream media path when configured, including Stream status and playback metadata.
- [x] 5.11 Link the generated Studio project and any provider-backed artifact/media records back to the workflow run.

## 6. Artifact Composer

- [x] 6.1 Build a capture summary normalizer that converts container capture output into bounded model context.
- [x] 6.2 Load the synced `/website-to-video` skill context and required core HyperFrames guidance for artifact composition.
- [x] 6.3 Add a Worker-side artifact composer that generates `DESIGN.md`, `SCRIPT.md`, `STORYBOARD.md`, and composition files from the capture summary.
- [x] 6.4 Validate generated artifact filenames, sizes, content types, and required file presence before sending files to the container.
- [x] 6.5 Mark voice, precise timing, and final render as skipped unless those providers or phases are explicitly configured.
- [x] 6.6 Add retry or repair behavior for validation failures that can be safely corrected within configured limits.

## 7. Prompt Agent Integration

- [x] 7.1 Add prompt-agent tool schemas for `start_hyperframes_workflow`, `get_hyperframes_workflow_run`, `continue_hyperframes_workflow`, and `cancel_hyperframes_workflow`.
- [x] 7.2 Wire tool handlers to the Worker workflow API or shared workflow service layer.
- [x] 7.3 Require user approval metadata for start, continue, and cancel workflow tools.
- [x] 7.4 Keep status lookup read-only and compact so the agent can poll or summarize without mutating runs.
- [x] 7.5 Update the prompt-agent system prompt to prefer the real runner when available for `/website-to-video`.
- [x] 7.6 Ensure agent responses include skill provenance, run id, phase, skipped steps, and Studio handoff metadata without exposing private repo credentials.

## 8. Main Page User Interface

- [x] 8.1 Add workflow start affordance when the prompt agent proposes a runnable website-to-video workflow.
- [x] 8.2 Add a workflow run card that displays queued/running phase, progress, current action, and cancellation availability.
- [x] 8.3 Add completed-run UI for artifacts, snapshots/contact sheet, skipped steps, Studio project link, and explicit render action.
- [x] 8.4 Add failed-run UI with a bounded failure summary, safe partial artifacts, and retry guidance where available.
- [x] 8.5 Ensure existing draft prompt, approved generation, Studio, and render flows keep working when the workflow runner flag is disabled.

## 9. Tests and Verification

- [x] 9.1 Add unit tests for URL validation, private-network blocking, redirect handling, quotas, and artifact limit enforcement.
- [x] 9.2 Add unit tests for workflow run lifecycle transitions and tenant-scoped access control.
- [x] 9.3 Add tests for prompt-agent tool approval boundaries and read-only status lookup.
- [x] 9.4 Add integration tests for successful website-to-video run creation, status polling, provider-backed artifact persistence, and Studio handoff using mocked container responses.
- [x] 9.5 Add mocked Bunny Storage and Bunny Stream tests for workflow artifact writes, stage-video metadata, fallback behavior, and failed provider uploads.
- [x] 9.6 Add container-level smoke tests for health, capture fixture, validate fixture, timeout handling, and bounded log output.
- [x] 9.7 Add UI tests for workflow cards in queued, running, succeeded, failed, cancelled, and awaiting-approval states.
- [x] 9.8 Run the full local verification suite and record any manual Cloudflare container and Bunny smoke-test steps needed for deployment.
