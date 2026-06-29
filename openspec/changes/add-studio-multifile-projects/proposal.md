## Why

The reference HyperFrames editor is a multi-file project workspace: a left region with a `Code | Compositions | Assets` switcher, a file tree (`index.html`, `compositions/*.html` sub-compositions, an `assets/` directory, `meta.json`, generation scripts), and per-project render history. The companion change `embed-studio-editor-and-full-page-layout` embeds the Studio's center column (code editor, preview, player, timeline, render, renders panel) on our single-`currentHtml` model, but explicitly defers that left region because it needs a file-backed project model and backend. This change adds that backend so the embedded Studio can reach full parity with the reference's project structure.

## What Changes

- Add an organization-scoped, multi-file project model: each project holds a tree of source files (`index.html`, `compositions/*.html`, supporting files) plus binary assets, instead of a single `currentHtml` string.
- Host the Studio API on the Worker using `@hyperframes/studio-server`'s `createStudioApi(adapter)` Hono sub-app, with a custom `StudioApiAdapter` backed by our storage (text files in the database, binary assets in R2) and delegating renders to the existing Container DO → R2 pipeline.
- Implement adapter responsibilities: list/resolve project, bundle the project into preview HTML, build sub-composition preview pages, lint, serve the runtime URL, and start/track render jobs (with render progress).
- Add file management in the Studio: the `FileTree` with create/rename/delete/duplicate/move, and open-file tabs bound to the multi-file source model.
- Add the **Compositions** tab/navigation for sub-compositions (`data-composition-src`), including drill-down/breadcrumb between composition levels.
- Add the **Assets** tab: upload, list, and reference organization-scoped assets stored in R2.
- Migrate existing single-`currentHtml` projects into the new file model (seed `index.html` from `currentHtml`) without data loss.
- **BREAKING (data model):** projects gain a files/assets representation; `currentHtml` becomes the project's `index.html` within the file tree.

## Capabilities

### New Capabilities

- `studio-projects-backend`: A Worker-hosted, organization-scoped Studio API (the `@hyperframes/studio-server` Hono app plus our adapter) that lists/resolves projects, bundles and previews compositions (including sub-compositions), lints, serves assets, and starts/tracks render jobs against the existing render pipeline.

### Modified Capabilities

- `studio-workspace`: Add file-tree management (multi-file projects), Compositions (sub-composition) navigation, and Assets management to the Studio editing workspace, all organization-scoped.
- `tenant-projects`: The project persistence model changes from a single composition string to an organization-scoped tree of source files plus binary assets, with a migration from the existing single-HTML projects.

## Impact

- Affected dependencies: `@hyperframes/studio-server` (`createStudioApi`, `StudioApiAdapter`, `buildSubCompositionHtml`, `getMimeType`, helpers), `hono`, `@hyperframes/studio` `FileTree`/`CompositionBreadcrumb`/Assets surfaces, and `@hyperframes/core`/`parsers` (already transitive).
- Affected data model: new tables/columns for project files and assets (Drizzle + Neon migrations); existing `projects.currentHtml` is migrated into an `index.html` file; renders continue to reference project/organization.
- Affected APIs: a new Studio API surface mounted on the Worker (file CRUD, bundle/preview, sub-composition preview, lint, asset upload/list, render start/progress), all behind the existing auth + same-organization checks; the existing `/api/render`, publish, and preview endpoints are reconciled with the file model.
- Affected Cloudflare systems: R2 (asset storage in addition to render outputs, organization-prefixed), Worker routing/bindings for the Studio API, and the Container DO render pipeline (entry composition + format/fps/resolution from the adapter's `startRender`).
- Depends on `embed-studio-editor-and-full-page-layout` (this change extends that Studio with the deferred left region).
- Not in scope: registry/blocks catalog and install, Puppeteer-based thumbnail generation (optional adapter methods left unimplemented or stubbed), and voiceover/transcript generation scripts.
