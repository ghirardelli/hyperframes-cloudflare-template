## Why

Our Studio route is a bare `<textarea>` for raw HTML plus Save/Render/Publish buttons, while the reference experience on hyperframes.dev is a full non-linear editor (code editor, live player with timeline scrubbing, on-canvas element selection, and a property panel). The `@hyperframes/studio` package we already depend on exports those exact surfaces, so users currently get a fraction of the available capability. At the same time every page is locked to a centered, width-capped column (`max-w-7xl`/`6xl`/`5xl`/`4xl`), which wastes screen space for a tool that needs maximum real estate.

## What Changes

- Replace the Studio raw-HTML textarea with embedded `@hyperframes/studio` editing surfaces on our existing single-project model: CodeMirror `SourceEditor`, `Player` + `PlayerControls` live preview, `Timeline` scrubbing/selection/zoom, and `PropertyPanel` + element-picker visual editing.
- Keep the existing organization-scoped save, render (Worker → Container DO → R2), and publish pipeline as the backing actions for the new editor; Studio edits flow into the same project `currentHtml` and render/publish APIs.
- Add render settings (resolution, duration) surfaced in the editor and carried through to the render request.
- Load the `@hyperframes/studio` styles/tailwind preset and player runtime so the embedded components render correctly inside our app.
- **BREAKING (UX):** The Studio no longer exposes a plain HTML textarea as the primary editing surface; raw source editing moves into the CodeMirror editor panel.
- Convert all application routes (`/`, `/login`, `/admin`, `/profile`, `/playground`, `/projects/$projectId/studio`) to full-viewport, responsive layouts that use the full width and height of the screen instead of centered fixed-width columns, while preserving the DESIGN.md aesthetic (quiet surfaces, single blue accent, restrained chrome) and comfortable reading widths for dense forms.
- Ensure the full-page layouts remain usable and non-overlapping on mobile and desktop.

## Capabilities

### New Capabilities

- `app-layout`: Full-viewport, responsive page shell behavior applied across all authenticated and unauthenticated routes, maximizing usable screen real estate without breaking the design system or mobile usability.

### Modified Capabilities

- `studio-workspace`: The Studio editing workspace requirements change from a generic "editing surface with live preview" to specific non-linear-editor surfaces (code editor, player with timeline scrubbing, on-canvas element selection, property panel, and render settings), still scoped to the user's organization and still backed by the existing save/render/publish pipeline.

## Impact

- Affected routes: `src/routes/projects.$projectId.studio.tsx` (rebuilt around the Studio components) and the layout shell of every other route under `src/routes/`.
- Affected dependencies: `@hyperframes/studio` (components, `usePlayerStore`/`useTimelinePlayer`/`useElementPicker` hooks, `tailwind-preset`), `@hyperframes/player` runtime, `zustand` (already present); the studio stylesheet/preset must be wired into the build.
- Affected APIs: existing `/api/projects/$projectId` (GET/PATCH), `/api/render`, and `/api/projects/$projectId/publish` are reused; render settings (resolution/duration) are added to the render request payload. No new tenant data model is introduced.
- Affected design system: `DESIGN.md` remains the source of truth; layouts shift from centered max-width columns to full-bleed responsive shells.
- Not in scope: the Node/puppeteer `@hyperframes/studio-server` backend, file-tree/multi-file projects, asset import, and GSAP keyframe authoring beyond what the embedded `PropertyPanel` provides on the current single-HTML model.
