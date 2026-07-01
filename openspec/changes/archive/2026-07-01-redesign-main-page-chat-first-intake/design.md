## Context

The authenticated main page has evolved through several creation patterns: preview-first generation, a tabbed AI/manual/render workbench, and an Examples/Components bento picker. Those pieces are individually useful, but together they make the first page feel like a dashboard, a gallery, a prompt editor, and a renderer at the same time.

The approved direction from exploration is Option A: make the main page a compact AI chat intake. The user can describe what they want, optionally select templates and components as context, then press Send. Send creates a workflow run immediately and routes to `/workflows/:runId`, where the detailed multi-form wizard owns stage decisions, artifact editing, validation, and workflow-scoped agent assistance.

The current code already has many of the required ingredients:

- `src/routes/index.tsx` owns the main page creation state, gallery selection state, prompt agent, manual generation, render controls, and preview state.
- `src/components/hyperframe-gallery-workspace.tsx` renders the current Examples/Components bento workspace and generated preview.
- `src/components/prompt-agent-panel.tsx` already supports workflow-scoped agent props and redirects to `/workflows/:runId` when a started workflow run appears.
- `src/routes/workflows.$runId.tsx` already has stage navigation, stage artifact editing, validation actions, and a right-side workflow-scoped agent.
- `src/worker/workflow-api.ts` can create website-to-video workflow runs and expose wizard stage data, but currently starts execution when a workflow is created with an execution context.

## Goals / Non-Goals

**Goals:**

- Make the main page's primary action obvious: describe the desired HyperFrame in one AI chat composer.
- Rename user-facing examples to templates on the main page.
- Present templates as a compact horizontal rail below the composer.
- Present components as a compact picker opened from the composer, with search/filtering and selectable cards.
- Preserve selected prompt, templates, components, placement intent, duration, and project target when creating the workflow run.
- Make Send create a workflow run and navigate immediately to `/workflows/:runId`.
- Add an intake or awaiting-input workflow state so creating a run does not necessarily start container execution before the user reviews wizard forms.
- Turn `/workflows/:runId` into the immediate post-intake workspace with compact stage navigation, active stage form content, and stage-scoped agent chat.
- Use compact operational density: smaller text, tighter padding, clear column and section boundaries.

**Non-Goals:**

- Rebuilding Studio internals or changing the Studio editing model.
- Removing the workflow-scoped AI Agent from the wizard.
- Changing the underlying HyperFrames gallery catalog sync or generated catalog schema unless a naming adapter is needed.
- Changing the final render pipeline or Container Durable Object execution mechanics.
- Introducing a new visual theme; the implementation should follow the existing light, restrained design system.
- Keeping direct main-page manual generation, Render tab, or preview-first behavior as the primary creation path.

## Decisions

**1. Main page becomes intake, not a workbench.**

The root page should render a compact chat-first intake surface with optional context controls. The old workbench pattern, where gallery browsing, manual prompt editing, preview, and render controls all compete on the same page, should be retired from the primary flow.

Alternative considered: keep the current split gallery plus creation card and visually emphasize the AI Agent tab. That would preserve more existing UI, but it does not address the feedback that there is too much information on one page.

**2. Templates are a horizontal rail, components are a palette.**

The existing launch-video examples should be labeled as templates in user-facing main-page copy. Templates stay visible as a short horizontal rail so users can start from a pattern without leaving the chat context. Components should be hidden behind a composer control that opens a compact picker with search/filtering and a card grid.

Alternative considered: keep Examples and Components as equally weighted tabs. That makes browsing powerful, but it makes the catalog the main page's center of gravity instead of the agent intake.

**3. Send creates a workflow run and navigates immediately.**

The main-page Send button should submit the intake payload to workflow creation, then navigate to `/workflows/:runId`. This gives the user a strong sense of progress and moves detailed decisions into the wizard where they belong.

Alternative considered: send the message to the prompt agent first, wait for the agent to recommend a wizard, then ask for approval. That path already exists conceptually, but it keeps the user on the busy main page and delays the transition to the real work surface.

**4. Workflow creation needs an intake/awaiting-input boundary.**

Creating the workflow run from main-page Send should not imply the workflow container starts irreversible or expensive execution immediately. The run should be created with the intake context and opened in the wizard. Execution starts only when the user advances or approves the relevant wizard action.

Implementation can add a new workflow status such as `intake` or reuse `awaiting_approval` with a clear phase and options payload. A new status is cleaner if tests and transition rules are updated, because it distinguishes "needs initial wizard input" from "paused after execution reached an approval gate."

Alternative considered: create a normal queued run and immediately execute it. That is simpler technically but contradicts the desired multi-form wizard experience.

**5. The wizard uses compact three-region density.**

On desktop, `/workflows/:runId` should show stage navigation, active-stage form/editor content, and workflow-scoped agent assistance together. The layout should be compact, using smaller operational text, tighter internal padding, and clear hairline boundaries. On narrower screens, the regions collapse predictably without overlap.

Alternative considered: keep the current two-column route and only adjust styles. That misses the need for first-class form intake content and does not fully use available horizontal space for the stage rail.

**6. Preserve gallery context as structured workflow input.**

The workflow creation request should carry structured selected context rather than only appending prose to a prompt. Selected templates and components should preserve ids, names, source URLs, prompt text, materialization state, and placement intent. The wizard can render that context as editable or removable chips/cards and the agent can use it without asking the user to paste component internals.

Alternative considered: flatten selections into prompt text before workflow creation. That is faster but loses trusted component identity and makes later materialization less reliable.

## Risks / Trade-offs

- Main-page direct generation users may miss the Manual Prompt and Render tabs -> Preserve manual/editing affordances inside the wizard or Studio, and make the main composer accept direct detailed prompts.
- Workflow creation without execution may require new lifecycle state -> Update workflow status helpers, database assumptions, API responses, and tests together.
- A compact layout can become cramped -> Use density tokens deliberately: 12-14px operational text, 8-12px internal padding, 12-16px column gaps, clear panel borders, and stable overflow regions.
- Component picker can hide discoverability -> Keep the composer control visible and label selected component chips clearly.
- Renaming examples to templates may create code naming churn -> Prefer a user-facing naming adapter first; rename internal types only when it reduces confusion.
- Existing prompt-agent behavior may still auto-navigate on tool-started runs -> Align PromptAgentPanel's workflow navigation with the new first-class Send path and wizard intake state.

## Migration Plan

1. Add or adapt workflow-start input schema to accept main-page intake context: prompt, duration, selected templates, selected components, placement intents, project target, and initial workflow type.
2. Add the workflow intake lifecycle boundary and update status helpers, transition validation, API serialization, and tests.
3. Refactor main-page UI into compact chat intake, template rail, component picker, and selected context summary.
4. Wire main-page Send to workflow creation and route navigation instead of direct generation or an agent chat turn.
5. Refactor the wizard route into compact stage navigation, active stage form/editor region, and workflow-scoped agent region.
6. Add wizard form rendering for the initial creative brief/intake stage using the workflow run's stored context.
7. Preserve existing artifact editing, validation, authorization, project access, and workflow agent tools.
8. Browser-verify desktop and mobile layouts for no overlap, compact density, clear sections, Send navigation, and wizard context hydration.

Rollback is straightforward if this ships behind the new route behavior: restore the prior root page composition and keep workflow API additions dormant. Database lifecycle additions should be backward compatible with existing queued/running/succeeded runs.

## Open Questions

- Should the new workflow lifecycle use a new `intake` status, or reuse `awaiting_approval` with a `preflight` phase? The design recommends `intake` for clarity.
- Should templates remain internally named `examples` for now? The design recommends user-facing rename first and internal rename only where it simplifies code.
- Which workflow types beyond website-to-video should main-page Send support initially? The implementation can default to the existing website-to-video workflow when the current backend only supports that run type.
