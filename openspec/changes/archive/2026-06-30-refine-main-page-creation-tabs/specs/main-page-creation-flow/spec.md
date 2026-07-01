## ADDED Requirements

### Requirement: Three-tab creation workflow
The system SHALL present AI Agent, Manual Prompt, and Render as a single tabbed workflow on the main page, with Render in the last tab position.

#### Scenario: User sees Render in the tab menu
- **WHEN** a user opens the main page creation panel
- **THEN** the tab menu shows AI Agent, Manual Prompt, and Render in that order

#### Scenario: User opens Render tab
- **WHEN** a user selects the Render tab
- **THEN** the panel shows render resolution, format, render, reset, download, and selected export summary controls without showing the AI Agent chat input or Manual Prompt textarea as the primary tab content

#### Scenario: Render tab does not overwrite creation preference
- **WHEN** a user selects the Render tab after selecting AI Agent or Manual Prompt
- **THEN** the remembered new-project creation mode remains the last selected AI Agent or Manual Prompt mode, not Render

### Requirement: Render controls inside tab workflow
The system SHALL move existing render controls from the separate Export card into the Render tab while preserving render behavior.

#### Scenario: User changes render settings in Render tab
- **WHEN** a user selects a render resolution and output format in the Render tab
- **THEN** the next render request includes the selected `width`, `height`, and `format`

#### Scenario: User renders generated preview from Render tab
- **WHEN** a generated preview or bundled composition is available and the user clicks Render in the Render tab
- **THEN** the system renders through the existing Worker, Container Durable Object, and R2 pipeline

#### Scenario: User downloads rendered output from Render tab
- **WHEN** a render completes successfully
- **THEN** the Render tab exposes the download action for the selected output format

### Requirement: Expanded duration choices
The system SHALL expose duration options up to 5 minutes and accept those durations through manual and agent-assisted generation.

#### Scenario: User opens duration menu
- **WHEN** a user opens the duration control
- **THEN** the available choices include 30 seconds, 1 minute, 2 minutes, 3 minutes, 4 minutes, and 5 minutes in addition to the existing short-form options

#### Scenario: User generates with a long duration manually
- **WHEN** a user selects a duration greater than 2 minutes and generates from Manual Prompt mode
- **THEN** the generation request preserves the selected `durationSec` value without clamping it below the selected duration

#### Scenario: User asks the agent with a long duration
- **WHEN** a user selects a duration greater than 2 minutes and sends an AI Agent message
- **THEN** the prompt-agent request and approved generation path preserve the selected `durationSec` value

### Requirement: Quiet idle state
The system SHALL remove non-actionable idle status copy from the bottom of the main page while preserving meaningful feedback.

#### Scenario: Bundled composition is idle
- **WHEN** the main page is showing the default bundled composition and no generation or render action has occurred
- **THEN** the page does not show a bottom status box that only says "Bundled composition loaded."

#### Scenario: Action feedback is available
- **WHEN** generation, render, error, lint, or download feedback is relevant
- **THEN** the page shows concise actionable status feedback in the relevant workflow context

### Requirement: Chat-style agent workspace
The system SHALL present the AI Agent tab as a chat-style workspace with the conversation stream above and the composer anchored at the bottom.

#### Scenario: AI Agent tab is empty
- **WHEN** a user opens the AI Agent tab before any messages exist
- **THEN** the tab shows helper text for asking the agent without wrapping that helper text in a border that resembles an input field

#### Scenario: Agent streams response
- **WHEN** the AI Agent is generating or streaming a response
- **THEN** the response appears in the conversation stream above the composer

#### Scenario: User composes a message
- **WHEN** a user types into the Ask the agent field
- **THEN** the composer remains at the bottom of the AI Agent tab with the Send action adjacent to or visually grouped with the input

### Requirement: Inline prompt proposal approval
The system SHALL show agent-suggested prompts and approval actions inside the chat stream instead of in a separate suggested prompt box.

#### Scenario: Agent proposes a prompt
- **WHEN** the agent prepares a structured prompt package
- **THEN** the proposed prompt, duration, checklist, and assistant explanation appear as an assistant artifact in the chat stream

#### Scenario: Agent asks for confirmation
- **WHEN** the agent proposes a prompt for the HyperFrame video
- **THEN** the agent asks whether the user is happy with the proposed prompt before running generation

#### Scenario: User approves generation
- **WHEN** the agent has an approved generation tool request ready
- **THEN** the chat stream shows an Apply or Approve action that the user can click to run the prompt and create the HyperFrame video

#### Scenario: User applies prompt to manual flow
- **WHEN** the user applies a proposed prompt without immediately generating
- **THEN** the canonical prompt state updates so Manual Prompt mode contains the applied prompt
