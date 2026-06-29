## ADDED Requirements

### Requirement: Versioned project entries
The system SHALL create version records for project entry changes, including text edits, binary uploads, path changes, metadata changes, soft deletes, and generated pipeline outputs.

#### Scenario: User saves a text file
- **WHEN** an authorized editor saves a project text file
- **THEN** the system records a new entry version with the actor, path, content metadata, checksum, and restorable content or object pointer

#### Scenario: User uploads binary asset
- **WHEN** an authorized editor uploads a binary project asset
- **THEN** the system records a new entry version with the actor, logical path, content type, size, checksum, and Bunny Storage pointer

### Requirement: Project snapshots
The system SHALL create project snapshots that reference a consistent set of entry versions for generation, render, publish, share, restore, and manual save milestones.

#### Scenario: User renders project
- **WHEN** an authorized user renders a project
- **THEN** the system records the entry versions used for that render in a project snapshot associated with the render

#### Scenario: User publishes project
- **WHEN** an authorized user publishes or shares a project milestone
- **THEN** the system records a snapshot that can be used to audit or restore the published state

### Requirement: Restore from version or snapshot
The system SHALL allow authorized editors to restore an individual entry version or a complete project snapshot while preserving newer history.

#### Scenario: Editor restores a file version
- **WHEN** an authorized editor restores a previous version of a file
- **THEN** the system writes a new current version containing the restored content and records the restore actor

#### Scenario: Viewer attempts restore
- **WHEN** a viewer attempts to restore a file version or project snapshot
- **THEN** the system denies the restore

### Requirement: Search accessible project content
The system SHALL provide search over only the projects and entries the requesting user is authorized to read.

#### Scenario: User searches within organization
- **WHEN** a user searches projects in their organization
- **THEN** results include only private projects they own or are a member of, organization-shared projects, and admin-accessible projects

#### Scenario: Search matches text file content
- **WHEN** a query matches indexed text content in an accessible project file
- **THEN** the system returns the project entry match with project title, path, artifact role, and relevant metadata

### Requirement: Search extracted artifact metadata
The system SHALL index project title, prompt, entry path, artifact role, text content, generated descriptions, transcripts, render metadata, and selected pipeline metadata, but SHALL NOT scan raw binary bytes during search requests.

#### Scenario: Query matches transcript
- **WHEN** a query matches transcript text extracted from a project media artifact
- **THEN** the search result references the transcript entry or associated media artifact

#### Scenario: Query targets binary asset filename
- **WHEN** a query matches the filename or description of a binary asset
- **THEN** the search result returns the asset metadata without reading the binary object during the search request
