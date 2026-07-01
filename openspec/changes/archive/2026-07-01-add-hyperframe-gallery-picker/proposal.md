## Why

The main page currently spends its first-column real estate on a single preview player, but users need inspiration and exact component vocabulary before they ask the AI agent to make a HyperFrame video. Replacing the static preview area with a bento-style picker of official launch-video examples and catalog components makes the workspace feel more like a guided creation surface than a blank prompt box.

## What Changes

- Replace the main-page preview-first layout with a scrollable bento gallery grouped by two primary tabs: `Examples` for launch videos and `Components` for HyperFrames catalog blocks.
- Source the Examples tab from the public `heygen-com/hyperframes-launch-video` project and preserve useful metadata such as title, duration, resolution, thumbnail/video preview, source URL, and remix/use-in-prompt text.
- Source the Components tab from the HyperFrames catalog pages starting at `https://hyperframes.heygen.com/catalog/blocks/code-3d-extrude`, including left-menu-discovered component pages and each page's thumbnail/example video when available.
- Let users select example and component cards, then ask the AI agent to use those selections in the generated HyperFrame video prompt.
- After a user applies/approves a prompt and generation succeeds, show the generated preview player in the same workspace area where the bento gallery was shown.
- Provide a clear way back from the generated preview to the Examples/Components gallery so users can keep refining the prompt with additional examples or components while preserving the current generated output.
- Add a component detail modal opened by an info icon on component cards. The modal includes component summary, category/tags, preview media, exact prompt/copy text, source link, and a copy-to-clipboard action.
- Preserve the existing AI Agent, Manual Prompt, and Render workflow, generation approval boundary, project creation, Studio handoff, and render/export behavior.

## Capabilities

### New Capabilities
- `hyperframe-gallery-catalog`: Source, normalize, validate, and expose launch-video example and HyperFrames component metadata for gallery display and prompt insertion.

### Modified Capabilities
- `main-page-creation-flow`: The main page replaces the standalone preview player with the Examples/Components bento picker and feeds selected gallery items into agent/manual prompt workflows.

## Impact

- Affected source: `src/routes/index.tsx`, `src/components/prompt-agent-panel.tsx`, `src/lib/main-page-creation-flow.ts`, new gallery data/schema helpers, and a generated gallery catalog artifact.
- Affected scripts: add a sync/check script for launch-video and component catalog metadata, analogous to the existing HyperFrames skill catalog sync path.
- Affected UI: main page layout, bento gallery cards, examples/components tabs, gallery/preview workspace switching, component filters, selected-item state, component detail modal, copy-to-clipboard affordance, and prompt/agent context display.
- Affected tests: add schema/catalog validation, main-page helper tests, prompt-agent context forwarding tests, and browser checks for desktop/mobile gallery layout, preview switching, return-to-gallery refinement, selection, modal copy, and preserved render flow.
- External sources: `https://github.com/heygen-com/hyperframes-launch-video` for official launch-video examples and `https://hyperframes.heygen.com/catalog/blocks/code-3d-extrude` as the catalog crawl seed.
