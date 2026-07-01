## Why

Selected HyperFrames catalog components currently act as prompt inspiration only. That is risky for production video generation because the AI model may imitate or recreate a registry block from memory instead of using the known-good HTML that the HyperFrames team ships, which can introduce broken composition files and render failures.

## What Changes

- Add a trusted component materialization path for selected HyperFrames catalog blocks/components.
- Treat selected components as real project dependencies that can be installed/copied into the project file model, not just text appended to a prompt.
- Add an approved prompt-agent tool boundary that lets the agent request component placement while the application performs deterministic install/injection.
- Prevent the agent from generating replacement HTML for a selected registry component when a trusted catalog source is available.
- Persist materialized component metadata so projects can be previewed, rendered, reopened in Studio, and audited against source ids/revisions.
- Update the main creation UI so users understand when selected components are prompt references versus real component blocks inserted into the project.

## Capabilities

### New Capabilities
- `hyperframe-component-materialization`: Covers trusted installation/copying of selected HyperFrames catalog components into project files, deterministic host-snippet injection, audit metadata, and prompt-agent tool boundaries that prevent AI-recreated component HTML.

### Modified Capabilities
- `main-page-creation-flow`: Selected catalog components become actionable build inputs for generation/agent flows, with UI affordances and copy that distinguish real materialized components from prompt-only references.
- `studio-workspace`: Studio preview, file tree, snapshots, and render handoff must support materialized registry component files and make their source/audit state visible.

## Impact

- Affects gallery selection state, selected-context payloads, prompt-agent tools, `/api/agent/chat`, `/api/generate`, project file persistence, preview/render resolution, Studio file surfaces, and tests.
- May add a generated registry component bundle/cache or server-side installer using pinned HyperFrames registry sources.
- Requires typed schemas for component placement requests, materialization results, source revision metadata, and installed component manifests.
- Keeps existing approval boundaries: the agent can propose or request a registry component, but mutation happens through explicit approved app/server tools.
