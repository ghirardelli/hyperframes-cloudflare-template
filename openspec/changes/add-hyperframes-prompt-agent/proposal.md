## Why

The main workspace currently asks users to type a single prompt and generate a HyperFrame with little guidance, which makes users guess at the animation, composition, and HyperFrames-specific constraints before they see an output. A conversational AI agent can coach the user through the creative brief, apply the HyperFrames skill rules consistently, and produce a stronger generation-ready prompt while still keeping generation behind explicit user approval.

## What Changes

- Add an AI prompt agent to the main HyperFrames workspace so users can have a back-and-forth conversation before generating a composition.
- Use TanStack AI directly in the app and Worker, without a hosted gateway: a React/framework adapter or headless client on the page, an AG-UI-compatible SSE endpoint on the Worker, and an OpenRouter provider adapter using the existing `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` bindings.
- Stream agent responses, tool calls, approvals, and structured prompt drafts into the UI so the user sees the prompt plan evolve instead of waiting on a black-box response.
- Add typed tools for reading HyperFrames generation guidance, analyzing the current draft, preparing a generation-ready prompt, and optionally invoking generation only after tool approval.
- Add a structured output contract for the final prompt package: title, final generation prompt, creative direction, HyperFrames checklist, and suggested next action.
- Preserve the existing `/api/generate` flow and manual prompt editing so users can still generate directly when they want to.
- Defer realtime voice/media input to a follow-up unless supported secrets and provider capabilities are added; design the agent boundary so media-capable providers can be introduced later without changing the workspace contract.

## Capabilities

### New Capabilities

- `prompt-agent`: Conversational AI assistance for turning user intent into generation-ready HyperFrames prompts, including streaming UI, typed tools, structured outputs, tool approval, provider portability, and no hosted AI gateway.

### Modified Capabilities

- `studio-workspace`: The main workspace creation flow changes from only a direct prompt textarea to an assisted prompt workflow that can update the generation prompt and trigger the existing generation path after user approval.

## Impact

- Affected routes: `src/routes/index.tsx` gains an agent/chat panel alongside the existing preview, status, render, and generation controls.
- Affected Worker API: add a new authenticated agent streaming endpoint, likely `POST /api/agent/chat`, handled in `src/worker/render-api.ts` before TanStack Start routing.
- Affected AI code: introduce TanStack AI packages (`@tanstack/ai`, `@tanstack/ai-client`, `@tanstack/ai-react`, `@tanstack/ai-openrouter`) and typed tool/schema helpers, while keeping provider API keys server-side.
- Affected existing generation path: reuse `src/lib/generate.ts` and `src/lib/hyperframes-skill.ts` guidance; do not replace `/api/generate`.
- Affected configuration: reuse `ENABLE_AI_GEN`, `OPENROUTER_API_KEY`, and `OPENROUTER_MODEL`; optional future provider bindings can be added behind the same adapter factory.
- Affected tests: add Worker endpoint/tool tests, structured output/schema tests, and UI tests for streaming, approval, and prompt application states.
