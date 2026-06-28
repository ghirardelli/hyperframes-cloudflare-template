# HyperFrames on Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/heygen-com/hyperframes-cloudflare-template)

![Template preview — Cloudflare + HyperFrames](./docs/preview.png)

**Live demo:** [hyperframes-on-cloudflare.jdrusso1020.workers.dev](https://hyperframes-on-cloudflare.jdrusso1020.workers.dev)

<!-- dash-content-start -->

A [HyperFrames](https://github.com/heygen-com/hyperframes) template that previews HTML video compositions in the browser and renders MP4s server-side using a [Cloudflare Container](https://developers.cloudflare.com/containers/) (Chromium + FFmpeg) and stores them in [R2](https://developers.cloudflare.com/r2/).

Demonstrates Worker-to-Container fetching via Durable Object bindings, streaming response bodies through the Worker into R2, and bundling sub-compositions into a single self-contained preview HTML at build time.

<!-- dash-content-end -->

Deploying provisions a Worker, the `RenderContainer` Durable Object, and an R2 bucket (`hyperframes-renders`). Cloudflare Containers requires a [Workers Paid](https://developers.cloudflare.com/workers/platform/pricing/) plan.

## What this template does

- **Preview** a bundled composition (`cloudflare-intro`) in the browser using `<hyperframes-player>`, the zero-dependency web component from `@hyperframes/player`.
- **Render** the composition to an MP4 by POSTing to `/api/render`. The Worker streams the composition to a Cloudflare Container running a pre-built image with Chromium + FFmpeg + HyperFrames, streams the rendered MP4 directly into R2, and returns a URL.
- **Generate from a prompt** — type a text prompt; the Worker uses a server-side OpenRouter secret (Gemini 3 Flash by default) to synthesize a HyperFrames composition, lints it with `@hyperframes/core/lint`, self-heals up to 2× if needed, and previews the result in the player. Click "Render MP4" to capture it. See [AI generation](#ai-generation).

**Authoring happens locally.** This template ships with one pre-authored composition. To build your own, use the HyperFrames CLI on your machine:

```bash
npx hyperframes init my-video
cd my-video
npx hyperframes preview   # live-reload editor in your browser
```

Then swap it into this template (see [Swapping the composition](#swapping-the-composition) below).

## Architecture

```
 Browser                       Worker                            Container DO (instance_type: standard-4)
┌──────────────────┐          ┌────────────────────────┐        ┌──────────────────────────────────┐
│ <hyperframes-    │  ─────▶  │ /api/render            │  ────▶ │ Node HTTP server (port 8080)     │
│  player>         │          │  - load files from     │        │  - writes files to /tmp/         │
│ preview iframe   │          │    ASSETS              │        │  - hyperframes render            │
│                  │          │  - POST → container    │        │    (Chromium + ffmpeg)           │
│                  │  ◀────   │  - stream → R2 bucket  │  ◀──── │  - streams mp4 in response       │
│                  │   url    │  - return /r/<key>     │   mp4  │                                  │
└──────────────────┘          └────────────────────────┘        └──────────────────────────────────┘
                                       │
                                       ├─▶ R2 (hyperframes-renders)
                                       │
                                       └─▶ ASSETS (preview HTML, composition files)
```

### The container image

Cold-start of a render container is faster than installing dependencies on every request because the renderer is **baked into the image** at build time, not installed at runtime:

1. `node:22-bookworm-slim` base
2. `apt-get install` Chromium system libs (`libnss3`, `libxcomposite1`, `pango`, …)
3. `npm install hyperframes ffmpeg-static`
4. Symlink `ffmpeg-static/ffmpeg` to `/usr/local/bin/ffmpeg`
5. `npx hyperframes browser ensure` to download `chrome-headless-shell`
6. Copy `container/server.mjs` (a small Node HTTP server) and `CMD ["node", "server.mjs"]`

At render time, the Worker sends composition files in the request body, the container writes them to a tmp dir, runs `hyperframes render`, and streams the MP4 back. Container instances sleep after 10 minutes of inactivity (`sleepAfter` on the Container class).

### Why Cloudflare Containers (and not Browser Rendering)

Cloudflare's [Browser Rendering](https://developers.cloudflare.com/browser-rendering/) is a hosted Chromium API — great for screenshots and PDFs, but you can't install FFmpeg into it. HyperFrames needs full control of the Chromium process plus an FFmpeg binary on the same filesystem, which is exactly what [Cloudflare Containers](https://developers.cloudflare.com/containers/) gives you: an OCI container in a Worker-bound Durable Object, with up to 4 vCPUs and 12 GiB of RAM on `standard-4`.

With 4 vCPUs, `hyperframes render --workers auto` launches 3 parallel Chrome workers, cutting the render time roughly 2× vs. the single-worker default.

## Local development

```bash
npm install
npm run dev
```

`wrangler dev` runs the Worker locally and builds + runs the container against your local Docker daemon (Docker is required for local container dev). The browser preview works without Docker; only `/api/render` needs the container.

### Testing the render container in isolation

If you want to iterate on the `Dockerfile` or `container/server.mjs` without booting Wrangler, you can hit the container directly:

```bash
docker build -t hf-render .
docker run -d --rm --name hf-test -p 18080:8080 hf-render
node scripts/test-render.mjs 18080 /tmp/out.mp4
docker stop hf-test
```

The script reads `src/composition-manifest.json`, base64-encodes the composition files, POSTs them to the container, and writes the MP4 it returns. The bundled 9s composition renders in ~17s on a 6-vCPU host.

## Project structure

```
src/
  index.ts                    # Worker entry — preview + /api/render + /r/<key>
  container.ts                # RenderContainer Durable Object
  composition-manifest.json   # Generated by scripts/build.mjs
container/
  server.mjs                  # Node HTTP server inside the container
  package.json                # Container deps (hyperframes + ffmpeg-static)
public/
  index.html                  # Prompt-first creator workspace + preview/render controls
  compositions/
    cloudflare-intro/         # The bundled example composition
      index.html
      assets/                 # Cloud SVG + HF icon used by the intro
scripts/
  build.mjs                   # Run via wrangler.jsonc → build.command
  bundle-preview.ts           # Bundles composition into single HTML via @hyperframes/core
  test-render.mjs             # Local container E2E
Dockerfile                    # Render container image
wrangler.jsonc                # Worker + Container + R2 bindings
```

## Swapping the composition

1. Drop your composition bundle into `public/compositions/<your-name>/`.
2. Set `PREVIEW_COMPOSITION_DIR` env var when running build/deploy:
   ```bash
   PREVIEW_COMPOSITION_DIR=compositions/<your-name> npm run deploy
   ```
   Or edit the default in `scripts/build.mjs` (line 16).
3. Optionally update the player dimensions in `public/index.html` if your composition isn't 1920×1080.
4. Re-run `npm run dev` or `npm run deploy` — `scripts/build.mjs` regenerates the manifest and bundle.

## AI generation

The creator workspace lets a viewer type a description and synthesize a HyperFrames composition end-to-end. The composition previews in the player; the Render button then captures it to MP4 just like the bundled one.

### Enabling it

It's already on for self-deployers — `wrangler.jsonc` sets `ENABLE_AI_GEN: "true"` in `vars`. Set it to `"false"` if you're hosting a public demo and don't want visitors triggering generation or renders on your account.

### OpenRouter secret setup

For production, store the OpenRouter key as a Cloudflare secret:

```bash
wrangler secret put OPENROUTER_API_KEY
```

For local development, copy `.dev.vars.example` to `.dev.vars` and fill in:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

Optionally set `OPENROUTER_MODEL` to use a different OpenRouter model. If omitted, the Worker uses `google/gemini-3-flash-preview`.

The browser never receives or submits the OpenRouter key. The Worker reads `OPENROUTER_API_KEY`, forwards it once to `https://openrouter.ai/api/v1/chat/completions` as `Authorization: Bearer <key>`, and does not log, cache, or persist it.

### Pipeline

```
prompt
   │
   ▼
POST /api/generate                      (Worker)
   │
   ├─▶ build skill prompt (src/lib/hyperframes-skill.ts)
   ├─▶ fetch openrouter.ai using OPENROUTER_API_KEY
   ├─▶ lintHyperframeHtml(html)         (@hyperframes/core/lint)
   ├─▶ if lint fails, retry up to 2× with feedback
   └─▶ return { html, model, attempts, lintOk, lintErrors }

frontend
   │
   └─▶ player.setAttribute("srcdoc", html)   (no Blob URL needed)

POST /api/render { html }              (existing endpoint, now accepts inline HTML)
   │
   └─▶ container → MP4 → R2 → /r/<key>
```

The default model is `google/gemini-3-flash-preview` — cheapest and fastest direct generation per ~80 eval runs in [llm-stories-hyperframes](https://github.com/jrusso1020/llm-stories-hyperframes), which the prompt is adapted from. Set `OPENROUTER_MODEL` server-side to swap in any [OpenRouter model](https://openrouter.ai/models).

## Pricing

[Cloudflare Containers pricing](https://developers.cloudflare.com/containers/pricing/) — pay-per-10ms for memory, CPU, and disk. A 70-second render on `standard-4` (4 vCPU, 12 GiB) costs ~$0.008. R2 storage is $0.015/GB-month with no egress fees within Cloudflare's network.

## License

[Apache-2.0](./LICENSE) — same license as HyperFrames itself.

## Links

- [HyperFrames repo](https://github.com/heygen-com/hyperframes)
- [HyperFrames docs](https://hyperframes.heygen.com)
- [Cloudflare Containers docs](https://developers.cloudflare.com/containers/)
- [Cloudflare R2 docs](https://developers.cloudflare.com/r2/)
