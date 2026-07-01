## Why

Recent user feedback says the authenticated main page is confusing and carries too much information at once. The next iteration should make the main page an AI-agent intake surface, with templates and components as lightweight context pickers, then hand users directly into the workflow wizard for detailed decisions.

## What Changes

- Replace the current main-page gallery/workbench composition with a compact chat-first intake layout.
- Rename user-facing "examples" to "templates" on the main page while preserving existing catalog data contracts where useful.
- Move templates from a primary bento workspace into a horizontal rail below the chat composer.
- Move components from a full gallery tab into a compact picker opened from the chat composer, with search/filtering and selectable component cards.
- Make the main-page Send action create a workflow run immediately and navigate to `/workflows/:runId`.
- Preserve selected prompt text, selected templates, selected components, component placement intent, duration, and project context in the created workflow run.
- Rework `/workflows/:runId` into the first detailed workspace after Send, with a compact multi-form wizard layout, stage navigation, active-stage form content, and stage-scoped AI Agent chat.
- Introduce a workflow intake state so a workflow can be created and opened in the wizard before execution starts.
- Keep spacing and typography intentionally compact: smaller operational text, tighter padding, and clear column/section boundaries.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `main-page-creation-flow`: Main page becomes a chat-first workflow intake, templates/components become context pickers, and Send creates/navigates to a workflow run.
- `agent-guided-pipeline-wizard`: The wizard becomes the immediate post-intake workspace and presents compact multi-form stage content, not only artifact editing.

## Impact

- Affected route: `src/routes/index.tsx` will be simplified around a compact chat composer, template rail, component picker, selected context chips, and workflow-start submit behavior.
- Affected route: `src/routes/workflows.$runId.tsx` will need compact wizard form surfaces in addition to the existing artifact editor and workflow-scoped agent.
- Affected components: `PromptAgentPanel`, `HyperframeGalleryWorkspace`, or their replacements may need to be split so main-page intake, template rail, component picker, selected context, and wizard-stage agent can be composed independently.
- Affected workflow APIs: add or adjust workflow-run creation so it can accept prompt/template/component context and open the wizard before execution starts.
- Affected data model: workflow run options or a related intake payload must store the prompt, selected catalog context, duration, project target, and stage-plan seed.
- Affected tests: add client tests for chat-first intake rendering, template/component selection handoff, Send navigation, workflow creation request payload, compact wizard rendering, and preservation of existing authorization boundaries.
