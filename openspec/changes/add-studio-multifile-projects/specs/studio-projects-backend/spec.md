## ADDED Requirements

### Requirement: Worker-hosted Studio API
The system SHALL host the Studio API on the Worker using the `@hyperframes/studio-server` Hono app with a host adapter, mounted behind authentication so only authenticated users can reach it.

#### Scenario: Authenticated request to the Studio API
- **WHEN** an authenticated user calls a Studio API route
- **THEN** the system serves the request through the mounted Studio API

#### Scenario: Unauthenticated request to the Studio API
- **WHEN** an unauthenticated request hits a Studio API route
- **THEN** the system denies access

### Requirement: Organization-scoped project resolution
The system SHALL resolve and list projects through the adapter filtered to the requesting user's organization.

#### Scenario: List projects
- **WHEN** the Studio API lists projects for a user
- **THEN** it returns only projects in that user's organization

#### Scenario: Resolve a cross-organization project
- **WHEN** the Studio API resolves a project id owned by another organization
- **THEN** it does not resolve the project and access is denied

### Requirement: Composition bundling and preview
The system SHALL bundle a project's source files into preview HTML (including sub-composition pages) with the HyperFrames runtime injected, served from a same-origin preview route.

#### Scenario: Preview the index composition
- **WHEN** the Studio requests a project preview
- **THEN** the system returns preview HTML assembled from the project's files with the runtime injected

#### Scenario: Preview a sub-composition
- **WHEN** the Studio requests a sub-composition preview by path
- **THEN** the system returns a standalone preview page for that sub-composition

### Requirement: Asset serving
The system SHALL serve a project's stored assets with correct content types, scoped to the owning organization.

#### Scenario: Serve a project asset
- **WHEN** an authenticated user in the owning organization requests a project asset
- **THEN** the system returns the asset with the correct MIME type

#### Scenario: Cross-organization asset request
- **WHEN** a user requests an asset for a project outside their organization
- **THEN** the system denies access

### Requirement: Lint
The system SHALL lint composition HTML through the adapter and return findings to the Studio.

#### Scenario: Lint a composition
- **WHEN** the Studio requests a lint of composition HTML
- **THEN** the system returns lint findings

### Requirement: Render delegation and progress
The system SHALL start render jobs through the adapter against the existing render pipeline and expose render progress, mapping format, fps, quality, resolution, and entry composition from the request.

#### Scenario: Start a render from the Studio API
- **WHEN** the Studio starts a render with an entry composition and settings
- **THEN** the system runs the render through the existing Container and R2 pipeline and records the render under the project's organization

#### Scenario: Report render progress
- **WHEN** a render job is in progress
- **THEN** the system reports the job's status and progress to the Studio
