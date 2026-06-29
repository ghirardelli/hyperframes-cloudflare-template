## MODIFIED Requirements

### Requirement: Persisted generation output
The system SHALL associate generated HyperFrames output with a project's source file tree (seeding the project's `index.html`) and store generation metadata when generation is requested from a project context.

#### Scenario: User generates from project
- **WHEN** a user submits a prompt for a project
- **THEN** the system generates composition HTML, stores it as the project's `index.html` source file, and returns preview-ready output

## ADDED Requirements

### Requirement: Multi-file project source persistence
The system SHALL persist a project's source as an organization-scoped tree of source files keyed by path, supporting create, read, update, rename, move, and delete, with organization authorization on every operation.

#### Scenario: User saves multiple source files
- **WHEN** a user saves changes across one or more of a project's source files
- **THEN** the system persists each file under the project within the user's organization

#### Scenario: Cross-organization file access
- **WHEN** a user attempts to read or mutate source files of a project outside their organization
- **THEN** the system denies access

### Requirement: Organization-scoped asset storage
The system SHALL store binary project assets in object storage under an organization/project prefix and enforce organization access on asset reads and writes.

#### Scenario: User uploads a project asset
- **WHEN** a user uploads an asset for a project in their organization
- **THEN** the system stores the asset under that organization's prefix and associates it with the project

#### Scenario: Cross-organization asset access
- **WHEN** a user requests an asset for a project outside their organization
- **THEN** the system denies access

### Requirement: Migration from single-HTML projects
The system SHALL migrate existing single-composition projects into the multi-file model without data loss by seeding each project's `index.html` from its existing composition.

#### Scenario: Existing project is migrated
- **WHEN** the multi-file model is deployed
- **THEN** each existing project gains an `index.html` source file containing its prior composition, and its renders and published entries remain intact
