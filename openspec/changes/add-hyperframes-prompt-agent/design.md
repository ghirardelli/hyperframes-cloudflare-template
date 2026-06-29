## Context

The root workspace currently renders a live HyperFrames preview and a right-side Generate card. The user edits a textarea, clicks Generate, and the Worker calls `/api/generate`, which validates auth/organization context, checks `ENABLE_AI_GEN`, reads `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`, then delegates to `src/lib/generate.ts`. That helper sends OpenRouter chat-completion requests, uses the prompt-building rules in `src/lib/hyperframes-skill.ts`, retries lint failures, and returns HTML for persistence through the existing project path.

That direct path works, but it gives the user only one prompt field for a domain with many hidden rules: 1920x1080 canvas, HyperFrames runtime scripts, timeline registration, deterministic GSAP usage, no external images/video/audio, visual density, staged exits, and render-safe animation structure.

TanStack AI fits this change because its core is framework-agnostic, with React integration available through `@tanstack/ai-react` and headless client support through `@tanstack/ai-client`. The official docs describe type-safe tool/function calling, streaming, provider adapters including OpenRouter, structured output, AG-UI request/event streams, and direct runtime usage without routing through a hosted gateway:

- Overview and packages: https://tanstack.com/ai/latest/docs/getting-started/overview
- OpenRouter adapter: https://tanstack.com/ai/latest/docs/adapters/openrouter
- Streaming and AG-UI events: https://tanstack.com/ai/latest/docs/chat/streaming
- Connection adapters: https://tanstack.com/ai/latest/docs/chat/connection-adapters
- AG-UI request compatibility: https://tanstack.com/ai/latest/docs/migration/ag-ui-compliance
- Tool architecture and approval: https://tanstack.com/ai/latest/docs/tools/tool-architecture and https://tanstack.com/ai/latest/docs/tools/tool-approval
- Structured output with tools: https://tanstack.com/ai/latest/docs/structured-outputs/with-tools
- Realtime/media extension point: https://tanstack.com/ai/latest/docs/media/realtime-chat

## Goals / Non-Goals

**Goals:**

- Add a conversational prompt agent to the root workspace that helps users refine an idea into a generation-ready HyperFrames prompt.
- Use TanStack AI directly with OpenRouter in the Worker, preserving the existing server-side secrets and avoiding a hosted gateway.
- Stream text, structured prompt drafts, tool calls, tool results, approval requests, and errors into observable UI state.
- Keep provider selection portable behind a small adapter factory while OpenRouter remains the initial provider.
- Require explicit approval before an agent-triggered generation mutates project HTML or creates/updates a project.
- Reuse existing generation, lint retry, auth, organization scoping, and project persistence behavior.

**Non-Goals:**

- Replacing `/api/generate` or removing the manual prompt textarea.
- Building a generalized multi-agent system, long-running background jobs, or autonomous project editing outside prompt preparation and approved generation.
- Adding a hosted TanStack AI gateway or sending OpenRouter secrets to the browser.
- Shipping realtime voice, webcam, or image-generation workflows in the first implementation. The design keeps an extension point, but text chat plus optional future media attachments are sufficient for this change.

## Decisions

**1. Use TanStack AI's direct client/server stream.**
The page should use `useChat` from `@tanstack/ai-react` or a headless `ChatClient` from `@tanstack/ai-client` with `fetchServerSentEvents("/api/agent/chat")`. The Worker responds with `toServerSentEventsResponse(stream)` from TanStack AI. This gives AG-UI-compatible streaming events such as run start, text deltas, tool call args, tool results, approval requests, structured-output chunks, run finish, and run error.

Alternative considered: keep the existing hand-written OpenRouter call for the agent. That would duplicate streaming, tool, approval, and typed state machinery that TanStack AI already provides.

**2. Mount the agent endpoint in the Worker.**
Add `POST /api/agent/chat` to `handleWorkerApi` before TanStack Start fallback routing. The endpoint uses the same `protectedContext`, tenant organization checks, `ENABLE_AI_GEN`, and OpenRouter secret validation as `/api/generate`. It reads AG-UI request bodies with TanStack's request helpers, including forwarded props such as `projectId`, `currentPrompt`, `durationSec`, and `activeProjectTitle`.

Alternative considered: implement the endpoint as a TanStack Start server function. The Worker already owns auth, secrets, project access, and generation, so keeping the endpoint there avoids two server-side AI paths.

**3. Isolate provider creation behind an adapter factory.**
Create a small server-side module, for example `src/lib/prompt-agent-provider.ts`, with a function that accepts `WorkerEnv` plus request metadata and returns a TanStack AI text model adapter. The first implementation uses `@tanstack/ai-openrouter` with `createOpenRouterText(model, apiKey, { httpReferer, appTitle })`, defaulting to `OPENROUTER_MODEL` or the existing `DEFAULT_MODEL`.

The chat loop only depends on TanStack AI's model interface. Later OpenAI, Anthropic, Gemini, Groq, Ollama, or other adapters can be added behind the same function when their secrets are present.

**4. Model the agent as typed tools plus a structured final prompt package.**
The server defines typed tools with schemas:

- `get_hyperframes_guidelines`: returns a distilled, non-secret subset of `HF_SKILL_DEFAULTS` and the key generation constraints from `src/lib/hyperframes-skill.ts`.
- `inspect_project_context`: reads the active project title/current prompt/current HTML summary when a `projectId` is provided and the user has organization access.
- `prepare_prompt_package`: validates and returns a draft prompt package that can be streamed to the UI.
- `generate_hyperframe`: calls the existing generation/persistence path and is marked `needsApproval: true`.

The client defines typed UI tools:

- `set_draft_prompt`: updates the local prompt textarea/draft prompt preview.
- `highlight_agent_section`: focuses the relevant UI region, such as prompt draft, checklist, or approval card.

The final structured output schema, for example `PromptAgentResult`, contains `title`, `generationPrompt`, `durationSec`, `creativeDirection`, `motionPlan`, `hyperframesChecklist`, and `suggestedNextAction`. The client renders partial structured output while streaming and applies only validated final output to the draft prompt state.

Alternative considered: make every agent response plain text. That is easier to implement but loses testable structure and makes it harder to wire the final prompt into generation safely.

**5. Put user approval at the mutation boundary.**
The agent can inspect context, suggest prompts, and update local draft state without explicit approval. It must request approval before invoking `generate_hyperframe`, because that can call OpenRouter, create/update a project, and replace the preview HTML. The UI renders approve/deny controls for the tool approval request and passes the approval response back through TanStack AI using the approval id.

Alternative considered: have the agent always call generation after preparing a prompt. That would surprise users and spend provider tokens without a deliberate action.

**6. Keep the manual Generate path first-class.**
The existing Generate button remains available and continues to call `/api/generate` with the current prompt. The agent panel writes into the same prompt state and can also request approved generation through the same underlying helper. This keeps the change additive and lets users ignore the agent for quick iterations.

**7. Build the UI around observable runtime state.**
The root workspace's right column becomes a prompt workspace with chat messages, a streaming draft prompt, checklist/status badges, and the existing Generate/Render controls. It renders:

- assistant text as it streams;
- tool-call cards for guideline lookup, prompt preparation, project inspection, and generation;
- approval cards with approve/deny controls;
- partial and final structured prompt package state;
- loading, stopped, error, retry, and disabled states from `useChat` or the headless client.

The layout should remain compact and operational, not a marketing/chatbot landing page. The preview stays primary.

**8. Treat realtime and media as a future provider capability.**
TanStack AI supports realtime chat through provider-specific WebRTC/WebSocket adapters and token endpoints. The initial OpenRouter-backed implementation should stay text-first. The agent API should not assume voice/media secrets exist, but the provider factory and request metadata shape can leave room for future `realtimeToken` endpoints and multimodal attachments if a configured provider supports them.

## Risks / Trade-offs

- **Long-running streams on Cloudflare Workers:** SSE streams can be interrupted by network changes or client aborts. Mitigation: pass the request abort signal into the chat stream, expose Stop/Retry in the UI, and keep generation as a separate approved tool call.
- **Tool approval complexity:** The approval id is distinct from a tool call id. Mitigation: encapsulate approval rendering in a small UI component and test approve/deny flows.
- **Prompt guidance leakage or overexposure:** The full system prompt and reference example do not need to be sent to the client. Mitigation: expose only distilled guidelines via tools and keep generation system prompts server-side.
- **Provider drift:** OpenRouter model names and capabilities vary by provider. Mitigation: use `OPENROUTER_MODEL`, expose the active model label, and keep model-specific options inside the adapter factory.
- **Structured output validation failures:** Models can emit malformed or incomplete structured JSON. Mitigation: stream partial output defensively, surface a recoverable error, and leave the manual prompt editable.
- **Duplicate AI spend:** Agent chat plus generation can use more tokens than direct generation. Mitigation: keep generation approval explicit and make direct Generate available.

## Migration Plan

1. Add TanStack AI dependencies and type/schema modules for the prompt agent.
2. Implement the provider adapter factory and typed server tools.
3. Add `POST /api/agent/chat` with auth, tenant checks, AI enablement checks, AG-UI request parsing, and SSE response streaming.
4. Refactor the root workspace right column into a prompt workspace with chat, streaming draft, tool cards, approvals, and existing Generate/Render controls.
5. Wire approved `generate_hyperframe` to reuse existing generation/persistence logic, returning the same preview/project metadata shape the page already understands.
6. Add unit tests for schemas/tools/provider selection, Worker route tests for disabled/missing secret/auth cases, and UI tests for streaming draft, approval approve/deny, manual generate, and error states.
7. Verify `npm run test`, `npm run typecheck`, `npm run build`, and the existing Cloudflare dry-run/deploy checks used by this repo.

Rollback is straightforward: remove the agent panel and endpoint while leaving `/api/generate` untouched. No data migration is introduced.

## Open Questions

- Should the approved generation tool update the current active project by default, or always create a new project unless the user chooses otherwise?
- Should conversation history be ephemeral in browser state for the first release, or persisted per project later?
- Which OpenRouter model should be the default for prompt coaching if `OPENROUTER_MODEL` is tuned primarily for HTML generation?
- Should media attachments be accepted as future prompt context through OpenRouter multimodal models, or deferred until a realtime/media provider is configured?
