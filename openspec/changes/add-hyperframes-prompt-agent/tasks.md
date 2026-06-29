## 1. Dependencies And Contracts

- [x] 1.1 Add TanStack AI dependencies (`@tanstack/ai`, `@tanstack/ai-client`, `@tanstack/ai-react`, `@tanstack/ai-openrouter`) and a schema validation dependency if needed for structured outputs.
- [x] 1.2 Define shared prompt-agent schemas and types for forwarded props, structured prompt package output, tool inputs/outputs, and client-applied draft prompt state.
- [x] 1.3 Add a server-side provider adapter factory that creates the initial OpenRouter TanStack AI text adapter from `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, request origin, and app title.
- [x] 1.4 Add a HyperFrames guidance helper that exposes a distilled, non-secret subset of `src/lib/hyperframes-skill.ts` for agent tools.

## 2. Worker Agent Runtime

- [x] 2.1 Add authenticated `POST /api/agent/chat` routing in `src/worker/render-api.ts`, gated by the existing auth, tenant, and `ENABLE_AI_GEN` checks.
- [x] 2.2 Parse AG-UI-compatible request bodies with TanStack AI request helpers, including forwarded props such as project id, current prompt, duration, and active project title.
- [x] 2.3 Implement the TanStack AI chat loop and return an SSE response that streams text, tool calls, approvals, structured output, completion, and error events.
- [x] 2.4 Implement typed server tools for HyperFrames guidance, current project context inspection, prompt package preparation, and approved generation.
- [x] 2.5 Refactor the existing generation/upsert path as needed so both `/api/generate` and the approved agent generation tool reuse the same validation, persistence, lint retry, and response shape.
- [x] 2.6 Ensure provider secrets, full system prompts, and project data from other organizations are never returned in agent messages or tool outputs.

## 3. Workspace Agent UI

- [x] 3.1 Add a prompt-agent panel to the root workspace using `useChat` or the headless TanStack AI client with `fetchServerSentEvents("/api/agent/chat")`.
- [x] 3.2 Render streaming assistant messages, loading/stopped/error states, retry/stop controls, and model/config disabled states.
- [x] 3.3 Render typed tool-call cards for guideline lookup, project inspection, prompt drafting, and generation, including approval cards with approve/deny controls.
- [x] 3.4 Render partial and final structured prompt package state and allow the user to apply the final prompt package to the editable prompt.
- [x] 3.5 Implement typed client tools for updating the local draft prompt and focusing the relevant workspace region without mutating server project data.
- [x] 3.6 Wire approved agent generation results into the existing preview/project/model/attempts/lint state while preserving the manual Generate button.
- [x] 3.7 Keep the preview primary and ensure the prompt-agent panel remains usable without overlap on mobile and desktop workspace layouts.

## 4. Verification

- [x] 4.1 Add Worker route tests for unauthenticated access, missing tenant organization, disabled AI generation, missing OpenRouter key, and successful stream setup.
- [x] 4.2 Add server-tool tests for HyperFrames guidance, project context access control, prompt package validation, denied generation approval, and approved generation reuse of the existing path.
- [x] 4.3 Add client tests for streaming message rendering, structured prompt application, approve/deny behavior, manual generation preservation, and disabled/error states.
- [x] 4.4 Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run deploy:dry-run`.
- [x] 4.5 Browser-verify the root workspace at mobile and desktop widths for streaming UI, approval flow, prompt application, manual generation, approved agent generation, and render controls.
