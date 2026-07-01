## MODIFIED Requirements

### Requirement: Chat-style agent workspace
The system SHALL present the AI Agent tab as a chat-style workspace with the conversation stream above and the composer anchored at the bottom. The conversation stream SHALL be bounded to the available responsive panel height and SHALL scroll internally when the thread content exceeds that space.

#### Scenario: AI Agent tab is empty
- **WHEN** a user opens the AI Agent tab before any messages exist
- **THEN** the tab shows helper text for asking the agent without wrapping that helper text in a border that resembles an input field

#### Scenario: Agent streams response
- **WHEN** the AI Agent is generating or streaming a response
- **THEN** the response appears in the conversation stream above the composer

#### Scenario: User composes a message
- **WHEN** a user types into the Ask the agent field
- **THEN** the composer remains at the bottom of the AI Agent tab with the Send action adjacent to or visually grouped with the input

#### Scenario: Conversation exceeds panel height
- **WHEN** the AI Agent conversation contains more messages than fit in the available panel height
- **THEN** the conversation stream scrolls internally while the Ask the agent composer remains visible at the bottom of the panel

### Requirement: Form-managed creation intake
The system SHALL manage main creation prompt, context, internal duration, resolution, and format values through TanStack Form while preserving existing manual and agent-assisted generation behavior. The main creation page SHALL NOT expose a visible duration selector in AI Agent or Manual Prompt mode.

#### Scenario: User edits creation settings
- **WHEN** a user edits prompt, render resolution, or render format in the main creation flow
- **THEN** the form tracks the changed values and validation state for those inputs

#### Scenario: Main creation duration remains internal
- **WHEN** a user opens AI Agent or Manual Prompt mode on the main creation page
- **THEN** the page does not show a Duration dropdown or the helper text "Duration is used before generation so the motion timing and final beat fit the timeline."

#### Scenario: Agent applies a prompt package with duration
- **WHEN** the AI Agent provides a valid duration through an applied prompt package or approved generation path
- **THEN** the form preserves that internal `durationSec` value for generation without requiring a visible duration selector

#### Scenario: User generates directly
- **WHEN** a user submits a valid prompt through the existing direct manual or agent-approved generation path
- **THEN** the system preserves the current generation behavior and sends the validated form values to the generation mutation

## REMOVED Requirements

### Requirement: Expanded duration choices
**Reason**: The main creation page no longer exposes a visible duration menu before generation.
**Migration**: Keep duration validation, defaults, and agent-provided duration handling internally; do not render duration preset choices in the AI Agent or Manual Prompt tabs.
