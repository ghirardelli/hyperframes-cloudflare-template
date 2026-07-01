# Motion Frames

Motion Frames is a TanStack Start app for generating, previewing, and rendering
HyperFrames video compositions on Cloudflare Workers.

The app keeps the Cloudflare rendering pipeline: compositions preview in the
browser with `<hyperframes-player>`, `/api/render` sends composition files to a
Cloudflare Container Durable Object, and rendered MP4s stream into R2.

## Stack

- TanStack Start on Cloudflare Workers with `@cloudflare/vite-plugin`
- Cloudflare Containers for Chromium + FFmpeg rendering
- Cloudflare R2 for rendered MP4s
- Neon Postgres with the Neon HTTP driver
- Drizzle ORM and Drizzle Kit migrations
- Better Auth with the Drizzle adapter
- Tailwind CSS v4 and shadcn UI `4.11.0`

## Local Development

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

`npm run dev` runs `scripts/build.mjs` first, then starts Vite. The preview works
without Docker. Rendering through `/api/render` still needs local container
support from Cloudflare and Docker.

Fill these values in `.dev.vars`:

```bash
OPENROUTER_API_KEY="sk-or-v1-..."
# OPENROUTER_MODEL="google/gemini-3-flash-preview"
# Optional prompt-agent voice transcription:
# OPENAI_API_KEY="sk-..."
# OPENAI_TRANSCRIPTION_MODEL="whisper-1"
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require"
BETTER_AUTH_SECRET="replace-with-a-long-random-secret"
BETTER_AUTH_URL="http://localhost:5173"
# BETTER_AUTH_API_KEY=""
# BETTER_AUTH_TRUSTED_ORIGINS="https://app.example.com"
INITIAL_ADMIN_EMAILS="admin@example.com"
```

For production, store secrets with Cloudflare:

```bash
wrangler secret put OPENROUTER_API_KEY
# Optional, enables prompt-agent microphone transcription:
wrangler secret put OPENAI_API_KEY
wrangler secret put DATABASE_URL
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
# Only needed if Better Auth Dash gives your project an API key:
wrangler secret put BETTER_AUTH_API_KEY
```

`OPENROUTER_MODEL` and `OPENAI_TRANSCRIPTION_MODEL` can stay in `wrangler.jsonc`
vars if you want non-default models.

### HyperFrames Skill Catalog

The prompt agent uses a generated, read-only HyperFrames skill catalog from the
private fork at `https://github.com/aaronpie/hyperframes.git`. Runtime chat
requests never fetch GitHub; sync the catalog explicitly:

```bash
npm run sync:hyperframes-skills
npm run check:hyperframes-skills
```

Local sync can use existing Git credentials, an SSH agent, or GitHub CLI auth.
CI can provide a read-only token with `HYPERFRAMES_SKILLS_GITHUB_TOKEN`; `GH_TOKEN`
or `GITHUB_TOKEN` are accepted as fallbacks. Override the repo, source URL, ref,
or output path with `HYPERFRAMES_SKILLS_REPO_URL`,
`HYPERFRAMES_SKILLS_SOURCE_URL`, `HYPERFRAMES_SKILLS_REF`, and
`HYPERFRAMES_SKILLS_OUTPUT`. The generated artifact records only sanitized source
metadata, skill markdown, reference indexes, and hashes.

Better Auth is mounted at `/api/auth`, so for a Worker deployed at
`https://hyperframes-cloudflare-template.aaron-3f2.workers.dev`, set
`BETTER_AUTH_URL` to that origin only. The Dash ownership verifier should check
the app at that base URL; the plugin provides its infra endpoints beneath the
Better Auth base path. The hosted Better Auth Dash origin is trusted by the app
automatically for ownership verification.

## Authentication And Tenancy

Motion Frames is invite-only. Public email/password signup is disabled, and all
creator, render, project, profile, admin, and catalog APIs require a Better Auth
session. Each user belongs to one organization through
`organization_memberships`; project, render, and published catalog data is always
filtered by that organization.

First admin bootstrap uses `INITIAL_ADMIN_EMAILS`, a comma-separated env var.
Create or seed a matching Better Auth user, sign in as that user, then open
`/admin` to create organizations and invited users. Bootstrap users without a
real organization can only administer setup; workspace generation/rendering
requires assigning the admin user to a real organization. Remove
`INITIAL_ADMIN_EMAILS` after a permanent admin membership exists.

Admins can create users with a name, email, password, role, and organization,
including creating a new organization inline. They can also lock or unlock
accounts. Regular users can update their profile name and change their password,
but cannot change organization, role, or lock state.

## Studio And Catalog

`/projects/<id>/studio` is an authenticated, organization-scoped Motion Frames
Studio shell. It persists project HTML edits, previews with
`<hyperframes-player>`, renders through the existing Worker/Container/R2
pipeline, and publishes to the organization catalog. `@hyperframes/studio` is
installed for the latest package surface, but v1 uses the fallback shell because
the package currently exposes lower-level editor/player primitives rather than a
single drop-in hosted Studio app.

`/playground` shows seeded examples plus organization-published projects with
open and remix actions. Published/remixed data never crosses organization
boundaries.

## Database

The connected Neon account already contains the `Motion Frames` project. This repo
does not commit its connection string.

Generate and apply migrations with:

```bash
npm run db:generate
DATABASE_URL="..." npm run db:migrate
```

The initial migration creates Better Auth tables:

- `users`
- `sessions`
- `accounts`
- `verifications`

The multi-tenant migration adds admin user fields plus:

- `organizations`
- `organization_memberships`
- `projects`
- `project_versions`
- `renders`
- `published_projects`

## Hyperdrive

Cloudflare Hyperdrive requires a Cloudflare-side binding ID. After creating a
Hyperdrive config pointed at the Neon database, add the binding shown in
`wrangler.jsonc`.

The current Drizzle runtime uses Neon HTTP because it is fetch-native on Workers.
If you switch auth or app queries to Hyperdrive, use a TCP-capable Postgres driver
with `env.HYPERDRIVE.connectionString`.

## Commands

```bash
npm run dev             # TanStack Start dev server on Cloudflare's Vite plugin
npm run build           # bundle preview assets and build client/server output
npm run deploy          # build, then wrangler deploy
npm run test            # Vitest unit tests
npm run test:secret-ui  # static check for old client-side secret handling
npm run typecheck       # Wrangler typegen, then TypeScript
npm run cf-typegen      # generate Cloudflare binding types
```

Cloudflare's deploy command should be `npm run deploy`. A plain
`wrangler deploy` points Wrangler at the source Worker entry and bypasses the
TanStack/Vite virtual modules generated into `dist/server`.

## Project Layout

```txt
src/
  auth.ts                    # Better Auth factory
  db/                        # Drizzle schema and Neon HTTP client
  lib/auth-context.ts         # Shared session, role, lock, and tenant checks
  routes/                    # TanStack Start routes
  server.ts                  # Cloudflare Worker entrypoint
  worker/render-api.ts       # auth, project, publish, render, generate APIs
  container.ts               # RenderContainer Durable Object
public/
  compositions/              # bundled HyperFrames composition assets
scripts/
  build.mjs                  # composition manifest + bundled preview + player copy
drizzle/
  0000_real_amazoness.sql    # initial auth schema migration
```

## Rendering Flow

```txt
TanStack app
  -> login gate via Better Auth session
  -> /api/preview reads bundled HTML from ASSETS
  -> /api/generate calls OpenRouter with the server-side key and stores a project
  -> /projects/<id>/studio edits, previews, renders, and publishes the project
  -> /api/render sends project or generated HTML to RenderContainer
  -> RenderContainer streams MP4 bytes back
  -> Worker writes organization-prefixed MP4s to R2 and returns /r/<key>
```

## References

- [Cloudflare TanStack Start guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Cloudflare Hyperdrive docs](https://developers.cloudflare.com/hyperdrive/)
- [Neon serverless driver docs](https://neon.com/docs/serverless/serverless-driver)
- [Better Auth Drizzle adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [shadcn TanStack installation](https://ui.shadcn.com/docs/installation/tanstack)
