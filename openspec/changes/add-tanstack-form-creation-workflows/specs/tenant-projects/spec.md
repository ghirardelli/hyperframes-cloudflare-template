## ADDED Requirements

### Requirement: Form-managed project metadata editing
The system SHALL manage inline project metadata edit state, validation feedback, dirty state, submit state, and cancel behavior through TanStack Form.

#### Scenario: User edits project metadata
- **WHEN** an authorized user edits a project's title or description inline
- **THEN** the form tracks dirty state for that project without affecting other project cards

#### Scenario: User saves project metadata
- **WHEN** an authorized user saves valid project metadata
- **THEN** the system persists the metadata, refreshes project query data, and exits edit mode for that project

#### Scenario: User cancels metadata edit
- **WHEN** a user cancels an inline project metadata edit
- **THEN** the form discards unsaved changes and restores the last saved project values

### Requirement: Workflow stage artifact persistence
The system SHALL persist wizard stage artifact edits under authorized workflow or project storage rather than Studio-owned state.

#### Scenario: User saves stage artifact to project
- **WHEN** an authorized user saves an editable stage artifact associated with a project
- **THEN** the system records the artifact as a project entry under the owning organization and project namespace

#### Scenario: User lacks project access
- **WHEN** a user without project access attempts to read or mutate a stage artifact
- **THEN** the system denies the request and leaves the artifact unchanged

#### Scenario: Stage edit updates project history
- **WHEN** a stage artifact edit is persisted
- **THEN** the system records enough metadata for the project or workflow view to show the current artifact revision and refresh affected project data
