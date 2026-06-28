## Why

Motion Frames is currently reachable as a public creator workspace, but the intended product is an invite-only, multi-tenant creation tool where each organization owns its users, projects, and published examples. The app now has the foundations for Cloudflare hosting, Better Auth, Neon/Drizzle, and HyperFrames rendering, so the next step is to gate access and turn the workspace into an organization-scoped product surface.

## What Changes

- Add an unauthenticated login page that blocks access to the application and uses the provided split-layout reference: welcome copy on the left, email/password fields, and a stylized screenshot of the Motion Frames workspace on the right.
- Add admin-only user management for creating invited users with name, email, password, and organization assignment.
- Allow admins to create a new organization during user creation or select an existing organization.
- Allow admins to lock and unlock users so locked users cannot sign in.
- Add user profile settings where users can update their name/email-facing profile information and change their password, while organization assignment remains admin-controlled.
- Add tenant-aware authorization so every user belongs to one organization and application data is scoped to that organization.
- Add persistent projects, renders, and organization-only publishing so users can publish creations to their organization instead of a public community.
- Add an organization playground/catalog inspired by HyperFrames' public Community Playground structure: example cards, catalog count, remix/open actions, and organization visibility only.
- Plan an embedded Studio workspace that preserves the existing generate/preview/render pipeline while adding project sessions, editing surfaces, and publish controls.

## Capabilities

### New Capabilities

- `auth-gate`: Login, session gating, locked-user enforcement, and authenticated route access.
- `tenant-admin`: Organization and user administration, admin invitations, organization assignment, and account locking.
- `profile-management`: Self-service profile updates and password changes with immutable organization assignment for non-admin users.
- `tenant-projects`: Organization-scoped projects, renders, ownership, persistence, and access checks.
- `studio-workspace`: Embedded creation workspace that combines prompt generation, Studio/editor affordances, preview, render, and session state.
- `organization-publishing`: Organization-only publish/remix/catalog experience modeled structurally after HyperFrames community publishing without public sharing.

### Modified Capabilities

- None. There are no existing OpenSpec capability specs in this repo.

## Impact

- Affected app surfaces: TanStack Start routes, root route gating, login page, admin screens, profile/settings screens, creator workspace, project/session pages, and organization playground/catalog pages.
- Affected APIs: Better Auth endpoints, new admin/user/profile/project/publish APIs, and authorization wrappers around `/api/generate`, `/api/render`, `/api/preview`, and `/r/<key>`.
- Affected data model: Drizzle schema and Neon migrations for organizations, membership/user metadata, locked-user state, projects, renders, published projects, and audit timestamps.
- Affected Cloudflare systems: Workers, R2 render storage, Container Durable Object rendering, and production secrets for auth/database configuration.
- Affected design system: `DESIGN.md` remains the source of truth; the login and workspace should use quiet Apple-like chrome, single blue action accent, pill-shaped primary actions, restrained surfaces, and product/workspace imagery rather than copying HyperFrames visual styling.
