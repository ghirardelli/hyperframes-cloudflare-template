## ADDED Requirements

### Requirement: Organization-scoped projects
The system SHALL persist projects with an organization owner, user owner, title, prompt/source data, and timestamps.

#### Scenario: User creates project
- **WHEN** an authenticated user creates a project
- **THEN** the system stores the project under the user's organization and records the user as owner

#### Scenario: User lists projects
- **WHEN** an authenticated user lists projects
- **THEN** the system returns only projects from that user's organization

### Requirement: Tenant project authorization
The system MUST prevent users from reading or mutating projects outside their organization.

#### Scenario: Cross-organization project read
- **WHEN** a user requests a project owned by another organization
- **THEN** the system denies access

#### Scenario: Cross-organization project update
- **WHEN** a user attempts to update a project owned by another organization
- **THEN** the system rejects the mutation and leaves the project unchanged

### Requirement: Persisted generation output
The system SHALL associate generated HyperFrames HTML and generation metadata with a project when generation is requested from a project context.

#### Scenario: User generates from project
- **WHEN** a user submits a prompt for a project
- **THEN** the system generates composition HTML, stores it with the project, and returns preview-ready output

### Requirement: Persisted render output
The system SHALL associate rendered MP4 outputs with the project and organization that requested the render.

#### Scenario: User renders project
- **WHEN** a user renders a project
- **THEN** the system stores the MP4 in R2, records render metadata, and associates the render with the user's organization

### Requirement: Render access checks
The system SHALL enforce organization access when showing render metadata or downloadable render links inside the application.

#### Scenario: User opens render from same organization
- **WHEN** a user opens render metadata for a project in their organization
- **THEN** the system returns the render metadata and accessible download action

#### Scenario: User opens render from different organization
- **WHEN** a user opens render metadata for a project outside their organization
- **THEN** the system denies access
