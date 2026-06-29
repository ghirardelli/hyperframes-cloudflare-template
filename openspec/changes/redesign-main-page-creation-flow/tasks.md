## 1. Creation State And Settings

- [x] 1.1 Add typed helpers for creation mode persistence, using `agent` and `manual` values with a local-storage key such as `motion-frames.creationMode`.
- [x] 1.2 Add duration presets and validation helpers for the main page, defaulting to 6 seconds and supporting the backend's existing 1-120 second range.
- [x] 1.3 Add render export presets for 1080p and 4K plus supported format values that map to the existing `/api/render` request shape.
- [x] 1.4 Update prompt-agent panel props and client tool handling so selected duration is forwarded to the agent and applied prompt packages can update both prompt and duration.

## 2. Main Page Layout

- [x] 2.1 Refactor `src/routes/index.tsx` into a stable preview area and a creation/export workbench instead of a flex-growing preview plus stacked right-column cards.
- [x] 2.2 Replace the black outer preview stage with a top-aligned `aspect-video` preview wrapper that stays roughly half width on desktop and stacks above controls on mobile.
- [x] 2.3 Add responsive layout constraints so chat/prompt content growth does not change preview height and mobile widths do not create horizontal overflow.
- [x] 2.4 Move status, Studio link, active source, and preview metadata into the redesigned layout without obscuring the preview or creation controls.

## 3. Tabbed Creation Panel

- [x] 3.1 Add a `Create HyperFrame` panel with AI Agent and Manual Prompt tabs, restoring the remembered tab when possible.
- [x] 3.2 Ensure only the active tab's primary input is visible: agent chat in AI Agent mode and final generation prompt textarea in Manual Prompt mode.
- [x] 3.3 Preserve shared canonical prompt state so agent-applied prompts appear in Manual Prompt mode and manual edits are sent as current prompt context to the agent.
- [x] 3.4 Add a hover- and focus-accessible information affordance with concise HyperFrames prompting advice.
- [x] 3.5 Keep AI Agent mode usable with existing streaming, tool cards, approval controls, stop/retry/clear states, and structured prompt package rendering.
- [x] 3.6 Keep Manual Prompt mode usable with direct Generate Preview behavior, loading state, disabled AI configuration state, and error feedback.

## 4. Generation And Render Wiring

- [x] 4.1 Add a visible duration control to the creation panel and include the selected `durationSec` in manual `/api/generate` requests.
- [x] 4.2 Include selected duration in prompt-agent forwarded props and approved agent generation requests.
- [x] 4.3 Update applying a structured agent prompt package so `generationPrompt` updates prompt state and `durationSec` updates the duration control.
- [x] 4.4 Add render export controls near Render, including resolution preset and format selection.
- [x] 4.5 Include selected `width`, `height`, and `format` in `/api/render` requests while preserving existing generated HTML/project rendering behavior.
- [x] 4.6 Keep Render, Reset, Download, model/attempt/lint status, and Open in Studio behavior working after both manual and approved-agent generation.

## 5. Tests And Verification

- [x] 5.1 Add client tests for creation mode persistence, AI-unavailable fallback, and tab-specific input visibility.
- [x] 5.2 Add client tests for duration forwarding, agent package duration application, and manual prompt preservation across tab switches.
- [x] 5.3 Add client or Worker-facing tests for render settings request bodies and invalid render setting handling where coverage is missing.
- [x] 5.4 Add or update browser verification for desktop and mobile widths covering stable preview sizing, no black outer preview stage, no horizontal overflow, AI Agent flow, Manual Prompt flow, and render export controls.
- [x] 5.5 Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run deploy:dry-run`.
