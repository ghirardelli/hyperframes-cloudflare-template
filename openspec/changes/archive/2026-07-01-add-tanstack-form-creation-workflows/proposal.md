## Why

The app has several important workflows that are still managed with route-local state, raw `FormData`, and manual validation even though the surrounding app now has TanStack Router, Query, AI, and shared Zod contracts. TanStack Form is the next TanStack layer to add because it can standardize validation and submit state for existing app forms while giving the main creation flow a path toward an agent-guided, stage-based wizard.

## What Changes

- Add TanStack Form as the app-owned form layer and pair form validation with existing Zod schemas instead of inventing parallel validators.
- Migrate high-value app forms to TanStack Form in the recommended order:
  - login,
  - admin create-user,
  - profile update and password change,
  - inline project metadata edit,
  - main creation intake and render settings.
- Introduce form-managed workflow primitives for grouped, stage-local validation and submit state.
- Add an adaptive creation wizard that can receive an initial prompt from the AI Agent, create or attach to a workflow run, and present a two-column workspace:
  - pipeline stages and editable artifacts on the left,
  - AI Agent chat and workflow controls on the right.
- Let the AI Agent choose which user-facing stages are relevant for each request rather than forcing every prompt through all seven upstream pipeline stages.
- Treat workflow/project artifacts as the canonical source of truth; TanStack Form manages user editing, validation, dirty state, and submit state only.
- Add prompt-agent workflow tools for inspecting stages, proposing stage patches, applying approved stage edits, and rerunning validation where supported.
- Preserve existing Worker APIs, TanStack Query cache usage, tenant authorization, project storage, workflow-run lifecycle, render pipeline, and TanStack AI streaming behavior.
- Preserve Studio integration as-is. Do not change Studio route loading, `StudioEditor`, Studio-owned file tree/assets/share/version/search behavior, or `@hyperframes/studio` internals so upstream HyperFrames Studio changes remain easy to apply.

## Capabilities

### New Capabilities
- `form-managed-workflows`: Defines TanStack Form usage for app-owned forms, grouped creation workflows, stage-local validation, and canonical artifact boundaries.
- `agent-guided-pipeline-wizard`: Defines the adaptive two-column wizard for AI-agent-guided HyperFrames pipeline stages, manual artifact editing, and agent-proposed stage updates.

### Modified Capabilities
- `auth-gate`: Login submission and validation behavior becomes form-managed while preserving public login and auth semantics.
- `tenant-admin`: Admin create-user validation and conditional organization assignment behavior becomes form-managed.
- `profile-management`: Profile and password forms become form-managed while preserving validation feedback and immutable organization assignment.
- `tenant-projects`: Inline project metadata editing and workflow artifact editing gain form-managed dirty state, validation, and persistence behavior.
- `main-page-creation-flow`: The main creation surface becomes an intake path that can route suitable prompts into the adaptive wizard while retaining direct manual/agent generation where appropriate.

## Impact

- Dependencies: add `@tanstack/react-form`; use the existing Zod dependency for schema validation.
- App form layer: add shared form helpers/components only where they reduce repeated field, error, and submit-state handling.
- Affected routes: `/login`, `/admin`, `/profile`, `/projects`, the main creation route, and a new app-owned workflow wizard route.
- Affected client state: prompt intake, duration, render settings, project metadata draft state, profile/password state, admin user creation state, and stage artifact editing state.
- Affected APIs/tools: prompt-agent tool contracts and workflow/project artifact read/update endpoints may need additions for stage inspection, patch preview, approved patch application, and validation reruns.
- Affected persistence: wizard stage edits persist through project entries or workflow artifact storage, not through Studio internals.
- Tests: add focused coverage for form validation, submit behavior, query invalidation after form mutations, adaptive stage selection, agent approval boundaries, and stage edit conflict handling.
