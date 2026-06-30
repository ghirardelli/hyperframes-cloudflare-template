## ADDED Requirements

### Requirement: Tenant-scoped workflow runs
The system SHALL persist workflow runs with tenant, user, project, skill, status, phase, input, artifact, error, and timestamp metadata.

#### Scenario: Workflow run is created
- **WHEN** an authenticated user starts a website-to-video workflow
- **THEN** the system stores the run under the user's organization and records the initiating user, selected skill id, input URL, initial status, and creation timestamp

#### Scenario: User requests run status
- **WHEN** an authenticated user requests a workflow run by id
- **THEN** the system returns the run only if it belongs to the user's organization

#### Scenario: User requests another organization's run
- **WHEN** an authenticated user requests a workflow run outside their organization
- **THEN** the system denies access and does not reveal whether the run id exists

### Requirement: Workflow lifecycle transitions
The system SHALL enforce valid workflow status transitions for queued, running, awaiting approval, succeeded, failed, and cancelled runs.

#### Scenario: Run progresses through phases
- **WHEN** a workflow advances from preflight through capture, compose, validate, persist, and completion
- **THEN** the system updates phase and progress metadata in a way that status polling can display

#### Scenario: Run fails
- **WHEN** a workflow phase fails validation, exceeds limits, or returns an execution error
- **THEN** the system records status `failed`, stores a bounded error summary, preserves any safe partial artifacts, and stops further automatic phases

#### Scenario: Run is cancelled
- **WHEN** a user cancels a queued, running, or awaiting-approval workflow run
- **THEN** the system records status `cancelled`, prevents further automatic phase execution, and reports cancellation in future status responses

### Requirement: Artifact and log persistence
The system SHALL persist workflow artifacts and logs as bounded manifests, storing large files through the project storage abstraction and returning compact references through APIs and tools.

#### Scenario: Workflow produces large artifacts
- **WHEN** snapshots, capture assets, or generated files exceed inline response limits
- **THEN** the system stores them through the configured storage provider, preferring Bunny Storage project workspace keys when available, and returns metadata references instead of embedding large payloads in API responses

#### Scenario: Workflow produces video media
- **WHEN** a workflow output is a playable stage video or final render record
- **THEN** the system stores playback media through Bunny Stream when configured and records Stream metadata in the workflow artifact manifest

#### Scenario: Logs are recorded
- **WHEN** the workflow records execution logs or command output
- **THEN** the system redacts secrets, truncates logs to configured limits, and exposes only safe summaries to the user interface and prompt-agent tools

### Requirement: Cost and safety limits
The system SHALL enforce workflow cost, concurrency, duration, URL safety, and artifact size limits before and during execution.

#### Scenario: URL fails safety validation
- **WHEN** a user submits a localhost, private-network, link-local, metadata-service, unsupported-scheme, or unsafe redirected URL
- **THEN** the system rejects the workflow before starting container execution

#### Scenario: Tenant exceeds workflow quota
- **WHEN** an organization exceeds configured workflow concurrency or rate limits
- **THEN** the system rejects or delays new workflow starts and returns a clear quota status

#### Scenario: Workflow exceeds execution limits
- **WHEN** a workflow exceeds configured duration, file count, artifact byte, screenshot count, or log size limits
- **THEN** the system stops the affected phase and records a failed run with a bounded explanation

#### Scenario: Capture cache is available
- **WHEN** a matching non-expired capture result exists for the normalized URL and viewport options
- **THEN** the system may reuse the cached capture artifact instead of starting a new browser capture container phase
