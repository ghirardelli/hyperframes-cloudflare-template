## 1. Configuration And Bunny Clients

- [x] 1.1 Add typed Bunny environment configuration for Storage and Stream, including required/optional vars and startup validation.
- [x] 1.2 Implement a Bunny Storage client with region endpoint support, storage-zone path construction, `AccessKey` headers, optional SHA256 checksum headers, upload, read, delete, and metadata/error handling.
- [x] 1.3 Implement a Bunny Stream client for create-video, upload-video, fetch status/metadata, and provider error normalization.
- [x] 1.4 Add unit tests for Bunny client request construction, endpoint selection, secret isolation, and failed responses using mocked fetch.

## 2. Data Model And Migrations

- [x] 2.1 Add project visibility and any owner/share metadata needed by private and organization-shared projects.
- [x] 2.2 Add `project_members` with owner/editor/viewer roles scoped to the owning organization.
- [x] 2.3 Add generalized project entry tables for files, folders, assets, pipeline artifacts, and render references with provider, storage key, artifact role, content metadata, checksum, path, and soft-delete fields.
- [x] 2.4 Add entry version and project snapshot tables that can reference text content or immutable provider object pointers.
- [x] 2.5 Add render provider fields for Bunny Stream library/video IDs, processing status, playback/embed metadata, and optional Bunny Storage archive pointer.
- [x] 2.6 Add search columns/indexes for project title, prompt, entry path, artifact role, text content, generated descriptions, transcripts, and render metadata.
- [x] 2.7 Generate and review Drizzle migrations for additive deployment and rollback compatibility.

## 3. Authorization And Project Sharing

- [x] 3.1 Replace same-organization-only `requireProjectAccess` semantics with role-aware access checks for owner, explicit member, organization-shared projects, and organization admins.
- [x] 3.2 Add helpers that distinguish read, edit, share/manage, render, publish, and restore permissions.
- [x] 3.3 Add API routes for reading share state, sharing/unsharing with the organization, and managing explicit project members.
- [x] 3.4 Record audit metadata for visibility and project-member changes.
- [x] 3.5 Add tests for private defaults, same-org denial without share, organization share access, explicit roles, admin access, and cross-organization denial.

## 4. Storage Service And Project Entries

- [x] 4.1 Add a storage provider service that can read/write Postgres text, legacy R2 objects, Bunny Storage objects, and Bunny Stream render references.
- [x] 4.2 Normalize and validate project paths as POSIX relative paths, rejecting absolute paths, parent traversal, empty segments, control characters, and reserved prefixes.
- [x] 4.3 Update Studio file and asset APIs to create project entries and entry versions on create, update, rename, move, duplicate, upload, and delete.
- [x] 4.4 Store new binary assets and pipeline artifacts in Bunny Storage under `orgs/{organizationId}/users/{ownerUserId}/projects/{projectId}/workspace/...`.
- [x] 4.5 Preserve small editable source-file DB content while creating entry metadata and versions; decide and implement the threshold for Bunny object snapshots.
- [x] 4.6 Ensure file/folder tree listing comes from project entries, including empty folders and soft-delete filtering.
- [x] 4.7 Add tests for entry CRUD, folder creation, Bunny-backed asset upload, legacy R2 reads, checksum/provider metadata, and unauthorized object access.

## 5. Versions, Snapshots, And Search

- [x] 5.1 Create entry versions for text saves, binary uploads, metadata/path changes, soft deletes, pipeline artifact writes, and render/publish milestones.
- [x] 5.2 Create project snapshots for generate, render, publish, share, manual save, and restore events.
- [x] 5.3 Implement restore routes for a single entry version and a project snapshot, creating new current versions rather than rewriting history.
- [x] 5.4 Implement search indexing/backfill for projects and entries, including text content and extracted metadata/transcripts.
- [x] 5.5 Add project/search API routes that filter results through project permissions.
- [x] 5.6 Add tests for restore permissions, snapshot integrity, search result authorization, and search matches across names, paths, text, transcripts, and metadata.

## 6. Render And Publish Flow

- [x] 6.1 Update render completion to create a Bunny Stream video, upload final bytes, store processing status, and expose pending/ready/failed states.
- [x] 6.2 Optionally archive raw render bytes in Bunny Storage under the project render prefix and store the archive entry.
- [x] 6.3 Replace `/r/...` assumptions with DB-authorized render playback/download routes that resolve provider metadata.
- [x] 6.4 Associate renders with the project snapshot used as render input.
- [x] 6.5 Update publish/remix flows to use project snapshots and Stream playback metadata where applicable.
- [x] 6.6 Add tests for successful Stream upload, Stream failure handling, render access permissions, and legacy R2 render compatibility.

## 7. Studio UI

- [x] 7.1 Update the Studio file tree to show DB project entries with kind, artifact role, modified metadata, empty folders, and provider-backed assets.
- [x] 7.2 Add Studio sharing controls that show private/organization state and explicit members, with mutations enabled only for authorized users.
- [x] 7.3 Add Studio version history and restore interactions for entries and snapshots.
- [x] 7.4 Add Studio search over accessible projects/entries and wire result navigation into the file tree/editor.
- [x] 7.5 Update render panels to show Bunny Stream processing, ready playback, failures, and archived downloads when available.
- [ ] 7.6 Add UI tests or component tests for viewer/editor/owner/admin states.

## 8. Migration And Operations

- [x] 8.1 Backfill project entry rows for existing `project_files`, `project_assets`, `renders`, and `project_versions`.
- [x] 8.2 Add a migration script/job that can copy legacy R2 asset/render bytes to Bunny Storage in batches or mark them as legacy provider rows until accessed.
- [x] 8.3 Add an idempotent reindex job for search columns and extracted metadata.
- [x] 8.4 Document Cloudflare Workers configuration, including non-sensitive `wrangler.jsonc` vars and required `wrangler secret put` secrets for Bunny and existing app credentials.
- [x] 8.5 Add observability logs/metrics for Bunny upload failures, Stream processing failures, migration counts, and denied permission checks.

## 9. Verification

- [x] 9.1 Run unit tests for auth, path validation, storage clients, storage service, versions, search, render provider handling, and Studio APIs.
- [x] 9.2 Run typecheck and build.
- [ ] 9.3 Run an integration flow with mocked Bunny APIs for create project, upload assets, create folders, save files, search, restore, render, share with org, and access as another org member.
- [ ] 9.4 Browser-verify Studio owner/editor/viewer/admin flows on desktop, including file tree, version history, search, sharing, asset upload, render processing, and playback.
- [x] 9.5 Verify Bunny secrets are never serialized into client bundles, API responses, logs, or generated project files.
