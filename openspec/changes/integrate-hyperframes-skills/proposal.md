## Why

The main-page TanStack AI agent currently knows a hand-distilled subset of HyperFrames rules, but the upstream HyperFrames repo ships a richer `skills/` catalog with a router, creation workflows, and domain skills. Integrating that catalog lets our agent route user intent the same way HyperFrames-native coding agents do while keeping generation, secrets, and project mutation inside our existing authenticated Worker path.

The `/website-to-video` workflow also exposes a scope mismatch we need to handle deliberately: its upstream skill is a full artifact-producing pipeline, while our app currently supports text-first prompt preparation plus approved single-composition generation.

## What Changes

- Add a synced, versioned HyperFrames skills catalog sourced from Aaron's private fork at `github.com/aaronpie/hyperframes.git`, not directly from the public upstream.
- Expose the catalog to the TanStack prompt agent through typed tools for listing skills, routing user intent, and loading selected skill instruction excerpts.
- Update prompt-agent behavior so video creation requests start from the `/hyperframes` router and load the matching creation workflow or domain skills before preparing a prompt package.
- Add first-pass `/website-to-video` handling that can recognize URL-to-video intent, route to the workflow, and prepare a grounded prompt/story outline without claiming full pipeline execution.
- Define a deferred, explicit workflow-runner boundary for full `/website-to-video` parity: capture, artifacts, voice/timing, composition files, lint, validate, snapshots, and delivery.
- Preserve explicit user approval before `generate_hyperframe` mutates project HTML or creates/updates projects.
- Do not add a hosted TanStack Provider Skills integration; HyperFrames repo skills are local agent instruction files, so they are represented as app-level catalog data and tools.

## Capabilities

### New Capabilities
- `hyperframes-skill-catalog`: Sync, store, inspect, and expose HyperFrames skill catalog entries from the private fork for prompt-agent routing and instruction loading.

### Modified Capabilities
- `prompt-agent`: The agent routes HyperFrames video requests through the synced skill catalog, loads relevant skill instructions before prompt preparation, and clearly distinguishes catalog-aware first-pass guidance from unavailable full workflow execution.

## Impact

- Affected scripts: add a skills sync script that reads `skills/**/SKILL.md` plus selected reference metadata from `github.com/aaronpie/hyperframes.git` using developer-provided credentials.
- Affected source: `src/lib/prompt-agent-contract.ts`, `src/lib/prompt-agent-tools.ts`, `src/worker/prompt-agent-api.ts`, `src/lib/prompt-agent-client.ts`, and a new generated catalog module or JSON artifact.
- Affected UI: prompt-agent tool cards and labels for skill catalog lookup, workflow routing, and unavailable/full-pipeline notices.
- Affected operations: private repo access must be configured locally/CI without exposing tokens to the browser or Worker responses.
- Affected future systems: full `/website-to-video` parity requires a separate container-backed workflow runner and artifact persistence model.
