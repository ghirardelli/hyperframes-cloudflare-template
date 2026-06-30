## ADDED Requirements

### Requirement: Prompt-agent workflow tools
The system SHALL expose typed prompt-agent tools for starting, inspecting, continuing, and cancelling HyperFrames workflow runs.

#### Scenario: Agent identifies runnable website-to-video request
- **WHEN** the prompt agent routes a user request to `/website-to-video` and the workflow runner is available
- **THEN** the agent can present a workflow start action with selected skill provenance, expected stages, skipped steps, and estimated cost controls

#### Scenario: Agent starts workflow after approval
- **WHEN** the user approves starting a website-to-video workflow from the prompt-agent interface
- **THEN** the prompt agent calls the workflow start tool and returns the created run id and initial status

#### Scenario: Agent checks workflow status
- **WHEN** the prompt agent checks the status of an existing workflow run
- **THEN** the status tool returns compact run state, phase, progress, artifacts, skipped steps, errors, and Studio handoff metadata without mutating the run

### Requirement: Approval boundaries for mutating workflow actions
The system SHALL require explicit user approval before prompt-agent tools start, continue, cancel, or otherwise mutate workflow runs.

#### Scenario: Agent wants to start a run
- **WHEN** the prompt agent determines that a new workflow should be started
- **THEN** the system requires user approval before invoking the start tool

#### Scenario: Agent wants to continue an awaiting-approval run
- **WHEN** a workflow run is awaiting approval for a subsequent phase
- **THEN** the system requires user approval before invoking the continue tool

#### Scenario: Agent wants to poll status
- **WHEN** the prompt agent retrieves workflow status for a run visible to the current user
- **THEN** the system may perform the read-only status lookup without requiring an additional mutation approval

### Requirement: Workflow run user interface feedback
The system SHALL present workflow run progress, artifacts, warnings, and handoff actions in the main TanStack AI experience.

#### Scenario: Workflow is running
- **WHEN** a website-to-video workflow is queued or running
- **THEN** the user interface shows a workflow run card with current phase, progress, and cancellation availability

#### Scenario: Workflow completes
- **WHEN** a website-to-video workflow succeeds
- **THEN** the user interface shows generated artifacts, snapshots, provider-backed media links, skipped steps, and a link to open the generated Studio project

#### Scenario: Workflow fails
- **WHEN** a website-to-video workflow fails
- **THEN** the user interface shows a bounded failure summary and preserves safe partial artifacts or retry guidance when available

### Requirement: Honest skill capability disclosure
The system SHALL align prompt-agent language with the actual workflow runner capabilities for each run.

#### Scenario: Voice is not configured
- **WHEN** the workflow runner has not generated voice or precise timing artifacts
- **THEN** the prompt agent describes those steps as skipped or unavailable and does not claim full upstream `/website-to-video` parity

#### Scenario: Final render has not run
- **WHEN** a workflow has generated validated Studio artifacts but no MP4 render
- **THEN** the prompt agent describes the result as Studio-ready and awaiting explicit render approval

#### Scenario: Skill provenance influences workflow
- **WHEN** the prompt agent starts or reports on a HyperFrames workflow run
- **THEN** the response includes the selected workflow skill id and source revision metadata sufficient for debugging without exposing private credentials
