## ADDED Requirements

### Requirement: Intake workflow run state
The system SHALL support workflow runs created from main-page intake before expensive workflow execution starts.

#### Scenario: Workflow run created from main-page Send
- **WHEN** the main page creates a workflow run from chat intake
- **THEN** the workflow run is stored with intake prompt, selected context, project target, and stage-plan seed data without starting container execution before the wizard opens

#### Scenario: User opens intake run
- **WHEN** the user is routed to `/workflows/:runId` for a newly created intake run
- **THEN** the wizard loads the run, active stage, and editable intake form from canonical server data

#### Scenario: User advances from intake
- **WHEN** the user reviews the initial wizard form and chooses to continue
- **THEN** the system starts or continues the workflow execution through an explicit wizard action

### Requirement: Initial creative brief form
The system SHALL show a friendly multi-field creative brief form as the first editable wizard surface for runs created from main-page intake.

#### Scenario: Creative brief prefilled
- **WHEN** a workflow run opens from main-page intake
- **THEN** the initial wizard form is prefilled with the user's prompt, selected templates, selected components, placement intent, duration, and project target where available

#### Scenario: User edits creative brief
- **WHEN** a user edits the creative brief form
- **THEN** the wizard tracks dirty state and allows the user to save, discard, or continue according to validation state

#### Scenario: User reviews selected context
- **WHEN** selected templates or components exist on the workflow run
- **THEN** the creative brief form shows them as compact editable or removable context items without requiring raw HyperFrames snippets

### Requirement: Compact wizard density
The system SHALL use a compact layout density for workflow wizard forms and stage navigation.

#### Scenario: Desktop wizard layout
- **WHEN** the workflow wizard renders on desktop
- **THEN** it presents stage navigation, active-stage form or editor content, and workflow-scoped agent assistance in clearly separated compact regions

#### Scenario: Compact spacing remains readable
- **WHEN** the wizard displays multiple fields, stage items, and agent messages
- **THEN** it uses smaller operational text and tighter internal padding while preserving clear block-level spacing, panel borders, and non-overlapping content

#### Scenario: Narrow wizard layout
- **WHEN** the workflow wizard renders on a narrow viewport
- **THEN** the stage navigation, active form, and agent regions collapse into a readable stacked or tabbed layout without horizontal overflow

## MODIFIED Requirements

### Requirement: Two-column wizard workspace
The system SHALL provide an app-owned wizard route that presents stage navigation, the active stage form or editor, and workflow-scoped AI Agent assistance in a compact workspace.

#### Scenario: User opens wizard route
- **WHEN** a user opens an authorized workflow wizard
- **THEN** the page shows stage navigation, the active stage form or artifact editor, and workflow-scoped AI Agent chat in clearly separated regions

#### Scenario: User selects a stage
- **WHEN** a user selects a stage in the wizard
- **THEN** the stage workspace displays that stage's form fields or artifacts, status, validation state, and available actions

#### Scenario: User opens run from main-page intake
- **WHEN** the wizard route is opened immediately after main-page Send
- **THEN** the page shows the first actionable wizard form instead of a raw artifact editor when the workflow has not produced editable artifacts yet

### Requirement: Manual stage artifact editing
The system SHALL allow authorized users to manually edit editable stage artifacts from the wizard while also supporting form-based stages that are not raw artifacts.

#### Scenario: User edits markdown artifact
- **WHEN** a user edits an editable markdown artifact such as `DESIGN.md`, `SCRIPT.md`, or `STORYBOARD.md`
- **THEN** the wizard tracks dirty state and allows the user to save or discard the edit

#### Scenario: User saves stage edit
- **WHEN** a user saves a valid stage artifact edit
- **THEN** the system persists the updated artifact under the authorized workflow or project namespace

#### Scenario: User edits form-based stage
- **WHEN** a user edits an intake or stage form that is backed by workflow metadata rather than a raw artifact file
- **THEN** the wizard validates and persists the form through the authorized workflow API without requiring an artifact path
