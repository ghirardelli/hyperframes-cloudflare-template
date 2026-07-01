## 1. Workflow Intake Lifecycle

- [x] 1.1 Extend workflow start input validation to accept main-page intake prompt, duration, selected template context, selected component context, placement intent, and project target.
- [x] 1.2 Add a workflow intake lifecycle boundary, preferably an `intake` status, and update workflow status types, transition validation, active-status helpers, and serialization.
- [x] 1.3 Store the structured intake payload in workflow run options or a narrowly introduced persisted shape without flattening selected components into prompt-only text.
- [x] 1.4 Update workflow creation so main-page intake can create a run and return `/workflows/:runId` without starting container execution immediately.
- [x] 1.5 Add or update workflow API tests for intake creation, authorization, payload validation, lifecycle transitions, and no automatic container execution.

## 2. Main Page Chat-First Intake

- [x] 2.1 Refactor `src/routes/index.tsx` away from the tabbed generation/render workbench into a compact chat-first intake surface.
- [x] 2.2 Add a main composer form with prompt validation, Send submit state, recoverable error feedback, and workflow creation mutation wiring.
- [x] 2.3 Replace user-facing "Examples" copy with "Templates" on the main page while preserving existing catalog contracts where practical.
- [x] 2.4 Render selected launch-video examples as a compact horizontal template rail with select/remove behavior.
- [x] 2.5 Add a compact component picker opened from the composer with search/filtering, selectable component cards, and selected context summary chips.
- [x] 2.6 Preserve component materialization metadata and placement intent in selected workflow context.
- [x] 2.7 Wire Send to create the workflow run and navigate to `/workflows/:runId` on success.
- [x] 2.8 Remove or relocate main-page direct manual generation, Render tab, default preview player, and bento gallery primary surfaces.

## 3. Wizard Intake Forms and Layout

- [x] 3.1 Refactor `/workflows/$runId` into compact separated regions for stage navigation, active stage form/editor content, and workflow-scoped agent chat.
- [x] 3.2 Add an initial creative brief form for intake-created runs, prefilled from stored prompt, template context, component context, duration, and project target.
- [x] 3.3 Support saving and discarding form-backed workflow stage edits that are not raw artifact files.
- [x] 3.4 Preserve existing raw artifact editing, validation action, conflict handling expectations, and Studio handoff behavior.
- [x] 3.5 Add explicit wizard action wiring to start or continue workflow execution after the user reviews intake form details.
- [x] 3.6 Ensure desktop uses compact three-region density and narrow viewports collapse without horizontal overflow or overlapping UI.

## 4. Agent and Context Integration

- [x] 4.1 Ensure workflow-scoped `PromptAgentPanel` receives active run id, active stage id, selected context, project target, and intake prompt from the wizard route.
- [x] 4.2 Align prompt-agent workflow navigation behavior with the new first-class Send path so automatic navigation does not fight the intake flow.
- [x] 4.3 Show selected templates and components in the wizard as compact context items the user can review without seeing raw HyperFrames internals.
- [x] 4.4 Ensure agent tools continue to require approval for materialization, artifact patches, validation reruns, workflow continuation, and workflow cancellation.

## 5. Tests and Verification

- [x] 5.1 Add unit tests for intake payload normalization, workflow status transitions, and workflow run serialization.
- [x] 5.2 Add main-page tests for compact chat intake rendering, template selection, component picker selection, selected context removal, Send request payload, error state, and navigation.
- [x] 5.3 Add wizard route tests for intake run hydration, creative brief form editing, save/discard behavior, compact stage layout state, and execution start/continue action.
- [x] 5.4 Update or remove tests that assert old main-page tabbed workbench, bento gallery default surface, direct generation preview, or Render tab behavior.
- [x] 5.5 Run the relevant unit test suite and browser-verify desktop and mobile layouts for compact density, clear section boundaries, no overlap, Send navigation, and wizard context hydration.
