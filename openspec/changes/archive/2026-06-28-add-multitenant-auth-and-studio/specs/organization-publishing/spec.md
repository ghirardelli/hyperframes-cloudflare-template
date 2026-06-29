## ADDED Requirements

### Requirement: Organization-only publishing
The system SHALL allow users to publish projects only to their assigned organization.

#### Scenario: User publishes project
- **WHEN** a user publishes a project from their organization
- **THEN** the system makes the project visible in that organization's playground/catalog

#### Scenario: User attempts cross-organization publish
- **WHEN** a user attempts to publish a project owned by another organization
- **THEN** the system rejects the publish request

### Requirement: Organization playground catalog
The system SHALL provide an organization playground page with examples, a catalog count, project cards, metadata, and remix/open actions inspired by HyperFrames' Community Playground structure.

#### Scenario: User opens organization playground
- **WHEN** an authenticated user opens the playground page
- **THEN** the system displays only examples and published projects visible to that user's organization

#### Scenario: Catalog count renders
- **WHEN** the organization playground loads
- **THEN** the system displays a catalog count based on organization-visible published projects and seeded examples

### Requirement: Organization-only remix
The system SHALL allow users to remix organization-visible published projects into new projects within the same organization.

#### Scenario: User remixes organization project
- **WHEN** a user clicks remix on an organization-visible project
- **THEN** the system creates a new project in the user's organization using the published source snapshot

#### Scenario: User remixes inaccessible project
- **WHEN** a user attempts to remix a project not visible to their organization
- **THEN** the system denies access and does not create a project

### Requirement: Publish metadata
The system SHALL store publish metadata including title, description, thumbnail or poster reference, duration, resolution, publisher, and publish timestamp.

#### Scenario: Project is published
- **WHEN** a project is published
- **THEN** the system records catalog metadata needed for the organization playground card

### Requirement: Unpublish
The system SHALL allow authorized users to unpublish organization-visible projects.

#### Scenario: User unpublishes project
- **WHEN** an authorized user unpublishes a project
- **THEN** the system removes the project from the organization playground without deleting the underlying project
