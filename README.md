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
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require"
BETTER_AUTH_SECRET="replace-with-a-long-random-secret"
BETTER_AUTH_URL="http://localhost:5173"
```

For production, store secrets with Cloudflare:

```bash
wrangler secret put OPENROUTER_API_KEY
wrangler secret put DATABASE_URL
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
```

`OPENROUTER_MODEL` can stay in `wrangler.jsonc` vars if you want a non-default
model.

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
  routes/                    # TanStack Start routes
  server.ts                  # Cloudflare Worker entrypoint
  worker/render-api.ts       # /api/render, /api/generate, /api/config, /r/*
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
  -> /api/preview reads bundled HTML from ASSETS
  -> /api/generate calls OpenRouter with the server-side key
  -> /api/render sends bundled or generated HTML to RenderContainer
  -> RenderContainer streams MP4 bytes back
  -> Worker writes the MP4 to R2 and returns /r/<key>
```

## References

- [Cloudflare TanStack Start guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Cloudflare Hyperdrive docs](https://developers.cloudflare.com/hyperdrive/)
- [Neon serverless driver docs](https://neon.com/docs/serverless/serverless-driver)
- [Better Auth Drizzle adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [shadcn TanStack installation](https://ui.shadcn.com/docs/installation/tanstack)
