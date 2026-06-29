## Context

This change extends `embed-studio-editor-and-full-page-layout`, which embeds the Studio center column (code editor, preview, player, timeline, render, renders panel) on a single-`currentHtml` model. The reference editor's left region — `Code | Compositions | Assets`, a file tree, and sub-composition navigation — needs a file-backed project and a backend.

The installed `@hyperframes/studio-server@0.7.17` provides exactly that contract:

- `createStudioApi(adapter: StudioApiAdapter): Hono` — a Hono sub-app with all Studio API routes, mounted under `/api` by the host. Hono runs on Cloudflare Workers.
- `StudioApiAdapter` injects host behavior: `listProjects`, `resolveProject(id)`, `bundle(projectDir)`, `lint(html)`, `runtimeUrl`, `rendersDir(project)`, `startRender({project, outputPath, format, fps, quality, jobId, outputResolution, composition, ...}): RenderJobState`, and optional `generateThumbnail`, `resolveSession`, `listRegistryCatalog`, `installRegistryBlock`.
- Helpers: `buildSubCompositionHtml(projectDir, compPath, runtimeUrl)`, `getMimeType`, `MIME_TYPES`, `createProjectSignature`, `walkDir`. `walkDir` and the fs-reading helpers assume a filesystem; the adapter methods themselves are storage-agnostic (`dir` is an opaque id we control).

`@hyperframes/studio` exposes the matching client surfaces: `FileTree` (with create/rename/delete/duplicate/move/import callbacks), `CompositionBreadcrumb`, `NLELayout` (`activeCompositionPath`, `onCompositionChange`), and the picker/property panel already wired in the prior change.

Our current model stores one `currentHtml` string per project; renders go through the Worker → Container DO → R2 pipeline; assets are not modeled.

## Goals / Non-Goals

**Goals:**

- Add an organization-scoped multi-file project model (source files + binary assets).
- Host `createStudioApi` on the Worker with a storage-backed adapter (files in the database, assets in R2), delegating renders to the existing pipeline.
- Wire the Studio `FileTree`, Compositions navigation, and Assets surfaces to that backend.
- Migrate existing single-HTML projects into the file model with no data loss.

**Non-Goals:**

- Registry/blocks catalog and install (`listRegistryCatalog`/`installRegistryBlock` left unimplemented).
- Puppeteer thumbnail generation (`generateThumbnail` stubbed or container-delegated later).
- Voiceover/transcript generation scripts seen in the reference file tree.
- Changing the auth model or the render container itself (only its invocation inputs).

## Decisions

**1. Mount `createStudioApi(adapter)` on the Worker, don't reimplement the routes.**
We reuse the maintained Hono route surface and supply only host behavior via the adapter. *Alternative:* hand-roll file/preview/render endpoints — rejected; it would drift from the client's expectations and duplicate maintained logic.

**2. Storage: source files in the relational DB, assets in R2.**
Text source files (`index.html`, `compositions/*.html`, etc.) are rows keyed by `(projectId, path)` in Neon/Drizzle (small, diff-friendly, transactional). Binary assets go to R2 under an organization/project prefix. The adapter's opaque `projectDir`/`dir` is the project id; adapter methods resolve files from these stores rather than a filesystem (the fs helpers `walkDir`/fs-reading variants are not used). *Alternative:* all files in R2 — rejected for source because the DB gives transactional multi-file saves and simpler listing; assets stay in R2 because they are binary and large.

**3. Bundle/preview via the adapter.**
`bundle(projectDir)` composes the project's files into a single preview HTML (resolving sub-composition references and injecting `runtimeUrl`); sub-composition preview pages reuse `buildSubCompositionHtml` semantics adapted to our store. The Studio preview `directUrl` from the prior change points at the Worker-hosted preview route. `getMimeType` serves assets with correct content types.

**4. Renders delegate to the existing pipeline.**
`startRender` maps the adapter inputs (`composition` entry file, `format`, `fps`, `quality`, `outputResolution`) onto the Container DO → R2 render and returns a `RenderJobState` updated reactively; the Studio render-progress/SSE route reflects it. Render outputs and metadata stay organization-scoped as today.

**5. Organization scoping at the adapter and route layer.**
Every adapter method and mounted route enforces the authenticated user's organization: `resolveProject`/`listProjects` filter by organization; file CRUD, asset upload/list, preview, and render verify same-organization ownership before touching storage. Cross-organization access is denied.

**6. Migration: `currentHtml` → `index.html`.**
A Drizzle migration plus a backfill creates an `index.html` source file per existing project from its `currentHtml`, preserving renders/publish links. The Studio reads/writes the file model thereafter; `currentHtml` is retained as a compatibility mirror of `index.html` (or dropped once all readers move) to avoid breaking the prior change's save path.

## Risks / Trade-offs

- **studio-server fs helpers on Workers** (`walkDir`, fs-reading paths inside some helpers) → use only `createStudioApi` + adapter and storage-agnostic helpers (`getMimeType`, `MIME_TYPES`); implement bundling/sub-composition assembly against our stores; verify no Node `fs`/`path` reaches the Worker bundle.
- **Bundle compatibility** (sub-composition resolution differing from the reference) → seed from `buildSubCompositionHtml` semantics and test sub-composition previews against known compositions.
- **Render input mapping** (format/fps/resolution the container actually supports) → validate and clamp adapter inputs; default to current MP4 behavior; reject unsupported formats clearly.
- **Asset isolation** → organization/project-prefixed R2 keys with same-organization checks on every read/write; never serve cross-organization assets.
- **Migration data loss** → backfill is additive (creates `index.html` from `currentHtml`); keep `currentHtml` as a mirror until verified; reversible by dropping the new tables.
- **Bundle size / cold start** from mounting another Hono app → keep the Studio API in the Worker's existing app; lazy-import heavy helpers.

## Migration Plan

1. Land the data model: project-files and assets tables + R2 asset prefix (Drizzle migration), with the `currentHtml` → `index.html` backfill.
2. Implement the `StudioApiAdapter` and mount `createStudioApi` on the Worker behind auth + organization checks.
3. Wire the Studio `FileTree`, Compositions navigation, and Assets tab to the new API; point the preview `directUrl` at the Worker preview route.
4. Reconcile save/render/publish from the prior change with the file model (save writes `index.html`/active file).
5. Verify (`npm test`, `typecheck`, `build`, `deploy:dry-run`) and browser-verify multi-file editing, sub-composition preview, asset upload, and render.

**Rollback:** the Studio falls back to single-file editing (prior change) if the file API is disabled; the new tables/R2 prefix can be dropped without affecting `currentHtml`-based projects since it is retained as a mirror during transition.

## Open Questions

- Keep `currentHtml` permanently as a mirror of `index.html`, or drop it after all readers migrate?
- Which file types may be created/edited in the tree (HTML/CSS/JS only, or also JSON/text), and what upload size/type limits apply to assets?
- Does the render container accept an arbitrary entry `composition` path, or only `index.html`?
- Should sub-composition and asset operations be transactional with source saves, or independently committed?
