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
The system SHALL provide an app-owned wizard route that presents pipeline stages and the AI Agent chat side by side.

#### Scenario: User opens wizard route
- **WHEN** a user opens an authorized workflow wizard
- **THEN** the page shows stage navigation and the active stage editor on the left and a workflow-scoped AI Agent chat on the right

#### Scenario: User selects a stage
- **WHEN** a user selects a stage in the wizard
- **THEN** the stage editor displays that stage's artifacts, status, validation state, and available actions

### Requirement: Manual stage artifact editing
The system SHALL allow authorized users to manually edit editable stage artifacts from the wizard.

#### Scenario: User edits markdown artifact
- **WHEN** a user edits an editable markdown artifact such as `DESIGN.md`, `SCRIPT.md`, or `STORYBOARD.md`
- **THEN** the wizard tracks dirty state and allows the user to save or discard the edit

#### Scenario: User saves stage edit
- **WHEN** a user saves a valid stage artifact edit
- **THEN** the system persists the updated artifact under the authorized workflow or project namespace

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
