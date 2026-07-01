## Purpose

Define the main page creation workflow for prompting, agent-assisted prompt refinement, and rendering HyperFrame videos.
## Requirements
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

### Requirement: Form-managed creation intake
The system SHALL manage main creation prompt, selected context, duration, project target, and submit state through TanStack Form while routing valid submissions to workflow creation.

#### Scenario: User edits creation settings
- **WHEN** a user edits prompt, duration, selected template context, selected component context, or project target in the main creation intake
- **THEN** the form tracks the changed values and validation state for those inputs

#### Scenario: User submits intake
- **WHEN** a user submits a valid main creation intake
- **THEN** the system sends validated form values to workflow creation and does not run direct HyperFrame generation from the main page

### Requirement: Wizard routing from creation intake
The system SHALL route valid main-page intake submissions directly into an adaptive workflow wizard.

#### Scenario: User starts wizard from intake
- **WHEN** a user clicks Send from the main creation intake with a valid prompt
- **THEN** the system creates or attaches to a workflow context and routes the user to `/workflows/:runId`

#### Scenario: Prompt requires detailed workflow
- **WHEN** the workflow opens from main-page intake
- **THEN** the wizard presents the selected stage plan, project target, and workflow context without requiring the user to return to the main page

#### Scenario: Prompt can be simple
- **WHEN** the user's prompt is suitable for a shorter workflow
- **THEN** the created workflow run may use a reduced stage plan but still opens in the wizard

### Requirement: Creation context handoff
The system SHALL preserve relevant creation context when routing from the main page into the wizard.

#### Scenario: Wizard starts from populated intake
- **WHEN** a user starts a wizard after entering prompt, duration, selected templates, selected components, component placement intent, selected project, resolution, or format values
- **THEN** the wizard receives the relevant context needed to initialize the workflow, active stage form, selected context summary, and stage plan

#### Scenario: User returns from wizard
- **WHEN** a user navigates back from a wizard to the main creation page
- **THEN** the main page preserves or reloads relevant project and workflow state from canonical server data where available

### Requirement: Selected components expose materialization state
The main page creation workflow SHALL distinguish selected gallery items that are prompt-only references from selected components that can be materialized as real HyperFrames project blocks.

#### Scenario: User selects materializable component
- **WHEN** a user selects a materializable catalog component such as App Showcase
- **THEN** the selected context UI indicates that the component can be installed into the project as a real block rather than only used as prompt inspiration

#### Scenario: User selects prompt-only example
- **WHEN** a user selects a gallery example or non-materializable component
- **THEN** the selected context UI indicates that it will be used as prompt/reference context and not installed as a project file

### Requirement: User can provide component placement intent
The main page creation workflow SHALL allow users to express where selected materializable components should appear in the video without requiring them to write raw HyperFrames host snippets by hand.

#### Scenario: User describes placement in prompt
- **WHEN** a user writes that App Showcase should be used as the opening scene
- **THEN** the AI Agent receives that placement intent along with the selected component id and trusted usage metadata

#### Scenario: User provides no placement details
- **WHEN** a user selects a materializable component but does not specify placement
- **THEN** the AI Agent may propose a sensible placement for user approval before materializing the component into project files

### Requirement: Manual prompt preserves trusted component instructions
Manual Prompt mode SHALL make it clear that adding selected materializable component context does not require the user to paste or invent component internals.

#### Scenario: User adds selected component to manual prompt
- **WHEN** a user clicks Add to prompt for a materializable component
- **THEN** the appended prompt text identifies the component id, trusted usage snippet, and instruction to use the registry-authored block instead of recreating its HTML

#### Scenario: User generates with selected materializable component
- **WHEN** a user generates manually with a selected materializable component and real component use enabled
- **THEN** the generation request carries component selection metadata so the server can validate or materialize trusted files instead of relying only on prose in the prompt

### Requirement: Agent flow uses selected components as build inputs
The AI Agent flow SHALL treat selected materializable components as available build inputs and route real project mutation through the approved materialization boundary.

#### Scenario: Agent prepares prompt with selected component
- **WHEN** the AI Agent prepares a prompt package using App Showcase
- **THEN** the prompt package references App Showcase by component id and intended placement, and does not instruct the generation model to author App Showcase internals

#### Scenario: Agent wants to install selected component
- **WHEN** the AI Agent wants to use a selected materializable component in the project
- **THEN** the chat stream presents an approval action for the materialization/generation mutation before the component files or host snippets are written

### Requirement: Chat-first workflow intake
The system SHALL present the authenticated main page as a compact AI chat intake for starting a new HyperFrame workflow.

#### Scenario: User opens the main page
- **WHEN** an authenticated user opens the main page
- **THEN** the primary surface shows one dominant chat composer for describing the desired HyperFrame and does not show manual prompt, render, preview, or gallery tabs as competing primary actions

#### Scenario: Intake layout uses compact density
- **WHEN** the main page renders on desktop
- **THEN** the page uses compact operational text, restrained padding, and clear block-level separation so the chat composer, context controls, and template rail remain visually distinct

#### Scenario: User enters a creation prompt
- **WHEN** a user types into the main chat composer
- **THEN** the system tracks the prompt as the workflow intake prompt without sending an agent chat turn before the user clicks Send

### Requirement: Template rail context picker
The system SHALL expose launch-video examples as user-facing templates in a compact horizontal rail below the main chat composer.

#### Scenario: User sees templates
- **WHEN** an authenticated user opens the main page
- **THEN** the page labels the launch-video example cards as templates and presents them in a horizontally scrollable rail

#### Scenario: User selects a template
- **WHEN** a user selects a template card
- **THEN** the page records the template as selected workflow context and displays it in the selected context summary

#### Scenario: User clears a template
- **WHEN** a user removes a selected template from the selected context summary
- **THEN** subsequent workflow creation requests no longer include that template

### Requirement: Component palette context picker
The system SHALL expose HyperFrames components through a compact picker opened from the main chat composer.

#### Scenario: User opens component picker
- **WHEN** a user activates the components control in the main chat composer
- **THEN** the page opens a compact component picker with search or filtering and selectable component cards

#### Scenario: User selects a component
- **WHEN** a user selects a component from the picker
- **THEN** the page records the component id, name, source URL, prompt text, materialization state, and any placement intent as selected workflow context

#### Scenario: Component picker closes
- **WHEN** the user closes the component picker
- **THEN** the selected components remain visible in the selected context summary without taking over the main page layout

### Requirement: Send creates workflow run
The system SHALL create a workflow run and navigate to `/workflows/:runId` when the user submits a valid main-page intake prompt.

#### Scenario: User sends valid intake
- **WHEN** a user enters a valid prompt and clicks Send
- **THEN** the system creates a workflow run with the intake prompt and selected context, then navigates to `/workflows/:runId` for the created run

#### Scenario: Send includes selected context
- **WHEN** a user clicks Send after selecting templates or components
- **THEN** the workflow creation request includes the selected template ids, selected component ids, component materialization metadata, placement intent, duration, and active project target when present

#### Scenario: Workflow creation fails
- **WHEN** the workflow creation request fails
- **THEN** the user remains on the main page and sees concise recoverable error feedback near the chat intake

