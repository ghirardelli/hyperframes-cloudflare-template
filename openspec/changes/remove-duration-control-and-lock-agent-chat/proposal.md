## Why

The main creation panel still exposes duration as a pre-generation dropdown with explanatory copy, adding friction to the primary prompt flow. Long agent conversations can also push the composer down the page instead of keeping the chat input anchored, which makes iterative prompting harder on shorter viewports.

## What Changes

- Remove the main-page Duration dropdown from AI Agent and Manual Prompt creation tabs.
- Remove the helper text: "Duration is used before generation so the motion timing and final beat fit the timeline."
- Preserve internal/default duration handling so generation, render summaries, and agent prompt packages continue to work without a visible duration selector.
- Keep the AI Agent conversation thread above the chat composer, with the composer anchored at the bottom of the panel.
- Constrain the conversation thread to the available page/panel height and make the thread scroll internally when messages exceed the available space.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `main-page-creation-flow`: Remove the visible duration selection requirement from the main creation UI and require the AI Agent conversation stream to scroll within a locked, responsive panel height.

## Impact

- Affected UI: `src/routes/index.tsx`, `src/components/prompt-agent-panel.tsx`, and possibly shared main-page layout constants in `src/lib/main-page-layout.ts`.
- Affected tests: main-page creation flow/layout tests and prompt-agent component tests.
- No API, database, dependency, or Worker changes are expected.
