## Context

The authenticated root workspace currently uses a large left preview column and a right column containing the prompt agent, the manual Generate card, Render controls, and status. That layout exposes multiple prompt-like inputs at once: the agent empty-state guidance, the agent chat textarea, and the manual prompt textarea. Users can generate successfully, but the page does not make the recommended path obvious.

The preview is also wrapped in a flex container that grows to match the right column height. As the prompt-agent conversation grows, the preview stage becomes taller and more dominant even though the player itself only needs a stable 16:9 viewport near the top of the page.

The backend already supports the settings needed for this redesign:

- `/api/generate` accepts `durationSec` and stores it on generated projects.
- Prompt-agent forwarded props and structured outputs already include `durationSec`.
- `/api/render` accepts optional `width`, `height`, `durationSec`, and `format` settings, with validation and support for `mp4`, `webm`, and `mov`.
- HyperFrames composition guidance currently targets a stable 1920x1080 authoring canvas.

## Goals / Non-Goals

**Goals:**

- Make the first action on the main page clear by replacing stacked prompt surfaces with a tabbed **AI Agent** / **Manual Prompt** creation panel.
- Remember the user's selected creation tab locally and restore it for future new-project sessions.
- Keep the preview visible near the top, roughly half the desktop page width, without a large black outer box or height coupling to the right column.
- Add compact prompt guidance through an information icon that works on hover and keyboard focus.
- Add duration selection before generation and ensure it reaches both manual generation and prompt-agent generation.
- Add render/export resolution and format controls near Render MP4 and send those settings to `/api/render`.
- Preserve the existing manual Generate path, prompt-agent approval path, project persistence, preview updates, and render/download behavior.

**Non-Goals:**

- Changing the HyperFrames authoring canvas away from 1920x1080 in this change.
- Persisting creation-mode preferences server-side or per organization.
- Rebuilding the Studio editor UI.
- Adding a full onboarding wizard or multi-step blocking flow.
- Adding new provider dependencies or changing the OpenRouter model behavior.

## Decisions

**1. Use one creation panel with remembered tabs.**

Create a workspace-level `creationMode` state with values `agent` and `manual`. Store the user's explicit tab choice in local storage, for example `motion-frames.creationMode`. Initialize from that value on the main page and update it whenever the user changes tabs. If AI generation is disabled or config is not ready, the UI may show Manual Prompt first or disable the AI Agent tab without overwriting the stored preference.

Alternative considered: keep both the prompt-agent panel and Generate card stacked. That preserves the current code structure but leaves the page with multiple competing starting points.

**2. Keep the final prompt canonical, but only expose it in the active mode.**

The existing `prompt` state remains the canonical generation prompt. In AI Agent mode, the user starts in the agent chat input and the agent's structured prompt package can apply into `prompt`. In Manual Prompt mode, the user edits `prompt` directly. The Generate Preview action uses the same `prompt` state in either mode.

This avoids separate agent and manual prompt sources that can drift. The UI copy should name the surfaces clearly: "Ask the agent" for chat, "Suggested prompt" for the agent package, and "Final generation prompt" for the manual/editable prompt.

Alternative considered: maintain separate prompt state for each tab. That would make switching tabs surprising and create edge cases around which prompt is generated.

**3. Move preview to a fixed top-aligned viewport.**

Replace the current flex-growing black stage with a top-aligned preview section. On desktop, use a two-column layout that caps the preview area around half the available width, for example a grid with `minmax(360px, 0.95fr)` and `minmax(390px, 1fr)` or equivalent responsive constraints. The preview wrapper should be `aspect-video`, optionally sticky at the top on desktop, and not `flex-1`.

The player itself can retain a black internal background if the HyperFrame content needs it, but the page should not add a large black outer container. On mobile, the preview stacks above the creation panel and must not introduce horizontal overflow.

Alternative considered: keep the current grid and only reduce player max width. That does not fix the height-coupling bug.

**4. Put duration in creation settings.**

Duration changes the generated timeline and prompt instructions, so it belongs before generation. Add a duration control near the creation panel, with a default of 6 seconds and common presets such as 3, 6, 8, 10, and 15 seconds. The implementation can support custom values within the backend's existing 1-120 second range if the control pattern stays simple.

Manual Generate sends `durationSec` to `/api/generate`. Prompt-agent forwarded props include `durationSec`, and approved agent generation sends the selected or agent-recommended duration to the existing generation path. When the agent emits a structured prompt package with a duration, applying that package should update the duration control as well as the prompt.

Alternative considered: put duration under Render. That is too late for generated animation timing.

**5. Put resolution and format in export settings.**

Keep the composition canvas stable at 1920x1080 for authoring and preview. Add export settings near Render MP4 for output resolution and format. Recommended presets:

- 1080p: 1920x1080 default
- 4K: 3840x2160
- Custom and 720p are deferred unless the renderer gains a tested scaling path

The render request should include `width`, `height`, and `format` when the selected preset differs from defaults or when being explicit is clearer. The render button label can reflect the selected format, such as "Render MP4" or "Render WebM".

Alternative considered: add resolution to generation. That implies the model should author different canvas sizes, which conflicts with the current HyperFrames skill contract.

**6. Implement prompting help as an info affordance, not permanent copy.**

Place an information icon in the creation panel header. On hover and focus, show concise advice: include subject, mood, pacing, brand cues, camera movement, duration, and final beat. The affordance should be keyboard accessible with `aria-describedby` or a small popover/tooltip pattern. Avoid long instructional text permanently occupying the workspace.

Alternative considered: add helper paragraphs above each input. That explains the flow but makes the workspace feel more like onboarding than an operational tool.

## Risks / Trade-offs

- **Local storage preference can become stale** -> Treat it as a convenience only. If AI is disabled, prevent the AI tab from blocking use and avoid overwriting the stored choice unless the user selects another tab.
- **Tabbed UI can hide manual prompt from users who expect it** -> Make tabs prominent and label the panel "Create HyperFrame" rather than "Prompt Agent".
- **Agent duration and user duration can conflict** -> Applying an agent package should update duration explicitly, and the Generate Preview action should use the visible duration value.
- **Resolution controls may imply different composition layout** -> Label the setting as "Export resolution" and keep the preview badge as the composition canvas.
- **Sticky preview can crowd short screens** -> Use sticky only at larger breakpoints and keep mobile as a normal stacked layout.
- **Render settings can increase render cost** -> Keep 1080p default and make 4K/custom explicit choices.

## Migration Plan

1. Add shared UI state/helpers for creation mode persistence, duration presets, and render resolution presets.
2. Refactor the root workspace into a stable preview column and a right-side creation/export workbench.
3. Move the existing prompt agent and manual prompt textarea into a tabbed creation panel.
4. Wire duration through manual generation, prompt-agent forwarded props, prompt package application, and approved generation.
5. Add export resolution/format controls and send selected settings through the existing `/api/render` request.
6. Add or update tests for tab persistence, duration/render request bodies, agent/manual flow preservation, and responsive preview behavior.
7. Browser-verify desktop and mobile widths for no duplicate primary prompt inputs, stable preview height, no horizontal overflow, generation, approval, and render settings.

Rollback is straightforward: restore the previous root workspace layout while leaving the existing `/api/generate`, `/api/agent/chat`, and `/api/render` endpoints unchanged.

## Open Questions

None blocking. Implementation defaults:

- Default to AI Agent when AI generation is available and there is no stored user preference.
- Fall back to Manual Prompt when AI generation is disabled or not configured.
- Ship 1080p and 4K render presets first; defer 720p/custom resolution until there is a tested scaling path.
- Apply an agent package's duration to the visible duration control when the package is applied.
