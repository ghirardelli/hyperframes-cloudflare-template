## Context

The root workspace already has a TanStack AI prompt agent: the browser uses `useChat` with `fetchServerSentEvents("/api/agent/chat")`, and the Worker runs the agent through TanStack AI with typed server/client tools, structured output, and approval-required generation. The current input surface is text-only.

The project model already supports durable project assets. Studio uploads binary files through `/api/projects/:projectId/assets?path=assets/...`; the Worker stores bytes in provider-backed project storage, records `project_entries`/`project_entry_versions`, and serves assets back through project-scoped routes. Studio's Assets tab and logical file tree then show those entries.

This change connects those two existing systems. Voice recording is an input method for chat. File attachment is project state: once a user attaches a file to the AEI/prompt agent, the file should be uploaded into the active project as an asset before the agent treats it as build context.

## Goals / Non-Goals

**Goals:**

- Let users talk to the prompt agent by recording audio and sending a transcription into the existing chat loop.
- Let users attach files from the prompt-agent panel and persist them as project assets under normalized `assets/...` paths.
- Pass uploaded asset metadata into agent context so the agent can reference assets in prompt packages and approved generation.
- Update HyperFrames guidance so project-scoped `assets/...` references are allowed while arbitrary external media/CDN references remain forbidden.
- Reuse existing project authorization, asset storage, version history, and Studio file tree behavior.

**Non-Goals:**

- Realtime voice-to-voice chat, assistant speech output, interruption handling, or WebRTC sessions.
- Treating recordings as project audio assets by default; voice recordings are chat input unless the user explicitly attaches the recording as a file.
- Provider-side vision/audio analysis for every file type in the first pass.
- Agent-initiated deletion, replacement, or reorganization of files without explicit approval.
- Replacing the existing text chat, manual Generate flow, or Studio asset upload flow.

## Decisions

**1. Ship push-to-talk transcription before realtime voice.**
The UI should use TanStack AI's browser recorder (`useAudioRecorder`) to capture native browser audio (`audio/webm` or `audio/mp4`) and send it to a transcription endpoint. On successful transcription, the client submits the resulting text through the existing `sendMessage` path. This preserves the current SSE agent stream, tools, approvals, and structured output.

Alternative considered: send `recording.part` directly into the chat model as an audio content part. That can work only when the configured chat provider supports audio input. The current app is OpenRouter text-first, so transcription gives a reliable voice input path without changing the prompt-agent provider boundary.

Alternative considered: implement realtime voice chat. That requires provider-specific realtime session/token endpoints, audio playback, interruption, and more complex UX. It is valuable later, but it is bigger than "talk instead of typing."

**2. Add a dedicated transcription endpoint and provider adapter.**
Add a Worker endpoint such as `POST /api/agent/transcribe` that accepts TanStack AI transcription input and returns a transcription result using a provider-specific adapter. The initial implementation can use OpenAI, ElevenLabs, or fal.ai depending on the configured secret and dependency choice. The endpoint must use server-side credentials only and return clear configuration errors when transcription is unavailable.

Alternative considered: perform browser-native speech recognition. It would reduce server cost, but browser support, permission behavior, language handling, and testability are inconsistent. TanStack AI transcription keeps the provider model explicit and portable.

**3. Upload attachments before sending them to the agent.**
When a user attaches a file in the prompt-agent panel, the client should require an active editable project, choose or derive a logical `assets/...` path, and upload bytes through the project asset API. Only after the upload succeeds should the file appear in the chat composer as an attached project asset and be included in forwarded agent props.

Alternative considered: include files only as inline multimodal chat parts. That helps a model inspect content, but it does not make the assets available to HyperFrames builds or Studio. The durable project asset is the source of truth.

**4. Treat multimodal content as optional enrichment.**
The canonical attachment context is compact metadata: logical path, content type, size, URL, and optional description/transcript fields when available. If the configured chat model supports image/audio/video/document content parts and the file size/type is safe, the client or Worker may include a content part for richer model understanding. The agent must still reference the durable project asset path in prompt packages.

Alternative considered: always send bytes to the chat provider. That can leak unnecessary data, increase token/media costs, and fail on text-only providers. Metadata-first keeps behavior consistent.

**5. Keep asset paths constrained and deterministic.**
All attached files should be normalized through the existing project path rules and stored under `assets/`. The default path can be `assets/<sanitized-filename>`, with collision handling such as suffixing or prompting before overwrite. Reserved prefixes, absolute paths, parent traversal, empty segments, and unsupported/control-character names remain invalid.

Alternative considered: allow users to choose any project path. That risks putting binaries under source/composition folders and complicates build assumptions. The prompt-agent attachment lane should be asset-only.

**6. Extend prompt-agent context and tools with asset awareness.**
Add schemas for attached asset metadata and include them in forwarded props. Add a read-only server tool such as `list_project_assets` or extend `inspect_project_context` so the agent can see the active project's relevant asset paths, content types, and safe metadata. The system prompt should instruct the agent to use `assets/...` paths when referencing uploaded project assets, and never to invent asset paths.

Alternative considered: paste uploaded filenames into the user's message. That is brittle and untyped; a schema makes tests and model instructions sharper.

**7. Update generation guidance at the project-asset boundary.**
`get_hyperframes_guidelines` currently forbids external images, video, audio, and arbitrary CDN assets. That rule should become: arbitrary external media remains forbidden, but project-scoped assets under `assets/...` are allowed when they were uploaded or materialized into the active project. The generated HTML still must be render-safe and must not depend on inaccessible URLs.

Alternative considered: keep all media forbidden. That would make attachments useful only for prompt inspiration, not for building videos with user assets, which misses the feature's main purpose.

## Risks / Trade-offs

- **Transcription provider configuration can be missing** -> Expose `voiceInputEnabled`/provider readiness in `/api/config`, disable recorder submission when unavailable, and return a clear endpoint error.
- **Audio uploads can be large or long** -> Set recording duration and byte limits in the UI and Worker; show recoverable errors before starting agent chat.
- **File uploads can expose sensitive assets to an AI provider** -> Persist assets first, pass metadata by default, and send inline content parts only for supported provider/type/size combinations with explicit product copy.
- **Name collisions can overwrite assets unexpectedly** -> Use deterministic collision handling and display the final logical path before the agent relies on it.
- **Generated HTML can reference unavailable assets** -> Feed only stored asset paths to the agent, validate prompt packages against known paths, and keep preview/render routes project-scoped.
- **Text-only providers cannot inspect media contents** -> The agent can still use filenames/metadata and ask follow-up questions; richer media understanding can be enabled when a multimodal provider is configured.
- **Voice text can be wrong** -> Let users review/edit the transcription before sending or submit it as a draft message with a clear correction path.

## Migration Plan

1. Add media-input schemas, config flags, and tests for attached asset metadata and forwarded props.
2. Add the transcription provider dependency and Worker transcription endpoint behind auth, tenant, AI enablement, and provider-secret checks.
3. Extend the prompt-agent UI with recorder controls, transcription status, attachment selection/upload, attachment chips, and error states.
4. Factor/reuse the project asset upload logic so prompt-agent attachments and Studio uploads share authorization, normalization, storage, and metadata behavior.
5. Add prompt-agent asset tools/context and update the system prompt/guidelines to distinguish project assets from arbitrary external media.
6. Wire successful uploads into Query cache invalidation so Studio/project views see chat-uploaded assets.
7. Add unit, Worker route, and component tests; then verify `npm run test`, `npm run typecheck`, and `npm run build`.

Rollback is straightforward: hide the voice/attachment controls, remove the transcription endpoint, and leave existing project asset rows intact. Uploaded project assets remain normal Studio assets.

## Open Questions

- Which transcription provider should be the initial default: OpenAI, ElevenLabs, or fal.ai?
- Should the UI send a transcribed voice message immediately, or always require a review/edit step before chat submission?
- What file type and size limits should apply per asset category in the prompt-agent composer?
- Should image attachments be sent as multimodal provider content when the chat model supports images, or should first pass remain metadata-only?
- How should filename collisions be resolved: automatic suffix, overwrite confirmation, or user-controlled rename?
