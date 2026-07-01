# agent-guided-pipeline-wizard Specification

## Purpose

Define the app-owned workflow wizard that presents adaptive HyperFrames pipeline stages, editable artifacts, and stage-scoped AI Agent assistance without modifying Studio internals.
## Requirements
### Requirement: Adaptive pipeline stage plan
The system SHALL create an adaptive user-facing stage plan for agent-guided creation workflows.

#### Scenario: Prompt needs full website pipeline
- **WHEN** the AI Agent classifies a prompt as requiring a website-to-video workflow
- **THEN** the stage plan includes relevant user-facing stages such as Capture, Design, Script, Storyboard, Build, and Validate

#### Scenario: Prompt needs fewer stages
- **WHEN** the AI Agent classifies a prompt as not requiring a full pipeline
- **THEN** the stage plan includes only the stages needed for that creation workflow and marks omitted stages as not included

#### Scenario: Workflow capability is unavailable
- **WHEN** a stage such as VO + Timing or final render is not supported by the selected workflow
- **THEN** the wizard displays the stage as skipped, unavailable, or optional instead of completed

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

### Requirement: Agent-assisted stage updates
The system SHALL let the AI Agent inspect stages and propose bounded updates to editable stage artifacts.

#### Scenario: Agent inspects active stage
- **WHEN** the user asks the AI Agent about the active wizard stage
- **THEN** the agent can read compact, authorized stage context without mutating artifacts

#### Scenario: Agent proposes stage patch
- **WHEN** the agent recommends a change to an editable stage artifact
- **THEN** the wizard shows the affected stage, artifact path, and patch summary before applying the mutation

#### Scenario: User approves agent patch
- **WHEN** the user explicitly approves an agent-proposed stage patch
- **THEN** the system applies the patch, refreshes canonical stage data, and updates the visible stage editor

### Requirement: Stage edit conflict handling
The system SHALL protect unsaved manual edits from being overwritten by agent updates or external artifact changes.

#### Scenario: User has unsaved stage edits
- **WHEN** an agent patch targets an artifact with unsaved manual edits in the wizard
- **THEN** the system warns the user and requires the user to save, discard, or reconcile the manual edit before applying the patch

#### Scenario: Artifact version changed before save
- **WHEN** a user saves a stage artifact that has changed since the form loaded
- **THEN** the system rejects or pauses the save and presents conflict recovery options instead of silently overwriting the newer artifact

### Requirement: Stage validation reruns
The system SHALL allow users or approved agent actions to rerun validation for applicable stages.

#### Scenario: User reruns validation
- **WHEN** a user requests validation for a stage or workflow that supports validation
- **THEN** the system runs the validation path and shows updated pass, warning, or failure results

#### Scenario: Agent wants to rerun validation
- **WHEN** the AI Agent recommends rerunning validation after a stage edit
- **THEN** the system requires user approval before starting the validation mutation

### Requirement: Wizard authorization
The system SHALL enforce tenant and project permissions for wizard route access, stage reads, artifact edits, agent stage tools, and validation actions.

#### Scenario: Authorized user opens wizard
- **WHEN** a user with access to the workflow or owning project opens the wizard
- **THEN** the system returns the stage plan and authorized artifacts for that user

#### Scenario: Unauthorized user opens wizard
- **WHEN** a user without access requests a wizard run, stage artifact, or stage mutation
- **THEN** the system denies the request without exposing cross-tenant or unauthorized project data

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

