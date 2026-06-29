## Context

The main page currently uses a two-tab creation panel for AI Agent and Manual Prompt modes, with duration controls shared above the active tab and a separate Export card below the creation card. The AI Agent panel also has a separate chat log, a separate suggested prompt box, and an input area, which makes the flow feel more like a form than a conversational assistant.

The requested refinement is UI-first, but the expanded duration choices include values above the current 120-second helper/schema ceiling. Implementation must therefore update client, agent, and Worker duration validation to accept up to 300 seconds if 3-5 minute options are exposed.

## Goals / Non-Goals

**Goals:**
- Present AI Agent, Manual Prompt, and Render as a single three-tab workflow in the existing creation panel.
- Move render resolution, format, render, reset, download, and selected-export summary into the Render tab.
- Keep AI Agent and Manual Prompt as the remembered creation-mode choices, without persisting Render as the default new-project entry point.
- Extend duration options through 5 minutes and preserve selected duration in manual and agent-assisted generation.
- Make the AI Agent tab feel like a chat surface: conversation/streaming area above, composer at the bottom, prompt proposals and approval actions inside the stream.
- Remove low-value idle status and input-like empty-state chrome.

**Non-Goals:**
- No new backend endpoint or hosted AI gateway.
- No redesign of the left preview area beyond preserving its current stable top-aligned behavior.
- No changes to render storage, project ownership, or organization authorization.
- No automatic long-duration render optimization beyond honoring the selected duration in prompt generation.

## Decisions

### Use a three-tab panel but persist only creation modes

The tablist will contain `AI Agent`, `Manual Prompt`, and `Render`. Internally, implementation should separate the active panel tab from the persisted creation mode:

- selecting `AI Agent` writes the stored creation mode as `agent`;
- selecting `Manual Prompt` writes the stored creation mode as `manual`;
- selecting `Render` changes only the visible panel and does not overwrite the stored creation-mode preference.

This preserves the user's prior preference for starting new projects while still allowing Render to live in the same navigation surface.

### Keep duration as a shared pre-generation setting

Duration should remain visible for AI Agent and Manual Prompt workflows because it shapes prompt generation, timing, and final beat. The option list should include existing short-form values plus 30 seconds, 1 minute, 2 minutes, 3 minutes, 4 minutes, and 5 minutes. The render tab may summarize the selected duration, but duration itself remains a creation setting rather than a render-only setting.

Because options exceed 120 seconds, update validation constants and prompt-agent schemas to allow 1-300 seconds. This avoids displaying values that are silently clamped before generation.

### Fold render controls into the panel instead of keeping a second card

The current Export card content should move under the Render tab to reduce vertical scanning and keep all "what do I do next?" actions in one panel. Render controls remain disabled while generation or rendering is active and continue to send selected `width`, `height`, and `format` through the existing render request.

### Treat agent prompt packages as chat artifacts

The separate suggested prompt card should be removed. Structured prompt packages and tool approval controls should render as assistant chat artifacts inside the conversation stream. A proposed prompt message can include the generated prompt, duration, checklist, and a clear `Apply` or `Approve & Generate` action.

When the agent proposes a prompt, the assistant message should ask whether the user is happy with it. The user can respond conversationally, and when the generation tool requires approval, the approval action should appear inline with that tool message.

### Replace idle status with actionable feedback

The "Bundled composition loaded." status is non-actionable and should not occupy a persistent bottom slot. Status UI should still appear for meaningful events: generation in progress, render in progress, errors, generated output, render success, and download availability. If there is no meaningful status, the status area should be hidden.

## Risks / Trade-offs

- Longer duration options can create expectations for long renders → Mitigate by using duration only as generation context initially and keeping render timeout/error feedback explicit.
- A Render tab can be mistaken for a creation-mode preference → Mitigate by persisting only AI Agent/Manual Prompt selections.
- Moving prompt package actions into chat can hide them in long conversations → Mitigate with auto-scroll to the newest assistant/tool artifact and compact action styling.
- Removing the separate status box could reduce feedback after background actions → Mitigate by preserving actionable status messages and render/download controls in the relevant tab.
