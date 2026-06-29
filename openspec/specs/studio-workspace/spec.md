# studio-workspace Specification

## Purpose

Provide an authenticated Studio route for editing, persisting, rendering, and publishing organization-scoped projects with a live HyperFrames preview.

## Requirements

### Requirement: Authenticated Studio route
The system SHALL provide an authenticated Studio route for editing a project in the user's organization.

#### Scenario: User opens own organization project Studio
- **WHEN** an authenticated user opens the Studio route for a project in their organization
- **THEN** the system loads the project session, preview, editing surface, and render controls

#### Scenario: User opens another organization's Studio project
- **WHEN** an authenticated user opens the Studio route for a project outside their organization
- **THEN** the system denies access

### Requirement: Studio editing workspace
The system SHALL provide Studio controls for editing or refining the project composition while preserving a live HyperFrames preview.

#### Scenario: User edits composition source
- **WHEN** a user updates composition source or supported Studio settings
- **THEN** the system updates the project session preview without exposing another organization's data

### Requirement: Studio session persistence
The system SHALL persist Studio session changes to the project before they can be rendered or published.

#### Scenario: User saves Studio changes
- **WHEN** a user saves changes from the Studio workspace
- **THEN** the system stores the latest project source and records update metadata

### Requirement: Studio render flow
The system SHALL render Studio project output through the existing Worker, Container Durable Object, and R2 pipeline.

#### Scenario: User renders from Studio
- **WHEN** a user clicks render in the Studio workspace
- **THEN** the system sends the project's current composition to the render pipeline and records the resulting render under the project organization

### Requirement: Studio publish action
The system SHALL offer a publish action from Studio that publishes only to the user's organization catalog.

#### Scenario: User publishes from Studio
- **WHEN** a user publishes a Studio project
- **THEN** the system creates or updates an organization-visible published project and does not make it public
