## 1. Data Model And Migration

- [x] 1.1 Add a project source-files table keyed by `(projectId, path)` with content and timestamps in `src/db/schema.ts`.
- [x] 1.2 Add an assets representation (table for metadata + R2 object key) scoped by organization/project.
- [x] 1.3 Generate Drizzle migrations for the new tables.
- [x] 1.4 Add a backfill that seeds each existing project's `index.html` source file from its `currentHtml`, retaining `currentHtml` as a mirror during transition.
- [x] 1.5 Add a test that the migration/backfill produces `index.html` for existing projects and preserves renders/publish links.

## 2. Studio File/Asset API (Worker, reimplemented against D1/R2)

- [x] 2.1 Implement organization-scoped file CRUD on the Worker against `project_files`: list files, GET one file (`{path, content}`), upsert (PUT), delete, and duplicate — our own JSON contract.
- [x] 2.2 Implement multi-file preview: bundle a project's files (`index.html` + `<base>` so sub-compositions/assets resolve) into preview HTML, and serve sub-composition/asset preview by path. (MVP: serves stored file/asset by path; full sub-composition head-merging deferred — noted in design.)
- [x] 2.3 Implement asset upload/list/serve backed by R2 under an organization/project prefix with correct MIME types.
- [ ] 2.4 Reconcile the multi-file model with the existing render path so renders use the project's `index.html`/entry file (renders list/start already exist from the prior change).
- [x] 2.5 Add tests proving unauthenticated and cross-organization access to project files, assets, and preview is denied, and that file CRUD round-trips.

## 3. Studio Left Region (Client)

- [ ] 3.1 Wire the presentational `FileTree` component to the file CRUD API with open-file tabs bound to the multi-file source model.
- [ ] 3.2 Add the Compositions view listing the project's compositions with preview-by-file selection.
- [ ] 3.3 Add the Assets view with upload, listing, and reference-insertion of organization-scoped assets.
- [ ] 3.4 Extend the Studio editor to multi-file mode (left region tabs Code/Compositions/Assets) when a project has multiple files; keep single-file behavior otherwise.

## 4. Reconcile With Embedded Studio

- [ ] 4.1 Reconcile Save from `embed-studio-editor-and-full-page-layout` so it writes the active file / `index.html` in the file model.
- [ ] 4.2 Reconcile Render and Publish with the file model (entry composition + organization scoping preserved).
- [ ] 4.3 Decide and implement the `currentHtml` strategy (keep as `index.html` mirror or remove after readers migrate) consistently across generate/save/render/publish.

## 5. Verification

- [ ] 5.1 Add/update tests for multi-file persistence, asset storage, sub-composition preview, lint, and render delegation.
- [ ] 5.2 Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run deploy:dry-run`.
- [ ] 5.3 Browser-verify multi-file editing, Compositions navigation, asset upload/reference, preview, and render in the Studio on desktop and mobile.
- [ ] 5.4 Confirm browser network requests never expose secrets and never return cross-organization files, assets, or renders.
