## Context

The current app persists projects in Postgres, mirrors the active Studio entry file into `projects.currentHtml`, stores text project files in `project_files`, stores binary assets and rendered MP4s in R2, and authorizes project access with a same-organization check in `requireProjectAccess`. This is a solid first multi-file Studio model, but advanced HyperFrames projects need a durable folder-like workspace that can hold pipeline outputs such as scripts, storyboards, cards, source media, generated assets, transcripts, snapshots, and final renders.

Bunny should own the bytes that may grow large or need global delivery. Postgres should remain the source of truth for project identity, file tree entries, ownership, sharing, versions, search, and provider pointers. Bunny credentials must never reach the browser; all reads/writes go through the server after DB permission checks.

External API constraints from Bunny docs:

- Bunny Storage uploads use the storage-zone password as an `AccessKey` header against a region endpoint such as `https://storage.bunnycdn.com` or `https://la.storage.bunnycdn.com`.
- Bunny Storage file upload is `PUT /{storageZoneName}/{path}/{fileName}` and creates missing directory paths for the uploaded object.
- Bunny Stream creates a video with `POST /library/{libraryId}/videos`, then accepts bytes with `PUT /library/{libraryId}/videos/{videoId}`.

## Goals / Non-Goals

**Goals:**

- Store project workspace bytes in Bunny Storage under org/user/project prefixes.
- Store rendered playable video outputs in Bunny Stream and persist Stream metadata in Postgres.
- Keep the DB as the authority for file trees, empty folders, permissions, versions, snapshots, search, and provider pointers.
- Add private-by-default projects, organization sharing, explicit project user roles, and organization-role-aware administration.
- Preserve existing R2-backed projects during migration through a provider abstraction.
- Provide a concrete implementation plan and Cloudflare Workers/Wrangler variable and secret list.

**Non-Goals:**

- Exposing Bunny Storage or Stream keys to the browser.
- Relying on Bunny folder listings as the source of truth for Studio file trees.
- Making shared projects public outside the owning organization.
- Implementing collaborative live cursors or CRDT editing.
- Migrating every legacy R2 object synchronously during first deploy.

## Decisions

**1. Postgres is the project control plane; Bunny is the byte plane.**
Add a generalized project entry model that represents folders, text files, binary assets, pipeline artifacts, and renders. Each entry records organization, project, owner/user context, normalized path, kind, artifact role, provider, provider key, content type, size, checksum, timestamps, and soft-delete status. Bunny stores bytes, but access is always decided by DB rows.

Alternative considered: let Bunny Storage folder listings define the tree. Rejected because empty folders, permission metadata, soft deletes, versions, search, and cross-provider migration all need DB state.

**2. Use immutable ID prefixes, not names or emails.**
New Bunny Storage keys should use:

`orgs/{organizationId}/users/{ownerUserId}/projects/{projectId}/workspace/{normalizedPath}`

Versioned objects should use:

`orgs/{organizationId}/users/{ownerUserId}/projects/{projectId}/versions/{entryVersionId}/{basename}`

Render archives should use:

`orgs/{organizationId}/users/{ownerUserId}/projects/{projectId}/renders/{renderId}/{filename}`

This satisfies "filed under the org, by user, and then by project" while avoiding mutable slugs and emails. User-facing names can be stored in DB metadata.

Alternative considered: org slug/user email/project title paths. Rejected because renames and email changes would require object moves and increase leakage risk.

**3. Introduce a storage provider abstraction before moving bytes.**
Create a `storage_objects` or entry-level provider model with provider values such as `postgres`, `r2`, `bunny-storage`, and `bunny-stream`. Existing `r2Key` columns become legacy pointers or are replaced by `storageProvider` + `storageKey`/`streamVideoId`. Reads route through a small storage service that can fetch from R2 or Bunny. New writes default to Bunny.

Alternative considered: hard replace R2 columns in one migration. Rejected because it makes rollback and partial migration brittle.

**4. Text files keep DB metadata and may keep DB content for small editable sources.**
For source files under the small editable limit, keep the current low-latency DB content path and also write a Bunny object when the file is part of a snapshot, export, or pipeline artifact. Large text artifacts and binary files store bytes in Bunny with DB searchable extracts.

Alternative considered: move every source edit to Bunny immediately. Rejected because transactional multi-file saves, diffing, and search are simpler and faster with Postgres for small text.

**5. Studio file trees are logical DB trees.**
Studio lists `project_entries` ordered by normalized path. Folder creation creates DB rows. File upload creates or updates a DB entry and streams bytes to Bunny through the server. Asset serving uses app routes that authorize first, then fetch from Bunny or issue short-lived signed/proxied responses if token auth is later enabled.

Alternative considered: direct browser upload to Bunny. Rejected for the first implementation because it complicates checksums, audit, and permission enforcement. It can be added later with short-lived server-issued upload tokens.

**6. Project sharing is DB-backed and private by default.**
Add `projects.visibility` (`private`, `organization`) and `project_members` for explicit user roles (`owner`, `editor`, `viewer`). `requireProjectAccess` becomes role-aware: owners and explicit members can access; organization members can access when visibility is `organization`; organization admins can manage projects in their org. Sharing with the org exposes the entire logical tree through the app, not Bunny credentials.

Alternative considered: keep same-organization access for all projects. Rejected because the user specifically wants user-owned project folders that can later be shared with the org.

**7. Versioning is entry-level plus snapshot-level.**
Each write creates a `project_entry_versions` row containing the previous/new metadata and either text content or an immutable object pointer. A `project_snapshots` manifest records a consistent set of entry version IDs for milestones such as generate, render, publish, share, and restore.

Alternative considered: only version `index.html`. Rejected because advanced HyperFrames projects involve many files and generated artifacts.

**8. Search indexes DB metadata and extracted content only.**
Use Postgres search columns/indexes over project title, prompt, entry path, artifact role, text content, descriptions, transcript text, and render metadata. Binary files are searched through metadata and generated extracts, not raw bytes.

Alternative considered: scan Bunny objects on each query. Rejected for latency, cost, and permissions complexity.

**9. Render output goes to Bunny Stream, with optional Bunny Storage archive.**
The render container still returns video bytes. The server creates a Bunny Stream video, uploads the bytes, stores `streamLibraryId`, `streamVideoId`, status, dimensions, duration, and playback metadata, and optionally archives the raw MP4 in Bunny Storage under the project render prefix. Existing `/r/...` download behavior is migrated to a DB-authorized render route that resolves provider metadata.

Alternative considered: only Bunny Storage for MP4s. Rejected because Bunny Stream gives video-specific processing and playback delivery.

**10. Configuration is explicit and environment-driven.**
Use Worker env vars and secrets for Bunny endpoints and credentials. Required Cloudflare configuration values are:

- `BUNNY_STORAGE_ZONE_NAME`
- `BUNNY_STORAGE_ACCESS_KEY`
- `BUNNY_STORAGE_ENDPOINT`
- `BUNNY_STREAM_LIBRARY_ID`
- `BUNNY_STREAM_ACCESS_KEY`

Recommended optional Cloudflare configuration values are:

- `BUNNY_STREAM_API_BASE`
- `BUNNY_STORAGE_CDN_HOSTNAME`
- `BUNNY_STREAM_CDN_HOSTNAME`
- `BUNNY_STREAM_EMBED_HOSTNAME`
- `BUNNY_STREAM_COLLECTION_ID`
- `BUNNY_TOKEN_AUTH_KEY`
- `BUNNY_WEBHOOK_SECRET`

Secrets such as access keys, token auth keys, webhook secrets, database URLs, auth secrets, and provider API keys MUST be set with `wrangler secret put` or the Cloudflare dashboard's secret UI rather than committed to `wrangler.jsonc`. Non-sensitive values such as endpoints, zone names, library IDs, collection IDs, hostnames, and feature flags can live in `wrangler.jsonc` `vars`.

Existing app secrets still apply, especially `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `OPENROUTER_API_KEY`, optional `OPENROUTER_MODEL`, and optional `INITIAL_ADMIN_EMAILS`.

## Risks / Trade-offs

- Bunny outage or upload failure -> keep DB writes transactional around object metadata, use idempotent object keys, record failed upload state, and retry background-safe operations.
- Partial migration from R2 -> keep provider metadata and legacy R2 reads until each object is copied or naturally replaced.
- Direct CDN URLs bypassing app permissions -> keep project assets behind app routes by default; only use CDN hostnames with token auth or for explicitly publishable assets.
- Large object uploads through the app increase server bandwidth -> begin with server-proxied uploads for correctness, then add signed direct upload only after permission and checksum handshakes are in place.
- Search index drift -> update search rows in the same transaction as DB entry writes and add a backfill/reindex task.
- Path traversal and namespace leakage -> normalize all paths as POSIX relative paths, reject `..`, absolute paths, empty segments, control characters, and reserved prefixes.
- Stream processing is asynchronous -> store processing status and expose a refresh/webhook path; Studio should show pending/processing/ready/failed states.
- Share semantics can surprise users -> make projects private by default and show share state in Studio/project list before exposing org-wide access.

## Migration Plan

1. Add configuration types and Bunny clients with tests for request construction, endpoint selection, AccessKey headers, checksum headers, and error handling.
2. Add schema changes: project visibility, project members, generalized project entries, entry versions, snapshots, storage provider fields, Stream render metadata, search columns/indexes.
3. Update authorization helpers so project access checks owner, explicit members, org visibility, org membership, and org admin role.
4. Add the storage service abstraction and route current R2 asset/render reads through it without changing behavior.
5. Switch new binary asset and pipeline artifact writes to Bunny Storage. Keep small source text in DB while adding entry/version rows.
6. Switch render completion to Bunny Stream upload and store Stream metadata; optionally archive MP4 bytes in Bunny Storage.
7. Update Studio APIs and UI to use DB logical tree entries, version history, search, and share endpoints.
8. Add a migration/backfill script that creates entries for existing `project_files`, `project_assets`, and `renders`; either copies R2 bytes to Bunny in batches or marks rows as legacy `r2` provider until accessed/re-rendered.
9. Verify with unit tests, integration tests with mocked Bunny fetches, and end-to-end Studio flows for create/edit/upload/search/version/render/share.

Rollback: leave legacy R2 provider reads in place, gate Bunny writes behind env/config, and keep DB migrations additive until the new routes are proven. If Bunny writes are disabled, the app can continue using the R2 provider path for existing assets/renders.

## Open Questions

- Should every text save write a Bunny object immediately, or only versions/snapshots and larger artifacts?
- Do we want per-project Bunny Stream collections, per-organization collections, or a single library-level collection strategy?
- What maximum sizes should apply to source files, assets, source media, and final renders?
- Should direct Bunny CDN delivery be allowed for organization-shared assets if token auth is configured, or should all project assets remain proxied by the app?
- Which organization roles can change project visibility and manage explicit project members?
