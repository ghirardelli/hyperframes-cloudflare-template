## Context

The app already has a server-side prompt agent, a synced HyperFrames skill catalog, Studio project persistence, a project storage abstraction, Bunny Storage for project bytes when configured, Bunny Stream for rendered video delivery, legacy R2 fallback, and a Cloudflare Container used for final HyperFrames rendering. The `/website-to-video` skill is different from simple prompt generation: upstream expects capture, `DESIGN.md`, `SCRIPT.md`, `STORYBOARD.md`, voice/timing, composition files, lint, validation, and snapshots before a final render is credible.

The current prompt-agent integration can route website-to-video requests and explain that full pipeline execution is unavailable. This change adds the missing async runner in the cheapest useful form: produce real capture-informed project artifacts and validation outputs, hand them to Studio, and keep voice plus final MP4 render as explicit opt-in steps.

## Goals / Non-Goals

**Goals:**

- Run a bounded `/website-to-video` workflow asynchronously outside the chat turn.
- Use Cloudflare Containers for browser capture, HyperFrames CLI work, lint, validation, and snapshots.
- Keep authentication, authorization, tenant scoping, OpenRouter calls, DB writes, Bunny writes, Bunny Stream uploads, and legacy storage fallback in the Worker.
- Persist workflow run state, artifacts, progress, errors, Studio handoff metadata, and provider pointers for Bunny Storage/Bunny Stream outputs.
- Give the prompt agent approved tools to start, monitor, continue, and cancel workflow runs.
- Minimize cost through small containers, short idle windows, quotas, capture caching, and no automatic final video render.

**Non-Goals:**

- No automatic voice/TTS generation in the first implementation.
- No automatic final MP4 render at workflow completion.
- No public unauthenticated workflow endpoint.
- No direct Bunny, R2, DB, OpenRouter, GitHub, or tenant secrets inside the workflow container.
- No promise of full upstream `/website-to-video` parity until voice, precise timing, and final render orchestration are added.

## Decisions

### Use a separate workflow container from the render container

Add a `WorkflowContainer` binding rather than routing workflow jobs through the existing `RenderContainer`.

Rationale:

- The render container is sized for MP4 rendering and currently uses a larger instance class.
- Website capture, lint, validation, and snapshots need Chromium and HyperFrames tooling, but they can run with lower concurrency and shorter idle time.
- A separate endpoint can return structured workflow manifests instead of video bytes.

Alternative considered: reuse `RENDER_CONTAINER`. This is simpler but keeps every workflow job on the expensive render-sized container and couples long-running pipeline state to a render-only API.

Implementation shape:

- Add a Worker binding such as `WORKFLOW_CONTAINER`.
- Add `src/container-workflow.ts` or an equivalent container class with `sleepAfter` around 30-60 seconds.
- Configure `max_instances` conservatively, starting at 1-2.
- Use the smallest instance type that passes capture and snapshot tests; move up only if Chromium memory requires it.

### Keep the workflow orchestrator in the Worker

The Worker owns the run lifecycle and calls the workflow container for bounded phases.

Rationale:

- The Worker already has authenticated session context, tenant membership, DB access, Bunny/R2 storage access, Bunny Stream access, and prompt-agent tooling.
- The container can stay stateless: receive a sanitized job payload, use a temp directory, run commands, return a manifest, and exit idle.
- Secrets do not need to cross the container boundary.

Alternative considered: make the container the full orchestrator. This would require DB, Bunny Storage, Bunny Stream, R2 credentials, or signed upload coordination inside the container and makes tenant safety harder to audit.

Implementation shape:

- `POST /api/workflows/website-to-video` validates auth, URL, quota, and requested options.
- The Worker creates a `workflow_runs` row and dispatches a container call.
- The container returns bounded JSON artifacts, log summaries, snapshot bytes or handles, and validation results.
- The Worker persists artifacts through the project storage abstraction, records Bunny Storage or fallback provider pointers, records Bunny Stream metadata for video outputs, and updates the run state.

### Split AI artifact composition from deterministic HyperFrames execution

Use a Worker-side artifact composer for `DESIGN.md`, `SCRIPT.md`, `STORYBOARD.md`, and composition source generation, then use the container to validate the generated workspace.

Rationale:

- The upstream skill files are agent instructions, not guaranteed CLI commands for every artifact.
- The app already keeps OpenRouter on the server side and should not put that secret in the container.
- Container work remains deterministic and bounded: `npx hyperframes capture`, lint, validate, and snapshots.

Alternative considered: attempt to run the whole skill as a CLI-only container job. This would be brittle until HyperFrames exposes a stable one-command `/website-to-video` runner.

Implementation shape:

- Capture phase: container runs `npx hyperframes capture` against the validated public URL and returns capture metadata, screenshots, and extracted page summary.
- Compose phase: Worker uses synced skill context plus capture summary to generate the text artifacts and Studio files.
- Validate phase: container receives the generated workspace and runs HyperFrames lint, validate, and snapshot/contact-sheet generation.
- Voice/timing fields are marked `skipped` unless a configured voice provider is present.

### Store workflow deliverables in the Bunny-backed project workspace

Generated website-to-video project files, folders, snapshots, source media, and pipeline artifacts should be persisted as project workspace entries, not as detached workflow blobs.

Rationale:

- The Bunny integration makes Postgres the control plane and Bunny Storage the byte plane for project workspaces.
- Studio should be able to open the generated folder tree through DB-authorized project entries.
- Workflow outputs need the same ownership, sharing, versioning, search, and provider metadata as hand-authored Studio files.
- The workflow container must not receive Bunny credentials, so the Worker should call `writeProjectObject` and record the returned provider pointer.

Implementation shape:

- Create or select the Studio project before persisting final workflow deliverables so the immutable project workspace prefix is available.
- Store generated files under paths like `pipeline/website-to-video/{runId}/DESIGN.md`, `pipeline/website-to-video/{runId}/SCRIPT.md`, `pipeline/website-to-video/{runId}/STORYBOARD.md`, `src/...`, `assets/...`, and `snapshots/...`.
- Use `projectWorkspaceKey({ organizationId, ownerId, projectId, path })` and `writeProjectObject` for large project bytes; when Bunny Storage is configured this writes provider `bunny-storage`, otherwise the existing fallback provider is recorded.
- Keep small editable source text in the existing DB-backed file path when appropriate, while still recording project entry/provider metadata for generated artifacts and snapshots.
- Store optional raw stage-video archives with `projectRenderArchiveKey` or an equivalent project render prefix.
- Store any workflow-created stage video intended for playback through Bunny Stream and record Stream library/video/status/playback metadata in the run manifest and related render/media row.

Alternative considered: store workflow outputs under `workflow-runs/{orgId}/{runId}` only. This is useful for transient cache data, but it hides generated folders from Studio and bypasses the new Bunny project workspace model.

### Model workflow runs as durable tenant records

Add a `workflow_runs` table for lifecycle state and artifact metadata. Use project storage provider pointers for larger artifacts, snapshots, stage-video archives, and cache entries.

Suggested `workflow_runs` fields:

- `id`
- `organization_id`
- `user_id`
- `project_id`
- `skill_id`
- `status`: `queued`, `running`, `awaiting_approval`, `succeeded`, `failed`, `cancelled`
- `phase`: `preflight`, `capture`, `compose`, `validate`, `persist`, `complete`
- `input_url`
- `options_json`
- `progress_json`
- `artifact_manifest_json`
- `error_json`
- `created_at`, `updated_at`, `started_at`, `completed_at`

Project workspace keys:

- `orgs/{organizationId}/users/{ownerUserId}/projects/{projectId}/workspace/pipeline/website-to-video/{runId}/...`
- `orgs/{organizationId}/users/{ownerUserId}/projects/{projectId}/workspace/snapshots/website-to-video/{runId}/...`
- `workflow-cache/capture/{hash}/...` for bounded transient capture cache entries when cache is enabled

Alternative considered: store everything in project files only. That loses run history, cancellation/failure state, and provenance.

### Use approval gates for expensive or mutating steps

Prompt-agent workflow tools must distinguish read-only status from mutating or costly operations.

Rationale:

- Starting capture consumes container time.
- Continuing from an approval point can mutate Studio project files.
- Final render remains a separate explicit action through the existing render path.

Implementation shape:

- Add tools such as `start_hyperframes_workflow`, `get_hyperframes_workflow_run`, `continue_hyperframes_workflow`, and `cancel_hyperframes_workflow`.
- Require explicit user approval before `start`, `continue`, and `cancel`.
- Allow read-only status polling without extra approval.
- Return skill provenance, run id, phase, status, skipped steps, artifacts, and Studio project link.

### Prefer staged execution for cost control

Run the workflow in stages so the app can stop before the expensive parts.

Default stages:

1. Preflight: validate URL, quotas, options, and cache eligibility.
2. Capture: run browser capture in the workflow container.
3. Compose: generate `DESIGN.md`, `SCRIPT.md`, `STORYBOARD.md`, and Studio files using server-side AI.
4. Validate: lint, validate, and snapshot the generated workspace in the workflow container.
5. Persist: write project files/assets/snapshots through the project storage abstraction, record Bunny Storage or fallback provider pointers, record any Bunny Stream stage-video metadata, and show Studio handoff.

The first version can run through stage 5 after a single start approval, but the data model should support `awaiting_approval` between stages for future cost-sensitive checkpoints.

## Risks / Trade-offs

- [Risk] Chromium capture can be memory-heavy even without final rendering. -> Mitigation: start with the smallest viable instance type, cap viewport count, and keep `max_instances` low.
- [Risk] Website capture can trigger SSRF or internal network access. -> Mitigation: validate `http`/`https`, block localhost/private/link-local/metadata IP ranges, cap redirects, re-resolve redirected hosts, and enforce request timeouts.
- [Risk] Long jobs can exceed Worker request expectations. -> Mitigation: persist state before dispatch, make the container endpoint idempotent by run id and phase, and expose polling.
- [Risk] Large artifacts can bloat DB rows or tool responses. -> Mitigation: store large outputs in Bunny Storage through the provider abstraction, keep DB/tool responses to manifests and previews, and cap artifact sizes.
- [Risk] Bunny Storage or Bunny Stream upload can fail after a workflow phase succeeds. -> Mitigation: keep container results idempotent by run/phase, record failed persistence state, retry safe uploads, and do not expose ready playback or artifact links until provider metadata is saved.
- [Risk] Users may interpret skipped voice/timing as completed pipeline parity. -> Mitigation: represent skipped steps explicitly in run state, prompt-agent copy, and artifact manifests.
- [Risk] AI-generated composition files may pass syntax checks but still be visually poor. -> Mitigation: require snapshots/contact sheets, show them in the run card, and hand off to Studio before render.
- [Risk] Container logs can expose page content or prompt details. -> Mitigation: redact secrets, truncate logs, and store only bounded summaries for user-visible status.

## Migration Plan

1. Add database migration for `workflow_runs` and any required indexes.
2. Add the workflow container class, container server endpoint, Docker/package wiring, and Wrangler binding.
3. Add Worker workflow API handlers with auth, tenant checks, URL validation, quotas, and run persistence.
4. Add the Worker artifact composer that uses synced HyperFrames skill context and existing server-side model access.
5. Add container validation/snapshot integration and Bunny-backed project artifact persistence through the storage abstraction.
6. Add prompt-agent tools, approval metadata, and system prompt updates.
7. Add UI workflow run cards in the main page/prompt-agent experience.
8. Add unit, integration, and smoke tests for lifecycle, security boundaries, and successful Studio handoff.

Rollback:

- Hide prompt-agent workflow tools and the workflow start UI behind a feature flag.
- Keep existing prompt coaching and Studio render paths unchanged.
- Preserve `workflow_runs` rows as inert history if the runner is disabled.

## Open Questions

- Which Cloudflare container instance type is the cheapest stable option for Chromium capture plus snapshot validation in this repo?
- Should the first implementation pause after capture for user approval, or run capture through validation after one approval?
- Should capture cache be enabled immediately, or only after the first runner version proves stable?
- Which voice/TTS provider, if any, should become the follow-up implementation path for full upstream parity?
- Should website-to-video stage videos use the same Bunny Stream collection as final renders or a dedicated workflow/stage collection?
