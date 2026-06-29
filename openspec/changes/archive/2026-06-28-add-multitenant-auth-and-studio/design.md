## Context

Motion Frames is a TanStack Start app deployed to Cloudflare Workers. It already has:

- Better Auth configured at `/api/auth` with email/password support.
- Drizzle/Neon tables for Better Auth users, sessions, accounts, and verifications.
- A React/shadcn workspace at `/` that generates HyperFrames HTML, previews with `<hyperframes-player>`, renders through a Cloudflare Container Durable Object, and stores MP4 output in R2.
- `@hyperframes/core@0.7.17`, `@hyperframes/player@0.7.17`, and `hyperframes@0.7.17` in the render container.

Firecrawl research inputs:

- `https://www.hyperframes.dev/session/697486d1-ee21-4c98-902f-6e0252edf30b` renders as a private project page when unauthenticated: "This project is private". This supports default-private project/session behavior.
- `https://www.hyperframes.dev/create` exposes a public creation structure: top navigation, numbered workflow, publish ZIP action, and starter examples.
- `https://www.hyperframes.dev/` exposes the Community Playground structure: Examples, Catalog count, Community, project cards, metadata, and Remix actions.
- `https://www.hyperframes.dev/design` exposes a frame.md funnel, but this change will not add a full frame.md generator unless it is needed by the embedded Studio path.

The login reference image shows a split layout: left-side welcome/login form, right-side large dark product/workspace preview. The implementation should use that layout structure while following `DESIGN.md`: quiet chrome, white/parchment/dark surfaces, a single blue action accent, full-pill primary actions, restrained cards, and product/workspace imagery as the visual focal point.

## Goals / Non-Goals

**Goals:**

- Require authentication before users can access the creator workspace, projects, renders, organization catalog, profile, or admin screens.
- Provide a polished login page with the copy: "Welcome to MotionFrame. Create a promo video, presentation deck, and more..."
- Support admin-created users with name, email, password, and organization assignment.
- Support organization creation and selection from the admin user creation flow.
- Support locked users who cannot sign in and whose active sessions are revoked or rejected.
- Support profile updates and password changes while keeping organization assignment immutable for non-admin users.
- Make the app multi-tenant: every user belongs to exactly one organization, and projects/renders/published items are organization scoped.
- Add persistent project/session storage that can back an embedded Studio page.
- Embed HyperFrames Studio using the published `@hyperframes/studio@0.7.17` package when implementation confirms the package API fits this app.
- Add an organization-only playground/catalog inspired by HyperFrames' public Community Playground structure.

**Non-Goals:**

- Public self-signup.
- Public community publishing outside the user's organization.
- Multi-organization membership per user in v1.
- Billing, SSO, email invitation delivery, password reset email delivery, or team-level permissions.
- Copying HyperFrames visual styling, source content, community examples, or public project data.
- Replacing the existing Worker/Container/R2 rendering architecture.

## Decisions

### Use Better Auth admin primitives for account control

Use Better Auth's admin plugin for admin account creation, role management, and locked-user enforcement, while keeping public email/password signup disabled with `emailAndPassword.disableSignUp`.

Rationale:

- The installed Better Auth package already exposes admin create-user and ban/unban style endpoints.
- Admin-created users can receive password credentials without custom password hashing.
- Better Auth's banned-user handling maps cleanly to "admin can lock users from logging in".

Alternatives considered:

- Insert users and password hashes directly into the Better Auth tables. Rejected because it would duplicate auth internals and increase security risk.
- Build a completely custom session/auth system. Rejected because Better Auth is already wired into the repo.

Implementation notes:

- Add the Better Auth admin plugin in `src/auth.ts`.
- Add Drizzle columns required by the admin plugin (`role`, `banned`, `ban_reason`, `ban_expires`) to the `users` table or its configured admin schema.
- Configure roles with at least `admin` and `user`.
- Disable public sign-up and expose only a Motion Frames login form plus admin user creation.
- Add a bootstrap mechanism for the first admin, such as an `INITIAL_ADMIN_EMAILS` env var checked in route/API authorization or a one-time seed script.

### Keep organization membership app-owned and single-tenant per user

Create app-owned tables for `organizations` and `organization_memberships` rather than relying on a general multi-organization plugin in v1. Enforce a unique `user_id` membership so each user belongs to exactly one organization.

Rationale:

- The product requirement is one assigned organization per user, not a switcher across many organizations.
- App-owned tables make tenant filtering explicit and easy to audit around projects, renders, and publishing.
- Better Auth can remain responsible for identity and sessions, while Motion Frames owns tenant domain rules.

Alternatives considered:

- Use Better Auth's organization plugin. Deferred because it supports broader organization workflows than v1 needs and can be added later if multi-org membership, invitations, or teams become product requirements.
- Add `organization_id` directly to `users`. Rejected because a membership table leaves room for organization role metadata and audit timestamps while still enforcing one membership per user.

### Route all protected access through a shared session context

Add a server/client auth context helper that loads the Better Auth session, joins the Motion Frames membership, rejects locked users, and returns `{ user, role, organization }`. Use it from TanStack route loaders and Worker API handlers.

Rationale:

- Route loaders can redirect unauthenticated users to `/login`.
- API handlers can return `401`, `403`, or tenant-filtered responses consistently.
- Existing `/api/generate`, `/api/render`, `/api/preview`, and `/r/<key>` can be preserved while gaining auth and tenant checks.

### Persist projects before expanding the editor

Introduce persisted project/session records before embedding Studio deeply:

- `projects`: organization, owner, title, prompt, current generated HTML/source, duration, status, timestamps.
- `project_versions` or `project_assets`: snapshots of generated/edited HTML and uploaded assets when needed.
- `renders`: organization, project, R2 key, source type, status, duration, created by.
- `published_projects`: organization, project, title, description, thumbnail/poster key, catalog metadata, published by, published at, unpublished at.

Rationale:

- Studio needs durable session state.
- Organization catalog/remix requires stable project IDs.
- R2 render keys can be organization-prefixed for easier audit and lifecycle management.

### Embed HyperFrames Studio as an authenticated project route

Add `@hyperframes/studio@0.7.17` and its `zustand` peer dependency, then build `/projects/$projectId/studio` around the package's editor/timeline primitives if the exported API supports direct embedding. Continue to use `@hyperframes/player` as the preview host and bridge via `resolveIframe`/player iframe access.

Rationale:

- `npm view @hyperframes/studio@0.7.17` describes a browser composition editor UI with visual timeline, code editor, and live preview.
- `@hyperframes/player` documents Studio bridging through `resolveIframe` and `useTimelinePlayer`.
- The current app already uses React 19, matching Studio's peer dependency.

Fallback:

- If `@hyperframes/studio` is not stable enough for direct app embedding, ship a Motion Frames Studio shell first: project sidebar, prompt panel, code/editor panel, player preview, render controls, and publish controls using the existing generated HTML flow and `@hyperframes/core/studio-api` helpers where useful.

### Use organization-only publishing

Publishing creates or updates a `published_projects` row with `visibility = 'organization'`. Catalog reads always filter by the current user's organization. Published pages and remix endpoints must require a valid user in the same organization.

Rationale:

- Firecrawl showed HyperFrames sessions can be private and the public site has community publish/remix patterns. Motion Frames should borrow the structure but invert visibility to organization-only.
- Organization-only sharing fits the multi-tenant requirement and prevents cross-tenant leaks.

### Design the login as a product surface, not a marketing page

Build `/login` as a full-viewport split surface:

- Left panel: product name, requested welcome copy, email/password fields, primary blue pill sign-in button, error state, and concise locked-account messaging.
- Right panel: stylized screenshot/product render of the authenticated workspace, using Motion Frames UI elements rather than copied HyperFrames imagery.
- Mobile: single-column with the preview below or hidden behind a compact product image if vertical space is tight.

Rationale:

- Matches the uploaded reference layout while staying inside `DESIGN.md`.
- Keeps the first unauthenticated impression focused on the actual product.

## Risks / Trade-offs

- [Risk] Auth plugin schema columns drift from the current migration. → Mitigation: generate Drizzle migrations after adding admin plugin schema fields and test sign-in, admin create-user, ban/lock, and password change flows against Neon locally.
- [Risk] Public signup remains reachable through Better Auth endpoints. → Mitigation: set `emailAndPassword.disableSignUp`, add tests that `/api/auth/sign-up/email` rejects public signup, and avoid rendering signup UI.
- [Risk] Tenant leaks through existing render URLs. → Mitigation: store render metadata with `organization_id`; require authenticated same-organization access for app routes; decide whether `/r/<key>` becomes private or only serves organization-owned keys through a signed/checked route.
- [Risk] Locked users keep active sessions. → Mitigation: rely on Better Auth admin lock/ban behavior to revoke sessions where supported, and enforce locked-user checks in shared session context on every protected request.
- [Risk] Studio package bundle size or styling conflicts with `DESIGN.md`. → Mitigation: isolate Studio inside authenticated project routes, lazy-load it, apply only compatible theming, and keep the Motion Frames shell/header/status controls outside the embedded editor.
- [Risk] Admin bootstrap can lock everyone out. → Mitigation: document the first-admin bootstrap flow and include an idempotent seed path that can promote a known email to admin.
- [Risk] Catalog grows slow with media thumbnails. → Mitigation: store poster/thumbnail keys separately, paginate catalog reads, and avoid loading full project HTML in card grids.

## Migration Plan

1. Add Better Auth admin plugin configuration and disable public signup.
2. Extend Drizzle schema and generate migrations for admin user fields, organizations, memberships, projects, renders, and published projects.
3. Add first-admin bootstrap support and update `.dev.vars.example`/README with auth/database/admin setup.
4. Add shared auth/session context helpers and protect application routes/API handlers.
5. Build `/login` and redirect unauthenticated users there.
6. Build admin organization/user management.
7. Build profile and password settings.
8. Persist project and render records around the existing generate/render flow.
9. Add organization playground/catalog and publish/remix flows.
10. Add Studio dependency and implement `/projects/$projectId/studio` using direct `@hyperframes/studio` embedding or the fallback Motion Frames Studio shell.

Rollback strategy:

- Keep migrations additive in the first deployment.
- Keep the existing generate/render code path intact behind authenticated access.
- If Studio embedding fails, disable the Studio route and keep the prompt-first workspace functional.
- If auth rollout fails in production, temporarily restrict with Cloudflare Access or set a maintenance page while restoring the previous deployment.

## Open Questions

- Should the first admin be bootstrapped by env var, seed script, or a one-time CLI command?
- Should `/r/<key>` remain public-but-unguessable for downloaded MP4s, or become authenticated organization-only?
- Should admins be platform-wide only in v1, or should organization admins manage users inside their own organization later?
- Should published organization catalog items preserve full project source for remix, or only clone the latest generated HTML snapshot?
- Should the embedded Studio expose raw code editing to all users, or should some organizations get prompt-only creation controls?
