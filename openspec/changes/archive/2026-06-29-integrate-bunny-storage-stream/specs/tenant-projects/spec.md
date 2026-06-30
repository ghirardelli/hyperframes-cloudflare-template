## MODIFIED Requirements

### Requirement: Organization-scoped projects
The system SHALL persist projects with an organization owner, user owner, title, prompt/source data, visibility, and timestamps. Projects SHALL default to owner-private visibility while remaining constrained to the owning organization.

#### Scenario: User creates project
- **WHEN** an authenticated user creates a project
- **THEN** the system stores the project under the user's organization, records the user as owner, and marks the project private by default

#### Scenario: User lists projects
- **WHEN** an authenticated user lists projects
- **THEN** the system returns only projects from the user's organization that the user owns, has explicit access to, can administer, or that are shared with the organization

### Requirement: Tenant project authorization
The system MUST prevent users from reading or mutating projects outside their organization and MUST enforce owner, explicit member, organization-shared, and organization-admin permissions for projects inside the organization.

#### Scenario: Cross-organization project read
- **WHEN** a user requests a project owned by another organization
- **THEN** the system denies access

#### Scenario: Cross-organization project update
- **WHEN** a user attempts to update a project owned by another organization
- **THEN** the system rejects the mutation and leaves the project unchanged

#### Scenario: Same-organization private project read
- **WHEN** an organization member who is not the owner, project member, or organization admin requests a private project
- **THEN** the system denies access

### Requirement: Persisted generation output
The system SHALL associate generated HyperFrames output and generation metadata with a project's source file tree and version history when generation is requested from a project context.

#### Scenario: User generates from project
- **WHEN** a user submits a prompt for a project
- **THEN** the system generates composition HTML, stores it as a project entry, records generation metadata, creates a version or snapshot, and returns preview-ready output

### Requirement: Persisted render output
The system SHALL associate rendered video outputs with the project and organization that requested the render, storing final playable video metadata in Bunny Stream and optional archive object metadata in Bunny Storage.

#### Scenario: User renders project
- **WHEN** a user renders a project
- **THEN** the system uploads the final video to Bunny Stream, records render metadata and provider pointers, and associates the render with the user's organization and project

### Requirement: Render access checks
The system SHALL enforce project permissions when showing render metadata or playback/download actions inside the application.

#### Scenario: User opens render from accessible project
- **WHEN** a user opens render metadata for a project they can access
- **THEN** the system returns the render metadata and authorized playback or download action

#### Scenario: User opens render without project access
- **WHEN** a user requests render metadata for a project they cannot access
- **THEN** the system denies access

## ADDED Requirements

### Requirement: Project entry namespace
The system SHALL store every project file, folder, asset, pipeline artifact, and render reference as a project entry under the owning organization, user owner, and project.

#### Scenario: Pipeline creates multiple folders
- **WHEN** a HyperFrames pipeline creates a project structure with folders and files
- **THEN** the system records each folder and file as a project entry under the project namespace

#### Scenario: Entry path is invalid
- **WHEN** a request supplies an absolute path, parent traversal, empty segment, or reserved path prefix
- **THEN** the system rejects the entry mutation
