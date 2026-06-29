## 1. Full-Page Responsive Layout

- [x] 1.1 Establish a full-viewport layout convention (full-width `min-h-dvh`/`h-dvh` shells with internal `min-h-0` scroll regions) and apply it in `__root.tsx`/shared layout as needed.
- [x] 1.2 Convert `/` (workspace) to a full-bleed responsive layout, removing the centered `max-w-*` page wrapper while keeping the generator/preview usable.
- [x] 1.3 Convert `/login` to a full-viewport responsive split layout.
- [x] 1.4 Convert `/admin` to full-bleed, keeping forms/tables at a comfortable inner reading width.
- [x] 1.5 Convert `/profile` to full-bleed with comfortable inner form width.
- [x] 1.6 Convert `/playground` to full-bleed responsive grid using available width.
- [x] 1.7 Verify every route at mobile and desktop widths for no overlap, clipping, or large empty margins, and confirm DESIGN.md surfaces/accent/chrome are preserved.

## 2. Preview Endpoint And Render Settings

- [x] 2.1 Add an authenticated, organization-scoped `GET /api/projects/$projectId/preview` that serves the project's current composition as a standalone HyperFrames HTML document with the player runtime.
- [x] 2.2 Add a test that the preview endpoint denies unauthenticated and cross-organization access.
- [x] 2.3 Extend `/api/render` to accept optional `width`/`height`/`durationSec`, validate them, and forward to the render pipeline, defaulting to current behavior when omitted.
- [x] 2.4 Add a test that render settings are passed through and that omitting them preserves default behavior.

## 3. Studio Package Integration

- [x] 3.1 Wire `@hyperframes/studio` styles and `@hyperframes/studio/tailwind-preset` into the build, scoped to the editor container so studio tokens do not bleed into other routes. (Prebuilt studio CSS copied to `public/_studio/studio.css` via `build.mjs`, loaded by a route-scoped `<link>`.)
- [x] 3.2 Add a client-only mount mechanism (mounted-guard + dynamic import) and code-split the Studio route so CodeMirror/mediabunny stay out of shared chunks. (`React.lazy` + mounted guard in the studio route.)
- [x] 3.3 Confirm the installed `@hyperframes/studio` exports used (`SourceEditor`, `Player`, `PlayerControls`, `Timeline`, `useTimelinePlayer`, `useElementPicker`, `usePlayerStore`) and their props against the project's React 19 setup.

## 4. Studio Editor Workspace

- [x] 4.1 Rebuild `/projects/$projectId/studio` as a full-height three-region shell matching the reference: left editor region (source editor + property panel), center preview + player controls + timeline, right Renders/Properties panel; replace the textarea.
- [x] 4.2 Render the live preview with `Player` using the project preview URL (`/api/projects/<id>/preview` via `projectId`), bridged via `useTimelinePlayer` for play/pause/seek.
- [x] 4.3 Add timeline scrubbing/selection/zoom via `Timeline` + `usePlayerStore`, kept usable for any composition.
- [x] 4.4 Embed `SourceEditor` (CodeMirror) bound to the single `html` source-of-truth state with live preview refresh.
- [x] 4.5 Wire on-canvas element selection (`useElementPicker`) and a property panel; edits apply to the live preview and patch the single-file source (verified: color edit applied + source marked dirty).
- [x] 4.6 Degrade gracefully when no element is selected / visual selection is unavailable: keep code editor and timeline scrubbing usable and show a hint.
- [x] 4.7 Add render-settings controls (resolution, duration) and a format switch (MP4/WEBM/MOV; default MP4) and include them in the render request.
- [x] 4.8 Add a Renders history panel that lists the project's renders from existing render metadata with links to the R2 outputs, organization-scoped (`GET /api/projects/<id>/renders`).
- [x] 4.9 Keep Save (PATCH `currentHtml`), Render, and Publish wired to the existing organization-scoped APIs; ensure edits persist before render/publish.

## 5. Verification

- [x] 5.1 Add or update tests for Studio authorization, source editing/persistence, render-settings passthrough, and the preview endpoint's access checks (preview auth/cross-org, render-settings passthrough/validation, source-edit persistence + version).
- [x] 5.2 Run `npm test` (33 pass), `npm run typecheck` (clean), `npm run build`, and `npm run deploy:dry-run` (succeeds).
- [x] 5.3 Browser-verify the Studio (code editor, preview, timeline scrubbing, element selection + property edits, renders panel) and all other routes (index, login, playground, profile, admin) full-bleed on desktop.
- [x] 5.4 Confirm requests never expose secrets (OpenRouter key stays server-side) and never return cross-organization data (preview/render/renders/project APIs are organization-scoped, covered by cross-org denial tests).
