## Context

Motion Frames is already a TanStack Start application, but most client-side server state is still managed with page-local `fetch`/`fetchJson` helpers, `useEffect` loads, local loading/error state, and manual refresh calls after mutations. The same patterns appear in app-owned surfaces such as the app header, main workspace, projects page, admin page, profile page, and playground.

The server side is intentionally custom Cloudflare Worker API code. Auth, tenant checks, Drizzle/Neon persistence, Cloudflare Containers, R2/Bunny storage, HyperFrames generation, and TanStack AI streaming already have clear ownership. This change should not move those responsibilities; it should make the app-owned React client surfaces consume them through a consistent server-state layer.

Studio is an explicit preservation boundary. The Studio editor is connected to the upstream HyperFrames project, and the HyperFrames team is actively changing Studio. This change must not touch Studio route loading, `src/components/studio/StudioEditor.tsx`, Studio file tree/assets/share/version/search behavior, or `@hyperframes/studio` integration so upstream Studio updates remain easier to apply.

TanStack Query fits this change because the official React package, `@tanstack/react-query`, provides query caching, mutations, invalidation, and polling/refetch controls while keeping the existing API endpoints intact. Relevant docs:

- React overview: https://tanstack.com/query/latest/docs/framework/react/overview
- Installation: https://tanstack.com/query/latest/docs/framework/react/installation
- Query invalidation: https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation
- Mutations: https://tanstack.com/query/latest/docs/framework/react/guides/mutations

## Goals / Non-Goals

**Goals:**
- Add TanStack Query as the shared client server-state runtime for authenticated API reads, mutations, cache invalidation, and active-only polling.
- Replace repeated page-local fetch helpers with shared JSON request helpers and domain query/mutation hooks.
- Keep user-visible behavior the same while reducing duplicated loading, error, and refresh logic.
- Use stable, typed query keys so mutation side effects invalidate only the affected profile, project, render, admin, catalog, or workflow data in app-owned surfaces.
- Make workflow and render progress polling lifecycle-aware, stopping when a terminal status is reached or when the relevant view unmounts.
- Keep TanStack AI chat streaming on its existing direct SSE path; only server-owned data around the chat/generation workflow should move to Query.

**Non-Goals:**
- Do not add TanStack Form, Virtual, Pacer, DB, Table, or Start server functions.
- Do not change Worker API response shapes unless a narrowly scoped normalization is needed for a query helper.
- Do not move auth checks, tenant authorization, persistence, render execution, or workflow execution into TanStack Start server functions.
- Do not make TanStack Query cache private/generated HTML or raw large artifact content beyond data already displayed in the UI.
- Do not introduce offline persistence or cross-tab cache synchronization in this first pass.
- Do not modify Studio route code, `StudioEditor`, Studio-owned API calls, Studio file/asset/share/version/search behavior, or `@hyperframes/studio` integration in this change.

## Decisions

### Decision: Provide Query Client at the root route

Create a small Query provider component and mount it from the TanStack root route/document path so all route components can use hooks. Configure conservative defaults:

- `staleTime` short enough for dashboard-style freshness but long enough to prevent immediate duplicate refetches during navigation.
- `retry` disabled or limited for auth/permission errors and enabled only for transient network/server failures.
- `refetchOnWindowFocus` disabled for expensive endpoints by default, with per-query overrides for safe metadata.

Alternative considered: create separate Query Clients inside each page. That would preserve local isolation but lose cross-route caching and mutation invalidation, which are the main reasons to adopt Query.

### Decision: Centralize authenticated JSON request behavior

Add a shared API client helper that handles JSON parsing, typed response/error shapes, `content-type`, `accept`, and 401 redirects. Domain query functions should call this helper instead of duplicating `fetchJson` in route files.

Alternative considered: keep local fetch helpers and wrap them in `useQuery`. That would reduce some loading state but preserve the current duplication and make auth/error behavior inconsistent.

### Decision: Use domain query key factories

Define key factories by domain, for example:

```ts
queryKeys.me()
queryKeys.config()
queryKeys.projects.list()
queryKeys.projects.renders(projectId)
queryKeys.admin.users()
queryKeys.admin.organizations()
queryKeys.profile()
queryKeys.catalog()
queryKeys.workflow.run(runId)
```

Mutation hooks should invalidate, update, or remove cache entries through these factories rather than string literals spread through components.

Alternative considered: co-locate arbitrary query keys in each component. That is simpler at first but creates drift as projects, renders, workflow state, and profile/admin data start invalidating each other.

### Decision: Prioritize high-payoff surfaces first

Migration should start with read-heavy and mutation-heavy surfaces:

1. App header, `/api/me`, `/api/config`, and profile reads.
2. Projects list plus latest render metadata.
3. Admin users/organizations and profile mutations.
4. Main generation/render mutations and workflow/render status polling.
5. Playground catalog and remix mutation.

Alternative considered: convert every `fetch` call in one broad pass. That raises review risk and makes it harder to isolate behavior regressions.

### Decision: Preserve Studio as an untouched upstream integration

Do not migrate Studio route/editor reads or mutations to Query in this change, even where local fetch helpers remain. Studio is treated as an upstream-owned integration surface. Any future Studio Query work should be proposed separately with an explicit compatibility plan for applying upstream HyperFrames Studio updates.

Alternative considered: migrate Studio after app-owned pages. That would improve cache consistency inside Studio, but it risks creating local divergence in the area most likely to receive upstream HyperFrames changes.

### Decision: Use Query mutations for server-owned writes, keep local draft state local

Generation prompts, selected gallery context, tab selection, dialog state, and in-progress form fields remain React/local state. Server-owned operations in app-owned surfaces use `useMutation` and then invalidate or update Query caches.

Examples:

- Creating or updating a project invalidates project list/detail/render keys.
- Rendering a project invalidates render metadata and can seed the returned render into the relevant render query cache.
- Updating profile invalidates `profile` and `me`.
- Creating or locking an admin user invalidates admin users and, when applicable, current-user data.
- Remixing a catalog item invalidates project lists and routes to the new Studio project.

Alternative considered: put draft UI state into Query cache. Query is not the right home for transient unsaved UI state and would make editor interactions harder to reason about.

### Decision: Poll active workflow/render status through Query

Use `refetchInterval` only for active states such as queued, running, awaiting approval, or render-processing states. Disable polling when the status becomes succeeded, failed, cancelled, ready, or unavailable.

Alternative considered: use manual timers. Manual timers require custom cleanup and duplicate the state machine TanStack Query already supports.

### Decision: Keep TanStack AI streaming separate

The prompt agent uses TanStack AI's SSE stream and tool approval state. That stream should remain under `useChat`; TanStack Query should support surrounding server data such as config, active project, workflow status, generated project/renders, and any post-generation cache updates.

Alternative considered: model agent messages as Query data. Query is not designed to replace the active event stream and would fight the existing TanStack AI integration.

## Risks / Trade-offs

- Cache shows stale tenant data after auth changes -> Use short stale times for identity data, clear/remove sensitive query caches on sign-out, and treat 401 as a redirect plus cache cleanup.
- Mutation invalidates too broadly and causes extra API traffic -> Use domain key factories and targeted invalidation; broaden only when correctness requires it.
- Mutation invalidates too narrowly and leaves stale project/render/admin data -> Add tests for key workflows: create/update/delete project, render project, profile update, admin create/lock user, remix project.
- SSR/hydration mismatch from browser-only APIs -> Mount Query provider in a client-safe component and keep browser redirects inside the request helper or component effects.
- Polling increases API load -> Poll only active workflow/render states, use moderate intervals, and stop on terminal states.
- Studio diverges from upstream HyperFrames changes -> Treat Studio as out of scope and leave Studio route/editor/API behavior untouched in this change.
- Tests become noisy because Query retries or cache state leak between tests -> Use test Query Clients with retry disabled and clear caches between tests.

## Migration Plan

1. Add `@tanstack/react-query`, shared Query provider, test provider helper, API request helper, error type, and query key factories.
2. Convert identity/config/profile/admin reads and mutations first to prove auth/error/cache behavior.
3. Convert projects list/detail/renders and verify create/update/delete/render invalidation.
4. Convert main page generation/render mutations and update caches after successful project/render creation.
5. Add workflow/render status query hooks with active-only polling.
6. Convert playground catalog/remix.
7. Remove obsolete local `fetchJson` helpers from converted files.
8. Run unit/component tests and typecheck.

Studio route/editor files are not part of the migration plan.

Rollback is low risk because this change keeps Worker APIs unchanged. If a converted surface regresses, that surface can be reverted to its prior local fetch logic without server migration.

## Open Questions

- Should TanStack Query Devtools be included only in local development, or left out until the app has more query coverage?
- What initial `staleTime` should identity/config/project metadata use: very short freshness or slightly longer navigation cache reuse?
- Should project list render thumbnails be fetched as a combined endpoint later, or should Query initially preserve the current per-project render fetch pattern and optimize only after behavior is stable?
- When the HyperFrames Studio integration stabilizes upstream, should Studio get its own separate Query migration proposal?
