## MODIFIED Requirements

### Requirement: Organization-scoped projects
The system SHALL persist projects with an organization owner, user owner, title, optional short description, prompt/source data, visibility, and timestamps. Projects SHALL default to owner-private visibility while remaining constrained to the owning organization.

#### Scenario: User creates project
- **WHEN** an authenticated user creates a project with a title and optional description
- **THEN** the system stores the project under the user's organization, records the user as owner, persists the title and optional description, and marks the project private by default

#### Scenario: User lists projects
- **WHEN** an authenticated user lists projects
- **THEN** the system returns only projects from the user's organization that the user owns, has explicit access to, can administer, or that are shared with the organization, including each returned project's title and optional description

## ADDED Requirements

### Requirement: Project metadata management
The system SHALL allow authorized project editors to name projects/videos and add, update, or clear optional short descriptions.

#### Scenario: Editor updates project metadata
- **WHEN** an authorized editor updates a project's title or description
- **THEN** the system persists the metadata, updates the project timestamp, and returns the updated project metadata

#### Scenario: Viewer updates project metadata
- **WHEN** a user without edit permission attempts to update a project's title or description
- **THEN** the system rejects the mutation and leaves the project metadata unchanged

#### Scenario: Description is omitted
- **WHEN** a project is created or updated without a description
- **THEN** the system stores the description as empty or null while keeping the project valid

### Requirement: Project metadata search
The system SHALL include project names and descriptions in permission-filtered project search.

#### Scenario: Search matches project description
- **WHEN** a user searches for text that matches the description of a project they can access
- **THEN** the system returns that project in search results

#### Scenario: Search matches inaccessible project description
- **WHEN** a user searches for text that matches the description of a project they cannot access
- **THEN** the system does not return that project or reveal that the match exists
