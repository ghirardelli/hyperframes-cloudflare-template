## Why

Advanced HyperFrames projects now behave like real project folders: prompts, source files, assets, generated pipeline artifacts, snapshots, and rendered videos all belong together. The current implementation stores source in Postgres, binary assets/renders in R2, and grants broad same-organization access; it needs a durable project workspace model backed by Bunny Storage and Bunny Stream while keeping Postgres as the authority for ownership, sharing, versions, and search.

## What Changes

- Add a server-side Bunny provider integration for project object storage and video delivery: Bunny Storage for workspace files/assets/artifacts, Bunny Stream for final playable renders.
- Introduce a DB-backed logical file tree for every project folder under an immutable org/user/project namespace, so sharing a project exposes the complete tree through app permissions rather than direct storage credentials.
- Add DB-backed project sharing: projects default to owner/private, can be shared with the organization, can grant explicit user roles, and remain constrained to the owning organization.
- Add first-class project entry metadata for files, folders, assets, pipeline outputs, and render objects, including provider, storage key, content type, size, checksum, artifact role, creator/updater, and soft-delete state.
- Add entry versioning and project snapshots so text edits, binary uploads, pipeline outputs, and render/publish actions can be audited and restored.
- Add searchable project metadata and file contents using Postgres indexes over titles, paths, artifact roles, prompts, text content, generated descriptions, transcripts, and render metadata.
- Update Studio file tree behavior to read the logical DB tree, write bytes through the Worker to Bunny Storage, browse versions, search within accessible projects, and show share/org permission state.
- Update render persistence to upload final videos to Bunny Stream, optionally archive the raw render in Bunny Storage, and store Stream IDs/playback metadata in the DB.
- Keep R2 compatibility during migration by recording each object's storage provider and migrating existing R2 assets/renders behind the new abstraction.
- **BREAKING (storage contract):** new project file/blob writes go through the storage provider abstraction and Bunny by default; code must stop assuming `r2Key` is the only object reference.

## Capabilities

### New Capabilities

- `bunny-project-storage`: Server-side Bunny Storage and Bunny Stream integration for project workspace objects, pipeline artifacts, and rendered video playback.
- `project-access-sharing`: DB-backed project permissions, organization sharing, explicit project roles, and authorization checks over projects and all project entries.
- `project-versions-search`: Version history, immutable snapshots, restore points, and searchable metadata/content for project files, assets, pipeline artifacts, and renders.

### Modified Capabilities

- `tenant-projects`: Project persistence and authorization change from same-organization access over R2-backed assets/renders to owner/private-by-default projects with provider-backed entries, organization sharing, Stream render metadata, and migration for existing R2 objects.
- `studio-workspace`: Studio file trees, assets, renders, and project actions use the DB-authoritative tree/permissions/version/search APIs instead of assuming direct R2-backed assets and same-org visibility.

## Impact

- Affected data model: `projects`, `project_files`, `project_assets`, `renders`, `project_versions`, plus new project entries, entry versions, project shares/memberships, search columns/indexes, and storage provider metadata.
- Affected APIs: Studio file/assets/preview/render endpoints, project listing/detail/share/search/version routes, render download/playback routes, and prompt/pipeline artifact persistence.
- Affected infrastructure: Cloudflare Workers/Wrangler vars and secrets for Bunny Storage and Bunny Stream, optional Bunny CDN/token auth hostnames, migration jobs/scripts for R2 to Bunny or legacy provider records.
- Affected security model: Bunny keys remain server-side only; browser access is always authorized through the app and backed by DB permissions.
- External references: Bunny Storage uses a storage-zone `AccessKey` and region endpoint; uploads are `PUT /{storageZoneName}/{path}/{fileName}`. Bunny Stream creates videos with `POST /library/{libraryId}/videos` and uploads video bytes with `PUT /library/{libraryId}/videos/{videoId}`.
