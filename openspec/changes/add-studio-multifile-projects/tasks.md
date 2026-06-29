## 1. Data Model And Migration

- [x] 1.1 Add a project source-files table keyed by `(projectId, path)` with content and timestamps in `src/db/schema.ts`.
- [x] 1.2 Add an assets representation (table for metadata + R2 object key) scoped by organization/project.
- [x] 1.3 Generate Drizzle migrations for the new tables.
- [x] 1.4 Add a backfill that seeds each existing project's `index.html` source file from its `currentHtml`, retaining `currentHtml` as a mirror during transition.
- [x] 1.5 Add a test that the migration/backfill produces `index.html` for existing projects and preserves renders/publish links.

## 2. Studio API Adapter And Mount

- [ ] 2.1 Implement a `StudioApiAdapter` backed by our storage: `listProjects`, `resolveProject`, `bundle`, `lint`, `runtimeUrl`, `rendersDir`, and `startRender` (no Node `fs`/`path` in the Worker bundle).
- [ ] 2.2 Implement project bundling and sub-composition preview assembly against the source-file store with the runtime injected.
- [ ] 2.3 Mount `createStudioApi(adapter)` on the Worker behind authentication and same-organization checks.
- [ ] 2.4 Implement file CRUD routes/behavior (create, read, update, rename, move, delete) organization-scoped.
- [ ] 2.5 Implement asset upload/list/serve backed by R2 with correct MIME types and organization scoping.
- [ ] 2.6 Map `startRender` (entry composition, format, fps, quality, resolution) onto the Container DO → R2 pipeline and expose render progress.
- [ ] 2.7 Add tests proving unauthenticated and cross-organization access to project files, assets, preview, and render is denied.

## 3. Studio Left Region (Client)

- [ ] 3.1 Wire the `FileTree` component to the file CRUD API with open-file tabs bound to the multi-file source model.
- [ ] 3.2 Add the Compositions view with sub-composition listing, drill-down, and `CompositionBreadcrumb` navigation using `activeCompositionPath`/`onCompositionChange`.
- [ ] 3.3 Add the Assets view with upload, listing, and reference-insertion of organization-scoped assets.
- [ ] 3.4 Point the Studio preview `directUrl` at the Worker-hosted preview route and verify timeline/picker still bridge.

## 4. Reconcile With Embedded Studio

- [ ] 4.1 Reconcile Save from `embed-studio-editor-and-full-page-layout` so it writes the active file / `index.html` in the file model.
- [ ] 4.2 Reconcile Render and Publish with the file model (entry composition + organization scoping preserved).
- [ ] 4.3 Decide and implement the `currentHtml` strategy (keep as `index.html` mirror or remove after readers migrate) consistently across generate/save/render/publish.

## 5. Verification

- [ ] 5.1 Add/update tests for multi-file persistence, asset storage, sub-composition preview, lint, and render delegation.
- [ ] 5.2 Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run deploy:dry-run`.
- [ ] 5.3 Browser-verify multi-file editing, Compositions navigation, asset upload/reference, preview, and render in the Studio on desktop and mobile.
- [ ] 5.4 Confirm browser network requests never expose secrets and never return cross-organization files, assets, or renders.
