## ADDED Requirements

### Requirement: Form-managed creation intake
The system SHALL manage main creation prompt, context, duration, resolution, and format inputs through TanStack Form while preserving existing manual and agent-assisted generation behavior.

#### Scenario: User edits creation settings
- **WHEN** a user edits prompt, duration, render resolution, or render format in the main creation flow
- **THEN** the form tracks the changed values and validation state for those inputs

#### Scenario: User generates directly
- **WHEN** a user submits a valid prompt through the existing direct manual or agent-approved generation path
- **THEN** the system preserves the current generation behavior and sends the validated form values to the generation mutation

### Requirement: Wizard routing from creation intake
The system SHALL allow suitable creation prompts to route from the main AI Agent intake into an adaptive workflow wizard.

#### Scenario: Agent recommends wizard workflow
- **WHEN** the AI Agent determines that a user's prompt would benefit from a staged HyperFrames pipeline
- **THEN** the system can present a wizard start action with the selected stage plan, project target, and workflow context

#### Scenario: User starts wizard from intake
- **WHEN** the user approves starting the wizard workflow from the main creation intake
- **THEN** the system creates or attaches to the workflow context and routes the user to the wizard page

#### Scenario: Prompt does not need wizard
- **WHEN** the AI Agent determines that the user's prompt is suitable for direct generation
- **THEN** the system keeps the user in the existing main creation flow and does not force a wizard route

### Requirement: Creation context handoff
The system SHALL preserve relevant creation context when routing from the main page into the wizard.

#### Scenario: Wizard starts from populated intake
- **WHEN** a user starts a wizard after entering prompt, duration, gallery context, selected project, resolution, or format values
- **THEN** the wizard receives the relevant context needed to initialize the workflow and stage plan

#### Scenario: User returns from wizard
- **WHEN** a user navigates back from a wizard to the main creation page
- **THEN** the main page preserves or reloads the relevant project and creation state from canonical server data
