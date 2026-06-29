## 1. Tab State And Duration Helpers

- [x] 1.1 Add or update typed tab state so the main page supports `agent`, `manual`, and `render` panel tabs while persisting only `agent` or `manual` as the remembered creation mode.
- [x] 1.2 Expand duration presets to include 30 seconds, 1 minute, 2 minutes, 3 minutes, 4 minutes, and 5 minutes.
- [x] 1.3 Raise duration validation and schemas from the current 120-second ceiling to 300 seconds across main-page helpers, prompt-agent forwarded props, prompt-agent result/tool schemas, and Worker project/generation normalization.
- [x] 1.4 Add tests for Render tab non-persistence and long-duration normalization/preservation.

## 2. Main Page Three-Tab Layout

- [x] 2.1 Update the creation panel tablist to show AI Agent, Manual Prompt, and Render in that order.
- [x] 2.2 Move the existing Export card contents into the Render tab and remove the separate Export card from the right column.
- [x] 2.3 Keep resolution, format, render, reset, download, and selected-export summary behavior working inside the Render tab.
- [x] 2.4 Preserve shared duration controls for AI Agent and Manual Prompt generation without making duration look like a render-only option.
- [x] 2.5 Hide the idle "Bundled composition loaded." status while preserving actionable generation, render, success, warning, and error feedback.

## 3. AI Agent Chat Surface

- [x] 3.1 Rework `PromptAgentPanel` into a chat-style layout with a bounded conversation stream above and the Ask the agent composer anchored at the bottom.
- [x] 3.2 Remove the input-like bordered empty-state treatment around "Ask for help turning a rough idea into a generation-ready prompt."
- [x] 3.3 Move structured prompt package rendering into assistant chat artifacts instead of a separate suggested prompt box.
- [x] 3.4 Show prompt package content, duration, checklist, and assistant explanation inline in the chat stream when available.
- [x] 3.5 Move Apply and approval actions into the chat stream so the user can apply the prompt or approve generation from the relevant assistant/tool message.
- [x] 3.6 Preserve Stop, Retry, Clear, loading, streaming partials, and tool approval/denial states after the layout change.

## 4. Generation And Render Behavior

- [x] 4.1 Ensure manual generation requests preserve selected long durations up to 300 seconds.
- [x] 4.2 Ensure AI Agent forwarded props and approved generation requests preserve selected or applied long durations up to 300 seconds.
- [x] 4.3 Ensure Render tab requests continue to include selected output width, height, and format.
- [x] 4.4 Ensure applying an agent prompt still updates canonical prompt state so Manual Prompt mode reflects the applied prompt.

## 5. Tests And Verification

- [x] 5.1 Update unit tests for duration presets, 300-second validation, and tab preference behavior.
- [x] 5.2 Update prompt-agent tests for inline prompt package application and approved generation duration preservation.
- [x] 5.3 Update render/request tests if selectors or tab placement change existing assumptions.
- [x] 5.4 Add or update browser verification for desktop and mobile widths covering the three-tab layout, Render tab controls, hidden idle status, long duration options, and chat-style agent composer placement.
- [x] 5.5 Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run deploy:dry-run`.
