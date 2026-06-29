## Why

The main page now exposes the prompt agent, draft prompt package, manual prompt textarea, preview, generate action, and render action at the same time, which makes first-time users unsure where to start. The preview also grows with the right column, so conversation history can make the video area dominate the page instead of staying as a stable reference.

## What Changes

- Redesign the authenticated main page around a tabbed creation panel with **AI Agent** and **Manual Prompt** modes so only one primary prompting input is visible at a time.
- Remember the user's selected creation mode and use it as the default the next time they start a new project on the main page.
- Keep the HyperFrame preview near the top of the page, cap it to roughly half of the desktop layout width, remove the large black outer stage, and prevent it from stretching vertically when chat or prompt content grows.
- Add an information affordance near the creation controls that explains how to prompt effectively for HyperFrames without adding permanent instructional text to the workspace.
- Add a duration control before generation because duration affects prompt coaching, generation instructions, timeline timing, and project persistence.
- Move export resolution controls to the render/export area because the generated composition canvas remains stable while render output size can vary.
- Preserve the existing prompt-agent approval flow, manual Generate path, project persistence, preview update behavior, and Render MP4 path.

## Capabilities

### New Capabilities

- `main-page-creation-flow`: Root workspace creation experience covering tabbed AI/manual prompting, remembered creation mode, prompting guidance, stable top preview layout, duration selection before generation, and render/export settings.

### Modified Capabilities

- `studio-workspace`: The workspace render and project flow must accept the main page's selected duration and export settings while preserving the existing Studio/project access and render pipeline contracts.

## Impact

- Affected route: `src/routes/index.tsx` will be reorganized from a two-column preview-plus-stacked-controls page into a stable preview and tabbed creation/export workbench.
- Affected prompt agent UI: `src/components/prompt-agent-panel.tsx` will need to support tabbed placement, clearer labels, remembered mode, duration-aware forwarded props, and a more compact prompt-package presentation.
- Affected state: add local persistence for the user's preferred creation mode and page state for duration and export resolution.
- Affected API requests: pass `durationSec` to `/api/generate` and prompt-agent forwarded props; pass selected render dimensions to `/api/render`.
- Affected render UX: expose resolution and format choices near Render MP4 without changing the default 1920x1080 composition canvas.
- Affected tests: add or update client tests for tab persistence, duration forwarding, render settings forwarding, preview layout behavior, and preservation of manual and approved-agent generation flows.
