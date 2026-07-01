# form-managed-workflows Specification

## Purpose

Define how app-owned workflows use TanStack Form for unsaved field state, validation state, dirty state, and submit state while keeping server data canonical in Query, workflow runs, and project entries.

## Requirements

### Requirement: App-owned TanStack Form runtime
The system SHALL use TanStack Form to manage field state, validation state, dirty state, and submit state for app-owned forms migrated by this change.

#### Scenario: User edits a migrated app form
- **WHEN** a user changes a field in a migrated app-owned form
- **THEN** the form tracks the changed value, touched state, dirty state, and validation state through TanStack Form

#### Scenario: User submits invalid form data
- **WHEN** a user submits invalid data in a migrated app-owned form
- **THEN** the system prevents the mutation, marks the relevant fields, and shows field-level or form-level validation feedback

### Requirement: Zod-backed validation
The system SHALL pair TanStack Form validation with existing Zod schemas or narrowly introduced domain Zod schemas for app-owned forms and workflow stage edits.

#### Scenario: Existing schema covers a form
- **WHEN** an app form's input is already represented by an existing Zod schema
- **THEN** the form uses that schema for client validation instead of defining unrelated parallel validation rules

#### Scenario: Server rejects submitted data
- **WHEN** a form mutation passes client validation but fails authoritative server validation
- **THEN** the system displays the server error without treating the client schema as authoritative over server policy

### Requirement: Query-backed form mutations
The system SHALL submit server-owned form changes through mutation helpers that update or invalidate the relevant TanStack Query cache entries.

#### Scenario: Form mutation succeeds
- **WHEN** a migrated form mutation completes successfully
- **THEN** the system updates or invalidates the affected identity, admin, profile, project, workflow, or render query data

#### Scenario: Form mutation is pending
- **WHEN** a migrated form mutation is in flight
- **THEN** the system exposes pending state through the form and prevents duplicate submissions for that form action

### Requirement: Canonical artifact boundary
The system SHALL treat workflow runs, project entries, and server responses as canonical for saved data, while TanStack Form manages only unsaved edits and validation state.

#### Scenario: Stage artifact save completes
- **WHEN** a user saves a form-managed stage artifact edit
- **THEN** the system persists the artifact through project or workflow APIs and refreshes the form defaults from canonical server data

#### Scenario: Canonical artifact changes externally
- **WHEN** an artifact visible in a form-managed editor changes outside the current unsaved form state
- **THEN** the system detects the mismatch before overwriting unsaved user edits

### Requirement: Studio migration boundary
The system MUST NOT modify Studio internals as part of adopting TanStack Form for app-owned workflows.

#### Scenario: Form migration is implemented
- **WHEN** this change migrates app-owned routes and workflow forms
- **THEN** Studio route loading, `StudioEditor`, Studio-owned file tree behavior, and `@hyperframes/studio` integration remain unchanged
