## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Three-tab creation workflow
**Reason**: The main page is no longer a tabbed AI Agent, Manual Prompt, and Render workbench.
**Migration**: The main page becomes a chat-first workflow intake; detailed prompting, editing, validation, and render decisions move into the workflow wizard or Studio.

### Requirement: Render controls inside tab workflow
**Reason**: Render controls no longer belong on the main-page intake surface.
**Migration**: Render/export controls remain available after workflow artifact review through the wizard, Studio, or existing render surfaces.

### Requirement: Chat-style agent workspace
**Reason**: The main page no longer hosts a full agent conversation stream; it hosts a compact intake composer.
**Migration**: Full conversation history and stage-scoped agent assistance are provided in `/workflows/:runId`.

### Requirement: Inline prompt proposal approval
**Reason**: Main-page Send now creates a workflow run immediately instead of asking the agent to propose and approve a prompt package inline.
**Migration**: Prompt proposal, patch approval, materialization approval, and validation approval happen inside the workflow wizard's stage-scoped agent.

### Requirement: Examples and Components bento picker
**Reason**: The large bento picker made the main page feel like a catalog workspace instead of an intake screen.
**Migration**: Examples become user-facing templates in a horizontal rail, and components move into a compact composer palette.

### Requirement: Launch-video example selection
**Reason**: User-facing launch-video examples are now presented as templates, not as an Examples gallery tab.
**Migration**: Template selection preserves the same source context and forwards it into workflow creation.

### Requirement: Component browsing and detail modal
**Reason**: The main page no longer exposes a full Components gallery and modal as a primary workspace.
**Migration**: Component selection moves into the compact component picker; deeper component details may remain available from picker cards when needed.

### Requirement: Component selection for generation prompts
**Reason**: Selected components now feed workflow intake context instead of direct main-page generation prompts.
**Migration**: Component metadata is carried into workflow creation and wizard-stage agent context.

### Requirement: Generated output actions remain available
**Reason**: Generated preview, render, and Studio handoff are no longer main-page default workspace actions.
**Migration**: Workflow and Studio surfaces own generated output review, render/export, and handoff actions after the intake route.

### Requirement: Returnable post-generation preview
**Reason**: Successful generation no longer switches the main-page gallery to a preview player.
**Migration**: Preview and review happen in the workflow wizard or Studio after workflow creation.
