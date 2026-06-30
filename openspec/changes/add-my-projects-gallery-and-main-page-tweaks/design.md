## Context

The app already persists organization-scoped projects, generated HTML, project files, versions, and renders. The main page can generate and render HyperFrames and can select gallery examples/components as prompt context, while Studio is available at `/projects/$projectId/studio`. The missing product surface is a user-facing library for created projects/videos, plus a project-level description field that can be edited separately from prompt text.

The current gallery catalog sync points at `heygen-com/hyperframes-launch-video`, which yields one root launch video and section cards sharing the same preview. The corrected source is `heygen-com/hyperframes-launches`, where each launch lives in its own folder, so the sync logic needs to discover folders and produce distinct example cards.

## Goals / Non-Goals

**Goals:**
- Add a My Projects page for authenticated users to browse their accessible HyperFrame projects in a responsive bento gallery.
- Let users name projects/videos and optionally add short descriptions through project create/update/list/search flows.
- Keep project and render access scoped by the existing organization/project permission model.
- Polish the main creation page with 60/40 desktop columns, compact filter buttons, colored Selected Context styling, and distinct Examples sourced from the corrected launches repo.

**Non-Goals:**
- Replace Studio editing, sharing, version history, or render pipelines.
- Add public publishing or cross-organization discovery to My Projects.
- Build a full asset management or bulk project operations experience.
- Pull large binary launch assets into the repository when URL-based previews are sufficient.

## Decisions

1. Use `/projects` as the My Projects route with nav label "My Projects".
   - Rationale: Existing Studio URLs and APIs already use the `/projects` namespace, and the label can match the requested page name without adding a competing `/my-projects` route.
   - Alternative considered: `/my-projects`; rejected because it would split project-library and Studio URL semantics.

2. Extend project metadata on the existing `projects` table.
   - Add nullable `description` text to `projects`, update Drizzle schema/migration, and accept `description` in create/update request bodies.
   - Reuse `title` as the user-facing project/video name, preserving current generated title fallback behavior.
   - Include `description` in list, get, search, Studio load, and My Projects responses.
   - Alternative considered: Store descriptions in `project_entries.metadata`; rejected because the description is first-class project metadata and belongs beside title/prompt/visibility.

3. Keep gallery authorization inside existing project APIs.
   - My Projects should fetch accessible projects through `/api/projects`.
   - To avoid card-level permission drift, latest render links should use authorized `/api/renders/:id` or existing per-project render listing behavior.
   - Implementation may add a lightweight latest-render summary to the project list response or fetch render summaries lazily per visible card; in either case, render URLs must stay behind existing authorization checks.
   - Alternative considered: Client-side filtering after fetching all organization projects; rejected because project visibility must remain server-enforced.

4. Render a true bento gallery without nested decorative cards.
   - Use a CSS grid with stable row heights, responsive spans, and aspect-ratio controlled preview regions.
   - Cards should show name, optional description, updated date, duration, latest render/preview affordance, and actions to open Studio or latest render.
   - Use existing UI primitives and lucide icons for actions.
   - Alternative considered: A simple table; rejected because the requested experience is a visual gallery of created videos.

5. Update the launch examples sync to folder-based discovery.
   - Change default source to `https://github.com/heygen-com/hyperframes-launches`.
   - Clone LFS-safely or fetch GitHub tree metadata without requiring large media downloads.
   - For each launch folder, read folder-local metadata (`meta.json`, README/storyboard/render files when present) and emit a unique example with folder-specific preview media and source URL.
   - Fail clearly or skip with a sync report when a folder lacks required display metadata, avoiding duplicate placeholder thumbnails.
   - Alternative considered: Manually hard-code examples; rejected because the existing generated catalog/check workflow should remain the source of truth.

6. Main page polish stays local to the creation workspace.
   - Replace the desktop grid columns with a 3fr/2fr or equivalent 60/40 definition, preserving mobile stacking.
   - Change component filters from horizontally scrolling pills to compact wrapping controls with smaller text, tighter padding, and overflow-safe labels.
   - Style Selected Context with a calm blue/green tint and readable chips only when context exists.
   - Alternative considered: Broader layout redesign; rejected because the request is a targeted proportional and control-density adjustment.

## Risks / Trade-offs

- Project list payload growth -> Keep any latest-render summary minimal and avoid embedding full HTML or raw render objects in list responses.
- Migration mismatch across environments -> Add a Drizzle migration for nullable `projects.description`; rollback can drop the column because it is additive and optional.
- Launch repo media size or Git LFS behavior -> Use LFS-safe discovery and remote raw URLs for previews rather than committing downloaded videos.
- Bento cards overloading the page with playable media -> Prefer latest-render thumbnails/posters or lazy video loading for visible cards only.
- Search semantics drift -> Include `description` in existing permission-filtered search predicates and tests so inaccessible matches remain hidden.

## Migration Plan

1. Add `description` to the Drizzle schema and generate a migration.
2. Update create/update/list/get/search project API logic to accept and return nullable descriptions.
3. Add My Projects route and nav link, consuming existing permission-scoped project APIs.
4. Update the main page layout/filter/context styling.
5. Update and run gallery sync/check against `heygen-com/hyperframes-launches`.
6. Run targeted tests for project APIs, gallery catalog validation, main page behavior, and a production build/typecheck.

Rollback is straightforward for UI changes by reverting route/components. The database change is additive; if rollback is required before users rely on descriptions, drop the nullable column with a follow-up migration.

## Open Questions

- Should My Projects show only projects owned by the user, or all projects the user can access? The current spec follows existing `/api/projects` access semantics and shows all accessible projects.
- Should descriptions be editable directly from My Projects, Studio, or both? The spec requires metadata editing by authorized editors and implementation can expose the first edit UI in My Projects, then reuse it in Studio if time allows.
