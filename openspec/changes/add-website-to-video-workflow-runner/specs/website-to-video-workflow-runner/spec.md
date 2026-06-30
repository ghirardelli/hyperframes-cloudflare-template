## ADDED Requirements

### Requirement: Bounded website-to-video pipeline execution
The system SHALL execute `/website-to-video` requests as bounded asynchronous workflows that produce capture-informed Studio artifacts without claiming unavailable full-pipeline parity.

#### Scenario: User starts a website-to-video workflow
- **WHEN** an authenticated user submits a public website URL for the website-to-video workflow
- **THEN** the system validates the request, creates a workflow run, starts asynchronous execution, and returns a run id without blocking the chat turn until completion

#### Scenario: Workflow produces core pipeline artifacts
- **WHEN** the workflow completes the supported pipeline stages
- **THEN** the system persists `DESIGN.md`, `SCRIPT.md`, `STORYBOARD.md`, composition files, lint results, validation results, snapshots, provider metadata, and a Studio project handoff manifest

#### Scenario: Unsupported parity steps remain honest
- **WHEN** voice, precise timing, or final MP4 render steps are not configured for the workflow
- **THEN** the system marks those steps as skipped in the artifact manifest and MUST NOT describe them as completed

### Requirement: Container-backed HyperFrames execution
The system SHALL run browser capture, HyperFrames lint, validation, and snapshot generation inside a Cloudflare Container using an isolated temporary workspace.

#### Scenario: Container runs deterministic HyperFrames steps
- **WHEN** the Worker dispatches a workflow phase to the workflow container
- **THEN** the container runs only the bounded HyperFrames commands required for that phase and returns structured results to the Worker

#### Scenario: Container receives no persistence secrets
- **WHEN** the workflow container executes a job
- **THEN** the container does not receive database credentials, Bunny credentials, R2 credentials, OpenRouter credentials, GitHub credentials, or tenant secrets

#### Scenario: Container workspace is discarded
- **WHEN** a workflow container phase completes, fails, or times out
- **THEN** temporary workspace files are cleaned up or become inaccessible to later unrelated jobs

### Requirement: Studio-ready output handoff
The system SHALL convert successful website-to-video workflow output into project files and assets that can be opened in the existing Studio workspace.

#### Scenario: Successful workflow creates or updates a Studio project
- **WHEN** a website-to-video workflow succeeds
- **THEN** the system creates or updates an organization-scoped Studio project with the generated composition files and links the project to the workflow run

#### Scenario: User opens generated project in Studio
- **WHEN** the user opens the Studio handoff link from a completed workflow run
- **THEN** the Studio loads the generated files and assets under the same organization access controls as other projects

### Requirement: Bunny-backed workflow deliverables
The system SHALL persist website-to-video workflow deliverables through the project storage abstraction, using Bunny Storage and Bunny Stream when configured.

#### Scenario: Workflow writes generated folders and files
- **WHEN** a website-to-video workflow persists generated folders, source files, assets, snapshots, or pipeline artifacts for a Studio project
- **THEN** the system writes eligible bytes through the project storage abstraction under the project's immutable workspace prefix and records provider metadata such as `bunny-storage` or legacy fallback pointers

#### Scenario: Workflow produces a stage video
- **WHEN** a website-to-video workflow produces an approved stage video or playable intermediate video
- **THEN** the system stores the playable video through Bunny Stream when configured and records the Stream library, video id, status, playback metadata, and any archive object pointer

#### Scenario: Bunny is not configured
- **WHEN** Bunny Storage or Bunny Stream is not fully configured for a workflow output
- **THEN** the system uses the existing provider fallback when available or marks the output as failed or skipped without exposing incomplete Bunny metadata

### Requirement: Final render remains explicit
The system SHALL keep final video rendering as an explicit user-approved action after workflow artifact review.

#### Scenario: Workflow validation succeeds
- **WHEN** the workflow has generated artifacts, validation results, and snapshots
- **THEN** the system presents the Studio project and render option without automatically invoking the final render pipeline

#### Scenario: User approves final render later
- **WHEN** the user explicitly starts a render from the generated Studio project
- **THEN** the system uses the existing authenticated render pipeline and records the render under the user's organization, including Bunny Stream metadata when the render integration is configured
