## Context

The app already uses TanStack Start, TanStack Router, TanStack AI, and TanStack Query for important pieces of the authenticated workspace, but app-owned forms are still spread across route-local state, raw `FormData`, manual submit flags, and ad hoc validation. The most visible examples are login, admin create-user, profile/password updates, inline project metadata editing, and the main creation settings.

The main creation route has also grown into more than a simple prompt form. It now coordinates prompt input, agent chat, gallery context, duration, render settings, active project state, generated preview state, workflow status, and render status. That makes it a natural candidate for a form-backed intake model and a separate wizard when the user is really asking for a staged HyperFrames pipeline.

The HyperFrames pipeline is artifact-oriented from the user's perspective: Capture, Design, Script, Storyboard, VO + Timing, Build, and Validate each produce or verify files and assets. The current app's website-to-video runner is lifecycle-oriented internally: preflight, capture, compose, validate, persist, complete. This design keeps those concerns separate.

Studio remains a preservation boundary. The HyperFrames team is actively changing Studio, so this change must not modify Studio route loading, `StudioEditor`, Studio-owned file tree/assets/share/version/search behavior, or `@hyperframes/studio` internals. The wizard should integrate through app-owned workflow APIs, prompt-agent tools, and tenant project entries.

## Goals / Non-Goals

**Goals:**
- Add TanStack Form as the app-owned form runtime for field state, validation state, dirty state, and submit state.
- Pair forms with existing Zod schemas or narrowly introduced domain schemas.
- Migrate existing app forms before reshaping the main creation flow.
- Keep TanStack Query as the server-state and invalidation layer for form-backed mutations.
- Introduce a wizard route that displays adaptive, artifact-centric pipeline stages next to the AI Agent chat.
- Let the agent choose the relevant user-facing stages for each prompt instead of forcing every run through all upstream pipeline stages.
- Allow users to manually edit stage artifacts and let the agent propose approved changes to those same artifacts.
- Preserve Studio as an upstream-owned integration surface.

**Non-Goals:**
- Do not replace TanStack Query with TanStack Form for server-owned state.
- Do not store canonical workflow artifacts inside form state.
- Do not modify Studio internals or make Studio responsible for the new wizard.
- Do not require every creation prompt to become a wizard workflow.
- Do not claim support for VO + Timing, final render, or full upstream pipeline parity unless the backing workflow actually supports those steps.
- Do not add TanStack Virtual, Pacer, Table, DB, or Start server functions in this change.

## Decisions

### Decision: Migrate app forms before introducing the wizard

Implement the low-risk form surfaces first: login, admin create-user, profile/password, and inline project metadata edit. Then extract the main creation intake and render settings into a form-backed model before adding the wizard route.

Alternative considered: build the wizard first. That would chase the most exciting product surface immediately, but it would skip the smaller forms that prove field components, Zod integration, Query mutation wiring, and test helpers.

### Decision: Use Zod schemas as the validation boundary

Each form should use an existing Zod schema when one already describes the domain contract. New schemas should be added only where the client needs a missing validation contract, such as form-only conditional organization assignment or stage patch input.

Alternative considered: write inline validation in each TanStack Form field. That would be quick locally, but it would recreate the parallel validation problem this change is meant to remove.

### Decision: Keep canonical state in Query, workflow runs, and project entries

TanStack Form owns unsaved field values, dirty state, touched state, validation messages, and submit state. After a successful mutation, TanStack Query invalidates or updates server-state caches. Stage artifact content is saved through project entry or workflow artifact APIs and then read back through Query.

Alternative considered: keep wizard stage markdown in long-lived form state. That would make optimistic editing simple at first, but it would drift from project storage, workflow manifests, and agent-applied patches.

### Decision: Make the wizard artifact-centric

The wizard's left column should display user-facing stages such as Capture, Design, Script, Storyboard, VO + Timing, Build, and Validate when those stages are relevant. These stages map to artifacts and validation tasks, not one-to-one backend phases.

Alternative considered: expose backend lifecycle phases directly. That would be easier to wire to current workflow status, but it would be less useful for users who want to edit `DESIGN.md`, `SCRIPT.md`, `STORYBOARD.md`, compositions, assets, and validation outcomes.

### Decision: Use adaptive stage plans

When the user starts from the AI Agent, the agent should classify the request and create a stage plan with only the stages needed for the best result. A website-to-video prompt may include Capture, Design, Script, Storyboard, Build, and Validate. A simple text-to-video prompt may skip Capture. A workflow without voice support must mark VO + Timing as skipped or unavailable.

Alternative considered: always show the full seven-stage pipeline. That gives consistency but adds noise and invites the UI to imply unsupported steps are completed.

### Decision: Put the AI Agent beside the stage editor

The wizard route should use a two-column layout: pipeline stage navigation/editor on the left and the AI Agent chat on the right. The agent should be scoped to the active workflow run, project, and selected stage so it can explain, inspect, and propose changes in context.

Alternative considered: keep agent chat only on the main page. That preserves the current UI but splits the user's attention once they are editing staged artifacts.

### Decision: Require approval for mutating agent stage edits

The agent may inspect visible workflow/stage data without approval, but applying a patch to a stage artifact, rerunning validation, starting a workflow, continuing a workflow, cancelling a workflow, or rendering must require explicit user approval. Patch previews should show affected paths and a bounded diff summary before apply.

Alternative considered: auto-apply every agent suggestion. That would feel magical for simple edits, but it is too risky when users can also edit markdown and workflow artifacts manually.

### Decision: Avoid Studio changes

The wizard is an app-owned route that reads and writes through app-owned APIs and project entry storage. It may link to Studio after artifacts are generated, but it must not depend on Studio internals or modify Studio-owned components.

Alternative considered: embed the wizard inside Studio or extend Studio panels. That would risk divergence from upstream HyperFrames Studio changes.

## Risks / Trade-offs

- Agent and user edit the same artifact concurrently -> Use dirty-state warnings, server version checks or updated timestamps, and patch previews before apply.
- Form state drifts from saved artifacts -> Refetch stage artifacts after successful saves and reset form defaults from canonical Query data.
- Wizard implies unsupported pipeline parity -> Display skipped, unavailable, or optional stages honestly based on the selected stage plan and workflow capabilities.
- Too many route-level changes at once -> Migrate small forms first, then main intake, then wizard route and agent tools.
- Conditional admin validation becomes client/server inconsistent -> Keep server validation authoritative and share Zod schema constraints where practical.
- Polling and stage refetches increase API load -> Reuse TanStack Query active-only polling and invalidate only affected workflow/project keys.
- Studio compatibility regresses -> Keep Studio files out of scope and use project entries/workflow APIs as the boundary.

## Migration Plan

1. Add `@tanstack/react-form` and form test utilities.
2. Add shared form field/error helpers only where repeated route code justifies them.
3. Migrate login, admin create-user, profile/password, and inline project metadata edit forms.
4. Extract main creation prompt, duration, context, resolution, and format into form-backed intake state without changing the visible workflow.
5. Add adaptive stage plan types and Query hooks for stage plans/artifacts.
6. Add the app-owned wizard route with a two-column stage editor and scoped agent panel.
7. Add prompt-agent tools for stage inspection, patch preview, approved patch application, and validation reruns.
8. Add tests for form validation, mutation invalidation, adaptive stage selection, approval boundaries, and conflict handling.

Rollback is route-by-route. Because Worker APIs and Studio internals are preserved, any converted form can be returned to its prior submit path while leaving other migrations intact.

## Open Questions

- Should the first wizard route be keyed by workflow run id, project id plus run id, or both?
- Should stage patches require explicit approval every time, or can users opt into auto-apply for low-risk text edits later?
- What server-side version field should be used for artifact conflict detection: project entry updated timestamp, version id, or workflow artifact revision?
- Should the main AI Agent always ask before redirecting into the wizard, or can strong workflow-intent prompts route directly after creating a draft?
