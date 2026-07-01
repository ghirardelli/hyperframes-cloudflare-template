## ADDED Requirements

### Requirement: Push-to-talk prompt-agent input
The system SHALL let an authenticated user record speech in the prompt-agent panel, transcribe the recording through a server-side transcription provider, and submit the resulting text as a normal prompt-agent message.

#### Scenario: User sends a voice message
- **WHEN** an authenticated user records speech, reviews the transcription, and submits it to the prompt agent
- **THEN** the system sends the transcribed text through the existing prompt-agent chat stream and preserves normal tool, approval, structured output, and error behavior

#### Scenario: Voice input is unavailable
- **WHEN** the browser does not support recording or the deployment has no configured transcription provider
- **THEN** the prompt-agent panel disables voice submission and keeps text chat available

#### Scenario: Transcription fails
- **WHEN** a recording cannot be transcribed because of provider, size, duration, format, or network failure
- **THEN** the system surfaces a recoverable error and does not send an agent message automatically

### Requirement: Prompt-agent file attachments
The system SHALL let an authenticated editor attach files to the prompt agent by uploading them into the active project as project assets before the agent uses them as context.

#### Scenario: User attaches a file to an active project
- **WHEN** an authenticated editor attaches a supported file while an editable project is active
- **THEN** the system stores the file under a normalized `assets/...` project path, returns project asset metadata, and shows the attachment in the prompt-agent composer

#### Scenario: User attaches without editable project
- **WHEN** a user attempts to attach a file without an active editable project
- **THEN** the system rejects the attachment and does not send the file to the prompt agent

#### Scenario: Attachment path is unsafe
- **WHEN** an attachment filename or requested path would produce an absolute path, parent traversal, empty segment, reserved prefix, or control character
- **THEN** the system rejects or sanitizes the path before any storage write and never creates an unsafe project entry

### Requirement: Asset-aware agent context
The system SHALL provide the prompt agent with validated metadata for user-attached project assets so it can reason about available assets without inventing paths or exposing raw bytes unnecessarily.

#### Scenario: Agent receives attached asset metadata
- **WHEN** a user sends an agent message with uploaded attachments
- **THEN** the prompt-agent request includes each attachment's logical path, content type, size, and project-scoped URL or identifier

#### Scenario: Agent inspects project assets
- **WHEN** the agent needs to know which assets are available in the active project
- **THEN** it can call a read-only tool that returns only authorized project asset metadata for the current organization and project

#### Scenario: Agent references uploaded asset
- **WHEN** the agent prepares a prompt package that uses an uploaded file
- **THEN** the prompt package references the known `assets/...` logical path rather than an arbitrary external URL or invented filename

### Requirement: Project-scoped media guidance
The system SHALL allow HyperFrames prompt guidance and generated project HTML to reference authorized project-scoped assets while continuing to forbid arbitrary external media resources.

#### Scenario: Uploaded project asset is used in a prompt
- **WHEN** an uploaded asset is included in prompt-agent context and the agent prepares a generation-ready prompt
- **THEN** the agent may instruct generation to use that asset by its `assets/...` project path

#### Scenario: External media URL is requested
- **WHEN** the user asks the agent to use an arbitrary external image, audio, video, or CDN resource that has not been uploaded or captured into the project
- **THEN** the agent instructs the user to attach or import the asset before relying on it in generated HyperFrames output

#### Scenario: Unsupported media requires clarification
- **WHEN** an uploaded asset type cannot be safely understood or rendered by the current provider or HyperFrames workflow
- **THEN** the agent asks a follow-up question or explains the limitation instead of claiming the asset was incorporated

### Requirement: Attachment mutation boundaries
The system SHALL keep user-initiated uploads distinct from agent-initiated project mutations and SHALL require explicit approval before the agent changes project files or generated HTML.

#### Scenario: User uploads an attachment
- **WHEN** the user explicitly selects a file to attach
- **THEN** the system may upload the file as a project asset without a separate agent approval prompt

#### Scenario: Agent proposes file organization
- **WHEN** the agent proposes renaming, replacing, deleting, moving, or generating files based on attached assets
- **THEN** the system requires explicit user approval before mutating project files or composition HTML

#### Scenario: User denies agent mutation
- **WHEN** the user denies an agent-requested project mutation involving attached assets
- **THEN** the system leaves existing project files, assets, and composition HTML unchanged
