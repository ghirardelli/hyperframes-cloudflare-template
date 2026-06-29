## ADDED Requirements

### Requirement: Workspace render settings
The system SHALL preserve supported render settings from workspace render controls through the existing Worker, Container Durable Object, and R2 render pipeline.

#### Scenario: Main page render includes output dimensions
- **WHEN** a user renders from the main page with an export resolution selected
- **THEN** the render pipeline receives the selected output `width` and `height` while preserving organization-scoped project access

#### Scenario: Main page render includes output format
- **WHEN** a user renders from the main page with an export format selected
- **THEN** the render pipeline receives the selected `format` while preserving organization-scoped project access

#### Scenario: Invalid render settings are rejected
- **WHEN** a workspace render request includes unsupported dimensions or format
- **THEN** the Worker rejects the request before calling the Container render pipeline
