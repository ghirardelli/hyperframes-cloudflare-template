## Why

The app currently manages server state with repeated page-local `fetch`/`fetchJson` helpers, manual loading and error flags, and hand-wired refresh-after-mutation logic across app-owned workspace, projects, admin, profile, and playground surfaces. TanStack Query is the next best TanStack addition because it gives the app one shared cache, mutation lifecycle, invalidation model, and polling strategy for data that already comes from authenticated Worker APIs.

## What Changes

- Add `@tanstack/react-query` and provide a shared Query Client at the TanStack Start root.
- Introduce typed API/query helpers for authenticated JSON requests, redirect-on-401 behavior, query keys, mutations, and targeted invalidation.
- Convert high-value client server-state surfaces from local effects and ad hoc fetch helpers to TanStack Query:
  - current user/profile/config reads,
  - projects and latest renders,
  - admin organizations/users and user lock/create mutations,
  - profile update/password mutations,
  - playground catalog/remix mutations,
  - generation/render mutations on the main page where they update server-owned project/render state.
- Add polling for workflow-run and render status only while runs/renders are active, stopping automatically once terminal state is reached.
- Preserve existing Worker API behavior, auth/tenant authorization, Drizzle persistence, Cloudflare Container/R2/Bunny render paths, and TanStack AI streaming behavior.
- Preserve Studio integration exactly as-is in this change. Do not modify Studio route loading, `StudioEditor`, Studio file tree/assets/share/version/search behavior, or `@hyperframes/studio` integration so upstream HyperFrames Studio changes remain easier to apply.
- Do not add TanStack Form, Virtual, Pacer, DB, or Start server functions in this change.

## Capabilities

### New Capabilities
- `client-server-state`: Defines how the React client fetches, caches, mutates, invalidates, and polls authenticated server-owned application data through TanStack Query.

### Modified Capabilities
- None. Existing feature contracts remain the same; this change standardizes the client-side server-state implementation.

## Impact

- Dependencies: add `@tanstack/react-query`; optionally add TanStack Query Devtools only for local development if the implementation chooses to expose cache inspection.
- App shell: root route/router wiring gains a Query Client provider compatible with TanStack Start rendering.
- Client API layer: add shared JSON request helpers and query key factories.
- Affected UI surfaces: app header, main workspace, projects page, admin page, profile page, playground page, and workflow/render status displays.
- Excluded UI surfaces: Studio route/editor and Studio-owned server-state flows remain unchanged.
- Tests: update affected React component tests to run under a Query Client provider and add focused tests for query invalidation and polling stop conditions.
