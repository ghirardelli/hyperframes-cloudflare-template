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
- [x] 2.4 Reconcile the multi-file model with the existing render path so renders use the project's `index.html`/entry file: generate and save sync the `index.html` file with the `currentHtml` mirror the render path reads.
- [x] 2.5 Add tests proving unauthenticated and cross-organization access to project files, assets, and preview is denied, and that file CRUD round-trips.

## 3. Studio Left Region (Client)

- [x] 3.1 Wire the presentational `FileTree` component to the file CRUD API with file selection/create/delete bound to the multi-file source model.
- [x] 3.2 Add the Compositions view listing the project's compositions with preview-by-file selection.
- [x] 3.3 Add the Assets view with upload, listing, and reference-insertion of organization-scoped assets.
- [x] 3.4 Extend the Studio editor to multi-file mode (left region tabs Code/Compositions/Assets) when `multiFile` is set; keep single-file behavior otherwise.

## 4. Reconcile With Embedded Studio

- [x] 4.1 Reconcile Save so it writes the active file via the file API (and mirrors `index.html` → `currentHtml`).
- [x] 4.2 Reconcile Render and Publish with the file model (render reads the entry via the `currentHtml` mirror; organization scoping preserved).
- [x] 4.3 Implement the `currentHtml` strategy: keep it as the `index.html` mirror, kept in sync by generate and save across the studio.

## 5. Verification

- [x] 5.1 Add/update tests for multi-file persistence and access control (file CRUD round-trip, unauth/cross-org denial, preview fallback). (Sub-composition head-merge/lint deferred per design.)
- [x] 5.2 Run `npm test` (41 pass), `npm run typecheck` (clean), `npm run build` + `npm run deploy:dry-run` (succeed, no Node fs in the Worker bundle).
- [x] 5.3 Browser-verify multi-file editing, Compositions navigation, asset upload, and preview in the Studio (desktop). Live file-create + asset upload/serve round-trips confirmed against the real DB/R2.
- [x] 5.4 Confirm requests never expose secrets and never return cross-organization files, assets, or renders (organization-scoped via requireProjectAccess; covered by denial tests).
