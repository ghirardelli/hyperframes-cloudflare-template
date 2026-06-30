## MODIFIED Requirements

### Requirement: Authenticated Studio route
The system SHALL provide an authenticated Studio route for editing a project the user is permitted to access through ownership, explicit project membership, organization sharing, or organization administration.

#### Scenario: User opens accessible Studio project
- **WHEN** an authenticated user opens the Studio route for a project they can access
- **THEN** the system loads the project session, preview, editing surface, file tree, render controls, and share state

#### Scenario: User opens inaccessible Studio project
- **WHEN** an authenticated user opens a Studio route for a project they cannot access
- **THEN** the system denies access

### Requirement: Studio editing workspace
The system SHALL provide Studio controls for editing or refining project entries while preserving a live HyperFrames preview and enforcing project permissions.

#### Scenario: User edits composition source
- **WHEN** an authorized editor updates composition source or supported Studio settings
- **THEN** the system updates the project session preview without exposing inaccessible project data

#### Scenario: Viewer edits composition source
- **WHEN** a viewer attempts to save composition source or settings
- **THEN** the system rejects the mutation

### Requirement: Studio session persistence
The system SHALL persist Studio session changes as project entries and entry versions before they can be rendered or published.

#### Scenario: User saves Studio changes
- **WHEN** an authorized editor saves changes from the Studio workspace
- **THEN** the system stores the latest project entry data, records update metadata, and creates a version record

### Requirement: Studio render flow
The system SHALL render Studio project output through the existing render execution path and persist final playable output through Bunny Stream.

#### Scenario: User renders from Studio
- **WHEN** an authorized user clicks render in the Studio workspace
- **THEN** the system sends the selected project snapshot to the render pipeline, uploads the final video to Bunny Stream, and records the resulting render under the project organization

### Requirement: Studio publish action
The system SHALL offer a publish action from Studio that publishes only to the user's organization catalog using an authorized project snapshot.

#### Scenario: User publishes from Studio
- **WHEN** an authorized user publishes a Studio project
- **THEN** the system creates or updates an organization-visible published project from a recorded project snapshot and does not make it public outside the organization

## ADDED Requirements

### Requirement: Studio logical file tree
The system SHALL show Studio project files and folders from the DB-authoritative project entry tree, including empty folders and Bunny-backed assets.

#### Scenario: User opens file tree
- **WHEN** a user opens a project in Studio
- **THEN** the Studio lists accessible project entries from the database with logical paths, kinds, artifact roles, and modified metadata

#### Scenario: User uploads asset in Studio
- **WHEN** an authorized editor uploads an asset from Studio
- **THEN** the server writes the asset bytes to Bunny Storage, records the project entry, and refreshes the Studio tree

### Requirement: Studio version history
The system SHALL let authorized users inspect project entry versions and let authorized editors restore versions or snapshots.

#### Scenario: User opens version history
- **WHEN** a user with read access opens version history for a project entry
- **THEN** the Studio shows version metadata for that entry without exposing inaccessible projects

#### Scenario: Editor restores snapshot
- **WHEN** an authorized editor restores a project snapshot
- **THEN** the Studio reloads the restored project tree and preserves a new restore version

### Requirement: Studio project search
The system SHALL let users search accessible projects and entries from Studio without returning inaccessible project data.

#### Scenario: User searches files
- **WHEN** a user searches from Studio
- **THEN** the system returns only matching projects and entries the user can read

### Requirement: Studio sharing controls
The system SHALL show project sharing state in Studio and allow authorized users to change organization sharing or explicit project members.

#### Scenario: Owner shares from Studio
- **WHEN** a project owner shares the project with the organization from Studio
- **THEN** the system updates project visibility, records audit metadata, and grants organization members read access to the project tree

#### Scenario: Viewer opens sharing controls
- **WHEN** a viewer opens sharing controls
- **THEN** the Studio shows read-only sharing state and disables permission mutations
