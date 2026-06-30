## 1. Gallery Catalog Data

- [x] 1.1 Add `src/lib/hyperframe-gallery-catalog-schema.ts` with Zod schemas and TypeScript types for sources, preview media, launch examples, catalog components, and selected prompt context.
- [x] 1.2 Add `scripts/sync-hyperframe-gallery-catalog.mjs` with `--check`, source revision metadata, credential/path redaction, and deterministic output rendering.
- [x] 1.3 Implement launch-video source sync for `https://github.com/heygen-com/hyperframes-launch-video`, reading `meta.json`, `README.md`, `index.html`, `docs/preview.gif`, and named sub-composition metadata.
- [x] 1.4 Implement HyperFrames catalog sync from `https://hyperframes.heygen.com/llms.txt` with fallback discovery from the `code-3d-extrude` seed page, extracting titles, descriptions, tags, preview media, install commands, details, files, and usage snippets.
- [x] 1.5 Generate and commit `src/generated/hyperframe-gallery-catalog.ts`, then add `sync:hyperframe-gallery` and `check:hyperframe-gallery` package scripts.
- [x] 1.6 Add catalog validation tests covering required metadata, safe client shape, parse failure reporting, source revisions, and absence of credentials/local paths.

## 2. Bento Gallery UI

- [x] 2.1 Add gallery helper functions for tab grouping, filters, selection limits, selected item summaries, and prompt text composition.
- [x] 2.2 Replace the home route's default sticky preview column with a switchable workspace surface that defaults to an Examples/Components gallery region using fixed-ratio bento cards and independent scrolling.
- [x] 2.3 Build the Examples tab with launch-video cards showing preview media, title, duration, resolution, tags, source link, and selection controls.
- [x] 2.4 Build the Components tab with component/block cards, category filters, preview media, tags, info icon buttons, and selection controls.
- [x] 2.5 Add an accessible component detail modal with preview media, metadata, install/usage/prompt text, source link, copy-to-clipboard, copied, and copy-failure states.
- [x] 2.6 Add workspace controls for switching from generated preview back to the gallery and from the gallery back to the current preview when generated output exists.
- [x] 2.7 Verify responsive desktop and mobile layout constraints so gallery cards, tabs, preview player, modal text, and selected-context chips do not overlap or resize unpredictably.

## 3. Prompt Context Integration

- [x] 3.1 Extend main-page state to track selected gallery examples/components and show removable selected-context chips near the creation workflow.
- [x] 3.2 Extend `PromptAgentPanel` request forwarding so `/api/agent/chat` receives bounded selected gallery context with ids, names, source URLs, and prompt insertion text.
- [x] 3.3 Update prompt-agent server schemas/system prompt handling so selected gallery context is incorporated into generated prompt packages without bypassing the existing approved generation tool.
- [x] 3.4 Add Manual Prompt insertion behavior that appends selected gallery prompt text without deleting existing prompt content.
- [x] 3.5 Add tests for selected-context forwarding, selection removal, prompt snippet bounds, and manual insertion behavior.

## 4. Preserve Generation And Render Flow

- [x] 4.1 Remove the default large home-page `<hyperframes-player>` preview surface from the initial browsing state while preserving generated HTML/project state, status feedback, and `Open in Studio` handoff after generation.
- [x] 4.2 Switch the workspace surface to a generated `<hyperframes-player>` preview after approved AI Agent generation or successful Manual Prompt generation.
- [x] 4.3 Preserve selected gallery context, active gallery tab/filter state, generated preview state, project id, render URL, and render eligibility when users switch between preview and gallery.
- [x] 4.4 Ensure Render tab requests still use the existing `buildRenderRequestBody`, generated HTML/project id, selected resolution, and format whether the workspace currently shows gallery or preview.
- [x] 4.5 Update existing main-page helper tests for the new gallery tab/context and gallery/preview switching behavior while preserving AI Agent, Manual Prompt, and Render tab expectations.
- [x] 4.6 Update prompt-agent UI tests or focused component tests for gallery context display, selected item removal, generated preview switching, return-to-gallery refinement, and generated output status.

## 5. Verification

- [x] 5.1 Run `npm test`.
- [x] 5.2 Run `npm run typecheck`.
- [x] 5.3 Run `npm run build`.
- [x] 5.4 Browser-verify the main page on desktop and mobile for Examples/Components tabs, scrolling, component modal, copy behavior, selected context, AI Agent request context, Manual Prompt insertion, post-generation preview, return-to-gallery refinement, current-preview reopening, generation handoff, and Render tab output.
- [x] 5.5 Run `openspec validate add-hyperframe-gallery-picker --strict` and fix any artifact issues.
