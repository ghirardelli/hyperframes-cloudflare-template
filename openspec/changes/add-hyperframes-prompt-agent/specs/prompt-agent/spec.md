## ADDED Requirements

### Requirement: Conversational prompt coaching
The system SHALL provide an authenticated conversational agent that helps the user turn a rough idea into a generation-ready HyperFrames prompt.

#### Scenario: User starts with a rough idea
- **WHEN** an authenticated user sends a rough creative idea to the prompt agent
- **THEN** the agent asks useful follow-up questions or proposes a refined prompt plan using HyperFrames generation guidance

#### Scenario: User asks for a final prompt
- **WHEN** the user asks the agent to prepare the final generation prompt
- **THEN** the agent returns a generation-ready prompt that includes visual direction, motion pacing, duration guidance, and HyperFrames constraints

### Requirement: Direct TanStack AI streaming runtime
The system SHALL run the prompt agent through TanStack AI request/event streams directly between the app and Worker without routing traffic through a hosted AI gateway.

#### Scenario: Agent response streams to the page
- **WHEN** the user sends a prompt-agent message
- **THEN** the page receives streamed agent text, tool-call state, approval state, structured output state, completion state, and error state as observable runtime state

#### Scenario: Hosted gateway is not configured
- **WHEN** the prompt agent endpoint handles a request
- **THEN** the system uses server-side provider credentials and does not require any hosted gateway URL or browser-visible provider secret

### Requirement: Provider-portable OpenRouter adapter
The system SHALL use OpenRouter as the initial prompt-agent provider through a provider adapter while preserving a provider-portable model boundary.

#### Scenario: OpenRouter is configured
- **WHEN** `ENABLE_AI_GEN` is enabled and `OPENROUTER_API_KEY` is configured
- **THEN** the prompt agent uses the configured `OPENROUTER_MODEL` or the application's default model through the OpenRouter adapter

#### Scenario: OpenRouter is missing
- **WHEN** the prompt agent endpoint receives a request without a configured OpenRouter API key
- **THEN** the system returns a clear configuration error and does not attempt to start an agent stream

### Requirement: Typed prompt-agent tools
The system SHALL expose typed client and server tools for prompt coaching, HyperFrames guidance, prompt draft updates, project context inspection, and generation.

#### Scenario: Agent uses HyperFrames guidance
- **WHEN** the agent needs HyperFrames-specific composition rules
- **THEN** it can call a typed server tool that returns validated guidance such as canvas size, runtime requirements, timeline rules, allowed resources, and forbidden patterns

#### Scenario: Agent updates draft prompt locally
- **WHEN** the agent prepares a better draft prompt
- **THEN** it can call a typed client tool that updates the local draft prompt without mutating server project data

### Requirement: Approved generation tool
The system SHALL require explicit user approval before any prompt-agent tool call generates a HyperFrame or mutates project composition HTML.

#### Scenario: User approves generation
- **WHEN** the agent requests approval to generate from a prepared prompt and the user approves
- **THEN** the system calls the existing generation path and updates the workspace with the generated HTML, project metadata, model, attempts, and lint status

#### Scenario: User denies generation
- **WHEN** the agent requests approval to generate from a prepared prompt and the user denies
- **THEN** the system does not call the generation path and keeps the current project composition unchanged

### Requirement: Structured prompt package
The system SHALL validate the agent's final prompt recommendation against a structured output schema before applying it to the workspace prompt state.

#### Scenario: Structured prompt package is valid
- **WHEN** the agent emits a valid structured prompt package
- **THEN** the workspace shows the title, final prompt, duration, creative direction, motion plan, checklist, and suggested next action

#### Scenario: Structured prompt package is invalid
- **WHEN** the agent emits structured output that fails validation
- **THEN** the workspace surfaces a recoverable error and leaves the editable prompt state unchanged

### Requirement: Text-first media and realtime readiness
The system SHALL keep the prompt agent usable as a text-first workflow while preserving an extension point for future media-capable or realtime providers.

#### Scenario: Realtime provider is absent
- **WHEN** only the OpenRouter text provider is configured
- **THEN** the prompt agent remains fully usable for text chat, prompt drafting, approval, and generation

#### Scenario: Future media provider is configured
- **WHEN** a future implementation configures a supported realtime or multimodal provider
- **THEN** the prompt-agent provider boundary can accept media or realtime context without changing the workspace's prompt approval contract
