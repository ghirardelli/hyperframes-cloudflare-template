## 1. Shared Contracts and Configuration

- [x] 1.1 Add prompt-agent media schemas for attached asset metadata, transcription request/response state, and forwarded attached asset context.
- [x] 1.2 Extend prompt-agent forwarded props normalization and tests to carry validated attached asset metadata.
- [x] 1.3 Add configuration flags for voice input and transcription provider readiness to `/api/config`.
- [x] 1.4 Choose and add the initial TanStack AI transcription provider dependency and environment variable contract.
- [x] 1.5 Add tests for disabled/missing transcription provider configuration and browser-unavailable voice input state.

## 2. Transcription Endpoint

- [x] 2.1 Implement a server-side transcription provider factory that keeps provider credentials out of the browser.
- [x] 2.2 Add authenticated `POST /api/agent/transcribe` handling with tenant checks, AI enablement checks, request size/duration limits, and clear JSON errors.
- [x] 2.3 Wire the endpoint through TanStack AI transcription helpers so native browser recorder formats preserve their content type.
- [x] 2.4 Add Worker route tests for unauthenticated access, missing tenant organization, disabled AI, missing transcription secret, oversized recording, and successful transcription response.

## 3. Project Asset Upload Reuse

- [x] 3.1 Factor the existing Studio asset upload logic into a shared helper that accepts an authenticated project, normalized `assets/...` path, bytes, and content type.
- [x] 3.2 Add prompt-agent attachment upload support using the shared helper while preserving edit permission checks and cross-organization denial.
- [x] 3.3 Add deterministic filename sanitization and collision handling for `assets/<filename>` attachment paths.
- [x] 3.4 Add file type, size, and path limit validation for prompt-agent attachments.
- [x] 3.5 Add Worker/storage tests proving prompt-agent attachments create project assets, project entries, entry versions, and no rows on rejected uploads.

## 4. Agent Asset Awareness

- [x] 4.1 Add a read-only server tool or extend project inspection so the agent can list authorized project asset metadata.
- [x] 4.2 Update the prompt-agent system prompt to use known `assets/...` paths and never invent asset paths.
- [x] 4.3 Update `get_hyperframes_guidelines` so project-scoped assets are allowed while arbitrary external media and CDN resources remain forbidden.
- [x] 4.4 Extend prompt package validation or generation preflight to detect unknown `assets/...` references before treating generation output as valid.
- [x] 4.5 Add server-tool and prompt-agent contract tests for asset metadata, unknown asset rejection, and external media guidance.

## 5. Prompt-Agent UI

- [x] 5.1 Add recorder controls to `PromptAgentPanel` using TanStack AI's audio recorder hook, including unsupported, recording, stopping, transcribing, error, and ready states.
- [x] 5.2 Let users review or edit transcription text before submitting it through the existing `sendMessage` path.
- [x] 5.3 Add file picker and drag/drop attachment controls with upload progress, attachment chips, removal before send, and final logical path display.
- [x] 5.4 Disable attachment upload when no editable active project is available and keep text chat usable.
- [x] 5.5 Include uploaded attached asset metadata in the next prompt-agent request body and clear composer-only attachment state after send.
- [x] 5.6 Add component tests for voice state transitions, transcription failure, successful transcript send, attachment upload success, attachment rejection, and message submission with asset context.

## 6. Studio and Cache Integration

- [x] 6.1 Invalidate or update relevant project asset/file query state after prompt-agent attachment upload.
- [x] 6.2 Verify assets uploaded through prompt-agent appear in Studio's file tree and Assets tab with the same metadata as Studio uploads.
- [x] 6.3 Verify Studio preview and project asset routes resolve prompt-agent-uploaded assets and deny inaccessible assets.
- [x] 6.4 Add or update Studio/Worker tests for chat-uploaded assets appearing in listing and preview flows.

## 7. Verification and Documentation

- [x] 7.1 Add focused unit tests for path sanitization, collision handling, media schema validation, and config flags.
- [x] 7.2 Add integration tests covering approved generation with a known `assets/...` reference and rejection of an unknown `assets/...` reference.
- [x] 7.3 Update `.dev.vars.example` or deployment docs with the transcription provider configuration.
- [x] 7.4 Run `npm run test`.
- [x] 7.5 Run `npm run typecheck`.
- [x] 7.6 Run `npm run build`.
- [ ] 7.7 Browser-verify desktop and mobile prompt-agent voice input, attachment upload, agent response, approved generation, Studio asset visibility, and preview asset loading.
