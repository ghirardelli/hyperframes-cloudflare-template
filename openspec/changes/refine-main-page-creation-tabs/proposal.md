## Why

The main page creation workspace is functionally complete, but it still feels busy: render controls live in a separate card, the agent panel has multiple competing boxes, and low-value status copy adds visual noise. This change tightens the creation flow so users move through AI Agent, Manual Prompt, and Render as one tabbed workflow.

## What Changes

- Add a `Render` tab as the last item in the existing main page tab menu.
- Move the current Export/Render card contents into the new Render tab, including resolution, format, render, reset, download, and selected-export summary controls.
- Expand duration choices to include 30 seconds, 1 minute, 2 minutes, 3 minutes, 4 minutes, and 5 minutes while preserving the existing generated duration request behavior.
- Remove the bottom "Bundled composition loaded." idle status treatment from the main page when it does not provide actionable user feedback.
- Remove the bordered empty-state treatment around "Ask for help turning a rough idea into a generation-ready prompt." so it reads as helper text, not an input field.
- Rework the AI Agent tab into a chat-style layout with the streaming conversation above and the "Ask the agent" input plus Send action anchored at the bottom.
- Move suggested prompt presentation and Apply/Approve actions into the chat stream instead of a separate suggested prompt box.
- Keep the user-confirmation behavior: the agent should ask whether the user is happy with the proposed prompt, then expose an Apply or Approve action in the chat stream that runs the prompt to create the HyperFrame video.

## Capabilities

### New Capabilities
- `main-page-creation-flow`: Covers the refined tabbed creation/render workflow, expanded duration choices, chat-style agent interaction, and removal of low-value page noise.

### Modified Capabilities

## Impact

- Affected UI: `src/routes/index.tsx`, `src/components/prompt-agent-panel.tsx`, and shared main-page creation helpers/tests.
- Affected behavior: creation mode tab state, render controls placement, duration preset list, agent message rendering, prompt package approval/apply placement, and idle status visibility.
- APIs/backends: no new API endpoints expected; existing `/api/agent/chat`, `/api/generate`, and `/api/render` behavior should be preserved.
- Tests/verification: update helper/unit tests and browser verification for the three-tab layout, expanded duration options, chat-style agent panel, and render controls inside the Render tab.
