## Context

The Studio route (`src/routes/projects.$projectId.studio.tsx`) is a controlled `<textarea>` bound to `project.currentHtml`, a `<hyperframes-player srcdoc=...>` preview, and Save/Render/Publish buttons that call `/api/projects/$projectId` (PATCH), `/api/render`, and `/api/projects/$projectId/publish`. The reference experience on hyperframes.dev is the `@hyperframes/studio` non-linear editor; that package is already a dependency (`0.7.17`) and ships React 19 components and hooks:

- Surfaces: `SourceEditor` (CodeMirror), `Player` + `PlayerControls`, `Timeline`, `PropertyPanel`, `NLEPreview`, `NLELayout`, `StudioApp`, `FileTree`, `CompositionBreadcrumb`.
- Hooks/state: `useTimelinePlayer` (iframe bridge, play/seek, clip-manifest parsing), `useElementPicker` (on-canvas selection via runtime postMessage), `usePlayerStore` (global zustand store of timeline elements, selection, time, zoom).
- Source utilities: `applyPatch`, `resolveSourceFile`, `parseStyleString`, `mergeStyleIntoTag`, `findElementBlock`, `formatTime`.

`StudioApp`/`NLELayout`/`FileTree` assume a file-backed project served by the Node/puppeteer `@hyperframes/studio-server` (multi-file projects, asset import, preview-by-projectId). Our data model stores a single `currentHtml` string per project. The reference session page itself is private and cannot be inspected; the package's exported API is the authoritative source for available features.

Separately, every route renders inside a centered, width-capped column (`max-w-7xl/6xl/5xl/4xl` + `mx-auto`), which wastes space for an editing tool.

A shared screenshot of the reference editor (HeyGen HyperFrames) confirms its layout, a full-bleed dark three-region shell:

- **Top bar:** project title, `+ New video`, left/right panel toggles, `Download`, share/privacy controls, and `Export` with an `MP4 / WEBM / MOV` format switch.
- **Left region:** `Code | Compositions | Assets` tabs over a **FILES tree** (`index.html`, `assets/`, `compositions/*.html`, `.py` voiceover scripts, `meta.json`, `transcript.json`), open-file tabs, a **CodeMirror** editor with line numbers, a `Lint` action, and a "Saved" status.
- **Center region:** the **preview**, then **player controls** (play, `m:ss / m:ss`, scrub bar, volume, `1x` rate, fullscreen), then a **timeline** with `Fit`/zoom controls, a time ruler, and tracks rendering clip thumbnails and audio waveforms with a playhead.
- **Right region:** a **Renders** history panel ("No renders yet").

The reference uses a multi-file project (sub-compositions via `data-composition-src`, an `assets/` directory, and generation scripts) backed by `@hyperframes/studio-server`. Our single-`currentHtml` model and approved "incremental embed" scope cover the center region (editor + preview + player + timeline + render) plus a renders panel; the left file-tree/Compositions/Assets tabs and the multi-file model remain deferred.

## Goals / Non-Goals

**Goals:**

- Replace the Studio textarea with real `@hyperframes/studio` editing surfaces — code editor, live player with timeline scrubbing, on-canvas element selection, and a property panel — composed at the component level on our existing single-HTML project model.
- Keep one source of truth (`html`) and reuse the existing organization-scoped save/render/publish APIs and the Worker → Container DO → R2 render pipeline.
- Add render settings (resolution, duration) carried through to `/api/render`.
- Make all routes full-viewport and responsive, maximizing real estate while honoring DESIGN.md and remaining usable on mobile.

**Non-Goals:**

- The `@hyperframes/studio-server` Node/puppeteer backend, the multi-file `FileTree` project model, the **Compositions** (sub-composition) tab, the **Assets** tab/import, voiceover/transcript generation scripts, and standalone GSAP keyframe authoring beyond what `PropertyPanel` offers on a single HTML file. (These appear in the reference editor's left region but require the deferred file-backed backend.)
- New tenant data-model tables (reuse the existing project/render/publish schema).
- Changing the generation (`/api/generate`) or auth model.

## Decisions

**1. Compose low-level components instead of mounting `StudioApp`/`NLELayout`.**
`StudioApp` and `NLELayout` are wired to `projectId`-addressed studio-server endpoints and `FileTree`. We instead assemble `Player` + `PlayerControls` + `Timeline` + `PropertyPanel` + `SourceEditor` directly, driving them with `useTimelinePlayer`, `useElementPicker`, and `usePlayerStore`. *Alternative considered:* mount `StudioApp` and stand up a studio-server shim — rejected for this change (backend risk on Cloudflare, large scope; this is the "Full NLE" path deliberately deferred).

**2. Drive the preview via a `directUrl`, not `srcdoc`.**
`Player`/`NLEPreview` accept `directUrl`. We add a same-origin preview endpoint (`GET /api/projects/$projectId/preview`, authenticated + organization-scoped) that serves the project's current composition as a standalone HyperFrames HTML document including the player/runtime, and pass its URL to `Player`. This gives the timeline/element-picker hooks a real iframe to bridge via `resolveIframe`/postMessage. *Alternative:* keep `srcdoc` — rejected because the timeline/picker bridge expects a resolvable iframe URL and the runtime postMessage channel.

**3. Single-file source model for patching.**
Element-picker and property edits return patch operations; we apply them with `applyPatch`/`mergeStyleIntoTag` against a one-entry file map (`{ "composition.html": html }`) and write the result back into the single `html` state. `resolveSourceFile` always resolves to that file. Saving PATCHes `html` exactly as today.

**4. Client-only rendering.**
TanStack Start SSRs routes, but the Studio components use `window`, `customElements`, CodeMirror, and `mediabunny`. The Studio editor subtree mounts client-side only (mounted-guard + dynamic import) and the route is code-split so CodeMirror/mediabunny don't bloat other pages.

**5. Styles via the studio Tailwind preset, scoped.**
Load `@hyperframes/studio/tailwind-preset` and the package stylesheet, scoped to the editor container so studio tokens don't override our DESIGN.md tokens elsewhere.

**6. Full-page layout convention.**
Introduce a shared full-height shell: each route is a `min-h-dvh` (Studio: `h-dvh`) flex/grid column at full width with internal `min-h-0` scroll regions, replacing `mx-auto max-w-*` page wrappers. Dense forms (admin/profile/login) keep a comfortable inner reading width inside the full-bleed shell. The Studio mirrors the reference three-region shell: a left editor region (source editor + property panel), a center preview region with player controls and a timeline below, and a right Renders history panel; the right (and later left) panel is collapsible via top-bar toggles.

**7. Render settings passthrough.**
Extend the `/api/render` request with optional `width`/`height`/`durationSec`; the Worker validates and forwards them to the render pipeline, defaulting to today's behavior when omitted. Surface render format options (MP4, and WEBM/MOV where the container supports them) consistent with the reference Export switch; default to MP4.

**8. Renders history panel.**
Reuse the existing per-project render metadata to show a Renders panel in the Studio (matching the reference "No renders yet"/render-history region), listing the project's renders with links to the R2 outputs, scoped to the organization. No new data model is required.

**9. Embedded studio theming.**
The reference editor is dark, while our app follows the light DESIGN.md aesthetic. Scope the studio (dark) theme to the editor container so it reads as an intentional "tool" surface and does not override DESIGN.md tokens on other routes; revisit a light studio theme later if desired.

## Risks / Trade-offs

- **Runtime/postMessage compatibility:** the element picker and timeline editing depend on the HyperFrames runtime inside the preview iframe exposing the expected postMessage API and `data-hf-id`/composition attributes. → Ship in capability order — code editor + player + timeline scrubbing first (these only need a resolvable iframe), then enable on-canvas selection/property editing where the runtime supports it; degrade gracefully (panel shows "select unavailable for this composition") instead of breaking.
- **Bundle size** (CodeMirror, mediabunny, studio chunks). → Code-split the Studio route; keep studio imports out of shared chunks.
- **CSS bleed** between the studio preset and our design tokens. → Scope studio styles to the editor container; verify other routes visually.
- **SSR crashes** from browser-only APIs. → Mounted-guard + client-only dynamic import; verify `npm run build` and `deploy:dry-run`.
- **Full-bleed regressions** (overlap/overflow on mobile). → Browser-verify each route at mobile and desktop widths; keep inner max-width for forms.
- **Preview endpoint data exposure.** → The preview endpoint enforces the same auth + same-organization checks as project read; never serves cross-organization HTML.

## Migration Plan

1. Land the full-page layout refactor first (CSS-only, low risk, independently shippable).
2. Add the authenticated preview endpoint and render-settings passthrough (additive, backward compatible).
3. Wire the studio styles/preset and build the new Studio editor behind the existing route, replacing the textarea.
4. Verify (`npm test`, `typecheck`, `build`, `deploy:dry-run`) and browser-verify all routes on desktop/mobile.

**Rollback:** revert the Studio route to the textarea version (git revert of the route + endpoint); layout changes are isolated CSS and can be reverted per route. No data migration is involved.

## Open Questions

- Does the current generation pipeline emit compositions with the `data-hf-id`/composition attributes the picker needs, or must generation be tagged for full visual editing?
- Which render dimensions/durations does the Container render pipeline actually support, to bound the render-settings UI?
- Does the Container render pipeline support WEBM/MOV output, or should the format switch be MP4-only for now?
- Should the resizable pane sizes persist per user (later enhancement) or reset per session (initial)?
- Should the deferred left region (file tree, Compositions, Assets — i.e. the multi-file/studio-server backend) be pulled into a follow-up change, and at what priority?
