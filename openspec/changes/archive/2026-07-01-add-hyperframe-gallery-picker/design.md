## Context

The current home route (`src/routes/index.tsx`) is a two-column workspace: a sticky left preview area renders a default or generated composition through `<hyperframes-player>`, while the right card holds the AI Agent, Manual Prompt, and Render tabs. The user wants that preview-first surface replaced by a bento gallery for choosing official launch-video examples and HyperFrames catalog components before prompting the agent.

There are two external public sources:

- `https://github.com/heygen-com/hyperframes-launch-video`: a production HyperFrames launch-video project. At the inspected commit `930f89186b8e155d632d9afe49054c02d4d7d85a`, it exposes `meta.json` (`49.77s`, `1920x1080`, `30fps`), `docs/preview.gif`, one root `index.html`, and named sub-compositions such as `glass-intro`, `flex-css`, `flex-shader`, `flex-threejs`, `engine`, `cta`, and `canvas-close`.
- `https://hyperframes.heygen.com/catalog/blocks/code-3d-extrude`: a catalog page in the public HyperFrames docs. Firecrawl research found a public `https://hyperframes.heygen.com/llms.txt` catalog index, catalog pages split into Blocks and Components, and consistent page affordances: title, description/tags, autoplay preview video, poster image, install command, details/files tables, and usage HTML snippets.

The app already has a precedent for source-synced generated data in `scripts/sync-hyperframes-skills.mjs`, `src/generated/hyperframes-skills.ts`, and `src/lib/hyperframes-skill-catalog*.ts`. The gallery should follow that shape: fetch at developer/CI time, validate into a safe generated artifact, and keep user chat/render requests off the network.

## Goals / Non-Goals

**Goals:**

- Replace the home page's default large preview player with a scrollable Examples/Components bento picker.
- Provide a generated gallery catalog with safe, bounded metadata for launch-video examples and HyperFrames catalog blocks/components.
- Let users select examples/components as prompt context for the AI Agent.
- Let users inspect components in a modal and copy exact prompt/usage text to the clipboard.
- Show the generated preview player in the gallery region after an approved/successful generation, then let users return to the gallery to continue refining with more selected context.
- Preserve the existing AI Agent, Manual Prompt, Render, generation approval, project creation, Studio handoff, and render/export behavior.
- Keep remote source data auditable by recording source URLs, revisions, generated timestamps, and content hashes.

**Non-Goals:**

- Building a full HyperFrames registry installer or running `npx hyperframes add` from the browser.
- Adding runtime scraping from the Worker or browser during chat/render requests.
- Replacing the existing HyperFrames skill catalog used by the prompt agent.
- Rendering every catalog card through `<hyperframes-player>`; cards use lightweight thumbnail/video media.
- Guaranteeing that the public launch-video repository contains multiple independent launch videos. The current source exposes one root launch video plus sub-compositions.

## Decisions

**1. Generate a gallery catalog artifact at sync time.**

Add a script such as `scripts/sync-hyperframe-gallery-catalog.mjs` with `--check`, modeled after `scripts/sync-hyperframes-skills.mjs`. It writes `src/generated/hyperframe-gallery-catalog.ts` and validates through a new `src/lib/hyperframe-gallery-catalog-schema.ts`.

The catalog shape should include:

- `version`, `generatedAt`, and `sources`;
- `examples[]`: `id`, `title`, `description`, `durationSec`, `width`, `height`, `fps`, `tags`, `sourceUrl`, `sourceRevision`, `previewMedia`, `promptText`;
- `components[]`: `id`, `name`, `kind` (`block` or `component`), `category`, `description`, `detail`, `tags`, `sourceUrl`, `installCommand`, `usageSnippet`, `durationSec`, `width`, `height`, `previewMedia`, `promptText`.

Alternative considered: fetch GitHub and catalog pages from the client. Rejected because it adds runtime latency, CORS fragility, and makes generated behavior harder to audit.

**2. Treat the launch-video repo as a source repository, not a gallery API.**

The sync script shallow-clones or fetches the configured launch-video repository, records `HEAD`, reads `meta.json` and `README.md`, extracts root composition metadata from `index.html`, and uses `docs/preview.gif` as the root preview. If no multi-example manifest exists, the root launch video becomes the official example. Named sub-compositions may be exposed as technique cards only if the UI labels them as parts of the launch video.

Alternative considered: hard-code screenshot example names. Rejected because it would not be source-backed and would drift immediately.

**3. Use the docs index plus page conventions for catalog components.**

The catalog sync starts from `https://hyperframes.heygen.com/llms.txt` when available, falling back to links discovered from the seed page. For each block/component URL, it extracts page title, description, tags, install command, details table, files table, and usage snippet. Preview media follows the documented/static page pattern when not explicit in the HTML:

`https://static.heygen.ai/hyperframes-oss/docs/images/catalog/<kind>s/<slug>.mp4`

and the matching `.png` poster. The script records fetch/parse failures in a report and excludes invalid entries from the generated artifact unless a prior pinned entry remains valid.

Alternative considered: depend on Firecrawl in the app sync path. Firecrawl was useful for research, but the repository should not require an external scraping product to run routine catalog checks.

**4. Keep media lightweight and lazy.**

Gallery cards render source-backed media as `<video muted loop playsInline preload="metadata" poster=...>` or `<img loading="lazy">`, with fixed aspect-ratio containers. Cards use CSS grid bento sizing, not player iframes. Only hovered/visible videos should load aggressively enough for smooth browsing.

Alternative considered: render each card through `<hyperframes-player>`. Rejected because dozens of runtime iframes would be expensive and unnecessary for browsing thumbnails.

**5. Move generation context, not generation authority.**

`src/routes/index.tsx` owns selected gallery state and passes a bounded `galleryContext` into `PromptAgentPanel`. The SSE request body for `/api/agent/chat` includes selected example/component ids, titles, source URLs, and prompt text snippets. The Worker system prompt tells the agent to incorporate selected context where relevant, but project mutation still goes through the existing approved `generate_hyperframe` tool.

Manual Prompt mode gets an explicit insert action that appends selected gallery prompt text to the existing textarea rather than overwriting user text.

Alternative considered: let component cards directly mutate the generation prompt. Rejected because selection should stay inspectable and reversible before text is inserted or sent.

**6. Replace the default preview surface, but preserve output handoff.**

The large sticky preview player is removed from the default browsing state. The left workspace area becomes a switchable surface:

- `gallery`: shows Examples/Components bento browsing and selected-context controls;
- `preview`: shows a `<hyperframes-player>` for the current generated HTML/project in the same space the gallery occupied.

Successful generation from either approved AI Agent output or Manual Prompt switches the workspace surface to `preview`. The preview header includes a clear `Back to gallery` or `Browse examples and components` action, plus the existing generated-project affordances such as `Open in Studio` when a project id exists. Returning to `gallery` preserves the generated output, selected gallery context, prompt text, and render eligibility. Adding more gallery items after returning updates prompt context for the next agent/manual iteration without discarding the current preview.

The Render tab continues to render the current generated project/HTML or bundled default composition through the existing Worker/Container/R2 pipeline, regardless of whether the workspace surface is currently showing gallery or preview.

Alternative considered: keep a smaller persistent preview next to the gallery. Rejected because it weakens the browsing-first surface and costs space. Alternative considered: show preview only in Studio. Rejected because users need immediate feedback after approving generation before deciding whether to refine with more components.

**7. Use a modal for details and clipboard copy.**

Component cards include an icon-only info button using the existing lucide `Info` icon. The modal shows preview media, metadata, usage/prompt text, source link, and a copy button. Clipboard writes use `navigator.clipboard.writeText`; failure leaves the text visible and reports a recoverable status. The modal should be implemented with existing local component conventions, or a small accessible dialog component if no dialog primitive exists.

Alternative considered: expand cards inline. Rejected because the gallery needs to stay dense and scrollable.

## Risks / Trade-offs

- **Public source shape changes** -> Keep sync validation strict, record source revisions, and make parse failures visible in `--check` output.
- **The launch-video repo currently has one root example** -> Label the root video clearly and treat sub-compositions as source-video sections/techniques, not fake independent launch videos.
- **Large media grids can hurt performance** -> Lazy-load media, use posters, fixed card dimensions, and avoid `<hyperframes-player>` in cards.
- **Users can lose their place when preview replaces the gallery** -> Keep gallery selections and active tab/filter state in memory and provide an obvious return action from preview to gallery.
- **Agent prompts can become noisy** -> Limit selected items, cap prompt snippets per item, and summarize selected context before forwarding.
- **Clipboard API can fail** -> Keep modal text visible and provide an error state so users can still select/copy manually.
- **Remote static media can disappear or change** -> Store source URLs and generated revisions; optionally add a later media-cache step if production reliability requires it.

## Migration Plan

1. Add gallery catalog schemas and generated artifact scaffolding.
2. Add the sync/check script for launch-video and catalog sources, then commit the generated catalog.
3. Add gallery helper functions for grouping, filtering, selection limits, and prompt text composition.
4. Replace the home route's sticky preview column with the Examples/Components bento gallery, selected-context state, and gallery/preview workspace switching.
5. Forward selected gallery context through `PromptAgentPanel` to `/api/agent/chat` and update prompt-agent tests/system prompt behavior.
6. Add the component detail modal with copy-to-clipboard behavior.
7. Preserve and verify Manual Prompt insertion, post-generation preview, return-to-gallery refinement, Studio handoff, Render tab rendering, and downloads.
8. Run `npm test`, `npm run typecheck`, `npm run build`, and browser checks for desktop/mobile layout, modal copy, agent context, manual insertion, preview switching, and render flow.

Rollback is straightforward: keep the generated catalog unused and restore the previous preview column in `src/routes/index.tsx`; backend render/generation paths remain unchanged.

## Open Questions

- Should the Components tab label include both public catalog "Blocks" and "Components" as filters, or should blocks be renamed as components in the app UI?
- Should launch-video sub-compositions appear in the Examples tab, or only inside the root launch-video detail surface?
- Should remote media be hotlinked initially, or should a follow-up cache selected thumbnails/videos into Cloudflare assets/R2?
