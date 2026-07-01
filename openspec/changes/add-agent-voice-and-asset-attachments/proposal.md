## Why

The prompt agent currently requires users to type every instruction and has no first-class way to receive user-provided media or brand assets. HyperFrames projects already model binary assets, so chat attachments should become durable project assets that the agent can reason about and the renderer can reference instead of staying as transient chat payloads.

## What Changes

- Add push-to-talk voice input for the prompt agent so users can record speech and submit the resulting transcription as an agent message.
- Add an attachment flow in the prompt-agent panel for files such as images, videos, audio, fonts, and documents.
- Store user-attached files as project assets under normalized `assets/...` paths before the agent uses them as context.
- Pass compact attached-asset metadata to the agent so responses and prompt packages can reference the uploaded project assets by logical path.
- Allow generation guidance to distinguish safe project-scoped `assets/...` references from arbitrary external images, video, audio, and CDN assets, which remain forbidden unless a future workflow explicitly supports them.
- Keep project mutation boundaries explicit: user file selection/upload is a user action, and any agent-initiated asset organization, replacement, deletion, or generated HTML update requires the existing approval model.
- Preserve the existing text chat, manual Generate button, Studio asset upload, project permissions, version history, and render pipeline behavior.

## Capabilities

### New Capabilities
- `prompt-agent-media-input`: Defines voice recording, transcription, attachment upload, attachment context, and agent behavior for media-aware prompt coaching.

### Modified Capabilities
- `tenant-projects`: Attached files sent through the prompt agent are persisted as organization-scoped project assets under the project entry namespace.
- `studio-workspace`: Assets uploaded through the prompt agent appear in the same Studio file tree/assets surface and can be referenced by project compositions.

## Impact

- Dependencies: add a TanStack AI transcription-capable provider adapter, likely `@tanstack/ai-openai`, `@tanstack/ai-elevenlabs`, or `@tanstack/ai-fal`, plus the corresponding server-side configuration secret.
- Client UI: extend `PromptAgentPanel` with recorder controls, transcription status, file picker/drag-drop, attachment chips, upload progress, and attachment error states.
- Worker APIs: add a transcription endpoint and reuse or factor the existing project asset upload path for prompt-agent attachments.
- Prompt-agent schemas/tools: add forwarded attached-asset metadata, an asset inspection/listing tool, and prompt package fields or guidance for project asset references.
- Project storage: continue using project entries, versions, snapshots, and provider-backed object storage for uploaded binary assets.
- Auth/security: enforce existing tenant/project edit permissions, upload size/type limits, path normalization, and no provider-secret exposure.
- Tests: cover transcription configuration errors, recorder/transcription UI states, attachment upload access control, path normalization, project asset metadata in agent context, and prompt generation that references stored `assets/...` paths.
