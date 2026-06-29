## 1. Dependencies And Schema

- [x] 1.1 Add `@hyperframes/studio@0.7.17` and `zustand` dependencies and verify the app still builds.
- [x] 1.2 Add Better Auth admin plugin configuration in `src/auth.ts` with public email/password signup disabled.
- [x] 1.3 Extend `src/db/schema.ts` with Better Auth admin user fields for role and locked/banned state.
- [x] 1.4 Add `organizations` and `organization_memberships` tables with a unique membership per user.
- [x] 1.5 Add `projects`, `project_versions` or equivalent source snapshots, `renders`, and `published_projects` tables.
- [x] 1.6 Generate and review Drizzle migrations for all schema changes.
- [x] 1.7 Add local and production environment documentation for first-admin bootstrap configuration.

## 2. Auth Context And Route Protection

- [x] 2.1 Implement a shared server auth context helper that loads the Better Auth session, user role, lock state, membership, and organization.
- [x] 2.2 Implement authorization helpers for authenticated user, admin user, same-organization project, and same-organization published project checks.
- [x] 2.3 Protect TanStack Start application routes so unauthenticated users route to `/login`.
- [x] 2.4 Protect Worker APIs for generate, preview, render, project, publish, profile, and admin operations.
- [x] 2.5 Add tests that unauthenticated protected API calls return authentication errors.
- [x] 2.6 Add tests that locked users cannot access protected APIs even with an existing session.

## 3. Login Experience

- [x] 3.1 Build `/login` as a split layout with the requested welcome copy, email/password fields, and primary sign-in action.
- [x] 3.2 Create a stylized Motion Frames workspace preview image or component for the login page right panel.
- [x] 3.3 Apply `DESIGN.md` visual rules to the login page: quiet surfaces, single blue action accent, pill primary button, restrained chrome, and responsive layout.
- [x] 3.4 Implement login form loading, success, invalid credential, and locked-account states.
- [x] 3.5 Add a test that public signup is disabled and does not create a user.
- [x] 3.6 Verify the login page on desktop and mobile for no overlapping text or controls.

## 4. Admin Organization And User Management

- [x] 4.1 Implement first-admin bootstrap behavior and document how to use it safely.
- [x] 4.2 Build admin-only routes for listing organizations and users.
- [x] 4.3 Build an admin create-user form with name, email, password, role, and organization selection.
- [x] 4.4 Support creating a new organization inline from the create-user flow.
- [x] 4.5 Implement admin APIs that create users through Better Auth admin APIs and then create the Motion Frames membership in one transaction-like flow.
- [x] 4.6 Implement admin lock and unlock actions using Better Auth admin locked/banned state.
- [x] 4.7 Add tests for admin user creation with existing organization and new organization.
- [x] 4.8 Add tests proving non-admin users cannot access admin routes or APIs.

## 5. Profile Management

- [x] 5.1 Build authenticated profile/settings route showing user details and read-only organization assignment.
- [x] 5.2 Implement profile update API for editable user fields.
- [x] 5.3 Implement password change flow using Better Auth password APIs.
- [x] 5.4 Reject or ignore organization, role, and lock-state mutations from non-admin profile requests.
- [x] 5.5 Add tests for profile update, password change failure, and blocked organization reassignment.

## 6. Tenant Projects And Renders

- [x] 6.1 Replace ad hoc generated composition state with persisted project records when users generate from the workspace.
- [x] 6.2 Persist generated HTML/source snapshots and generation metadata against the active project.
- [x] 6.3 Persist render metadata with organization ID, project ID, user ID, R2 key, source type, duration, and timestamps.
- [x] 6.4 Prefix or otherwise tag R2 render objects so organization ownership is auditable.
- [x] 6.5 Update `/api/render` to require project context for authenticated renders and to store render metadata.
- [x] 6.6 Add project list/detail APIs that always filter by the current organization.
- [x] 6.7 Add tests proving cross-organization project and render access is denied.

## 7. Embedded Studio Workspace

- [x] 7.1 Inspect `@hyperframes/studio` exports in the installed dependency and identify the direct embed API for React 19.
- [x] 7.2 Build `/projects/$projectId/studio` as an authenticated, organization-scoped route.
- [x] 7.3 Defer direct Studio editor/timeline bridge after package inspection; fallback shell previews edits with `<hyperframes-player>`.
- [x] 7.4 Persist Studio edits to the active project before render or publish actions are enabled.
- [x] 7.5 Wire Studio render action to the existing Worker, Container Durable Object, and R2 render pipeline.
- [x] 7.6 Wire Studio publish action to organization-only publishing.
- [x] 7.7 If direct Studio embedding is blocked, build the fallback Motion Frames Studio shell with prompt, code/source, preview, render, and publish panels.
- [x] 7.8 Add tests or browser checks for Studio route authorization, save, render, and publish behavior.

## 8. Organization Publishing And Catalog

- [x] 8.1 Implement publish and unpublish APIs for organization-owned projects.
- [x] 8.2 Store publish metadata including title, description, poster or thumbnail, duration, resolution, publisher, and publish timestamp.
- [x] 8.3 Build an organization playground page with Examples, Catalog count, organization-visible cards, and open/remix actions.
- [x] 8.4 Ensure the playground loads only seeded examples and published projects visible to the user's organization.
- [x] 8.5 Implement remix so organization-visible published projects clone into a new project in the same organization.
- [x] 8.6 Add tests proving cross-organization publish, catalog, and remix access is denied.

## 9. Documentation And Verification

- [x] 9.1 Update README and `.dev.vars.example` with auth, database, admin bootstrap, and tenant setup instructions.
- [x] 9.2 Add or update unit/API tests covering auth gate, admin, profile, tenant projects, Studio authorization, and organization publishing.
- [x] 9.3 Run `npm test`, `npm run typecheck`, `npm run build`, `npm audit --json`, and `npm run deploy:dry-run`.
- [x] 9.4 Use browser verification for login, workspace, admin, profile, Studio, and playground on desktop and mobile.
- [x] 9.5 Confirm browser network requests never expose OpenRouter secrets and never return cross-organization data.
