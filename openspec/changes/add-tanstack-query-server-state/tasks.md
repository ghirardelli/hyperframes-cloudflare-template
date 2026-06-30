## 1. Query Runtime Foundation

- [x] 1.1 Add `@tanstack/react-query` to dependencies and refresh the lockfile.
- [x] 1.2 Create a shared Query Client provider that can be mounted from the TanStack Start root route.
- [x] 1.3 Configure conservative Query defaults for stale time, retries, focus refetching, and auth/permission error behavior.
- [x] 1.4 Add a test Query Client provider helper with retries disabled and cache isolation.
- [x] 1.5 Wrap the root app document/route tree with the Query provider and verify existing routes still render.

## 2. API Client And Query Keys

- [x] 2.1 Add a shared authenticated JSON request helper for API reads and writes.
- [x] 2.2 Normalize non-OK JSON responses into bounded client errors suitable for UI messages.
- [x] 2.3 Handle browser-side 401 responses by redirecting to `/login` and clearing or invalidating protected cache data.
- [x] 2.4 Define domain query key factories for current user, config, profile, projects, renders, admin, catalog, and workflow data.
- [x] 2.5 Add focused unit tests for request helper error handling and query key stability.

## 3. Identity, Config, Admin, And Profile Migration

- [x] 3.1 Convert app header current-user loading to a Query-backed read.
- [x] 3.2 Convert main page `/api/me` and `/api/config` reads to Query-backed reads.
- [x] 3.3 Convert profile load, profile update, and password-change flows to Query reads/mutations.
- [x] 3.4 Convert admin organizations/users reads to Query-backed reads.
- [x] 3.5 Convert admin create-user and lock/unlock actions to Query mutations that refresh admin user/organization data.
- [x] 3.6 Update affected tests to use the test Query provider and verify auth/error states still behave.

## 4. Projects And Playground Migration

- [x] 4.1 Convert projects list loading to a Query-backed read.
- [x] 4.2 Convert per-project latest render metadata loading to Query-backed reads or a shared helper preserving current behavior.
- [x] 4.3 Convert project metadata save and delete actions to Query mutations with targeted project/render invalidation.
- [x] 4.4 Convert playground catalog loading to a Query-backed read.
- [x] 4.5 Convert playground remix to a Query mutation that invalidates project list data before routing to the new Studio project.
- [x] 4.6 Remove obsolete local `fetchJson` helpers from converted project and playground files.

## 5. Main Workspace Mutations And Status Polling

- [x] 5.1 Convert manual generation to a Query mutation while preserving existing AI-enabled gating, status copy, lint feedback, and generated preview behavior.
- [x] 5.2 Convert render submission to a Query mutation that refreshes render/project cache entries after success.
- [x] 5.3 Keep TanStack AI `useChat` streaming unchanged while updating related project/render caches after approved generation or workflow tools complete.
- [x] 5.4 Add workflow-run status query hooks that poll only for queued, running, and awaiting-approval states.
- [x] 5.5 Add render/status query hooks that stop polling once ready, failed, cancelled, or unavailable states are reached.
- [x] 5.6 Add tests for polling stop conditions and cache updates after generation/render mutations.

## 6. Cleanup And Verification

- [x] 6.1 Remove duplicated page-local `fetchJson` helpers from migrated routes/components while leaving Studio route/editor helpers untouched.
- [x] 6.2 Ensure protected cache data is cleared or invalidated on sign-out.
- [x] 6.3 Verify no files under `src/components/studio/` and no Studio route/editor behavior were modified by this change.
- [x] 6.4 Run `npm run test` and fix regressions related to Query provider setup or async cache timing.
- [x] 6.5 Run `npm run typecheck` and fix type errors introduced by Query hooks and mutation result types.
- [x] 6.6 Manually smoke-check login, main workspace generation/render, projects, profile, admin, playground, and workflow status surfaces.
