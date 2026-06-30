# bunny-project-storage Specification

## Purpose

Store project files, assets, pipeline artifacts, and rendered media through Bunny Storage and Bunny Stream while keeping database permissions and metadata authoritative.

## Requirements

### Requirement: Server-side Bunny credentials
The system MUST use Bunny Storage and Bunny Stream credentials only on the server and MUST NOT expose Bunny access keys to browser code, project HTML, Studio responses, or client-side configuration.

#### Scenario: Browser requests storage configuration
- **WHEN** a browser loads application configuration or Studio project data
- **THEN** the response omits Bunny access keys and returns only non-secret feature/status data

#### Scenario: Server uploads a project object
- **WHEN** the server stores a project asset or pipeline artifact in Bunny Storage
- **THEN** it sends the configured storage access key in the server-side Bunny request and records only provider metadata in the database

### Requirement: Bunny Storage project workspace layout
The system SHALL store new project workspace objects in Bunny Storage under an immutable organization/user/project prefix derived from database IDs.

#### Scenario: User uploads a project asset
- **WHEN** an authorized user uploads `assets/logo.png` to a project
- **THEN** the system stores the bytes under `orgs/{organizationId}/users/{ownerUserId}/projects/{projectId}/workspace/assets/logo.png` and records the logical path in the database

#### Scenario: Pipeline writes generated artifacts
- **WHEN** a HyperFrames pipeline creates files such as storyboard, composition cards, transcripts, source media, snapshots, or render artifacts
- **THEN** the system stores each object under the same project workspace prefix with an artifact role recorded in the database

### Requirement: DB-authoritative file tree
The system SHALL treat Postgres project entry rows as the source of truth for file and folder trees, including empty folders, deleted entries, provider pointers, search metadata, and permissions.

#### Scenario: User creates an empty folder
- **WHEN** an authorized user creates an empty folder in Studio
- **THEN** the system creates a folder entry in the database without requiring a Bunny Storage object

#### Scenario: Bunny contains an unexpected object
- **WHEN** an object exists in Bunny Storage without a matching accessible project entry row
- **THEN** the Studio file tree does not list it and app routes do not serve it as a project file

### Requirement: Storage provider abstraction
The system SHALL read and write project bytes through a storage provider abstraction that supports at least Postgres text content, legacy R2 objects, Bunny Storage objects, and Bunny Stream videos.

#### Scenario: Legacy R2 asset is requested
- **WHEN** an authorized user requests an existing project asset whose provider is `r2`
- **THEN** the system reads the object through the legacy R2 provider and returns it without requiring an immediate Bunny migration

#### Scenario: New asset is uploaded after Bunny is configured
- **WHEN** an authorized user uploads a new binary asset after Bunny Storage is enabled
- **THEN** the system writes the object to Bunny Storage and records provider `bunny-storage`

### Requirement: Bunny Stream render persistence
The system SHALL upload new final video renders to Bunny Stream and store the Stream library ID, video ID, status, playback metadata, and optional archive pointer in the database.

#### Scenario: Render completes successfully
- **WHEN** the render container returns video bytes for a project render
- **THEN** the system creates a Bunny Stream video, uploads the bytes to that video, records Stream metadata, and associates the render with the project

#### Scenario: Stream upload fails
- **WHEN** Bunny Stream rejects or fails a render upload
- **THEN** the system records the render as failed or retryable and does not expose a ready playback URL

### Requirement: Authorized media serving
The system SHALL serve project files, assets, and renders only after database authorization, even when the underlying bytes are stored in Bunny.

#### Scenario: Authorized user opens a render
- **WHEN** a user with project access opens a Bunny Stream render
- **THEN** the system returns authorized playback metadata or a protected playback route for that render

#### Scenario: Unauthorized user requests an asset URL
- **WHEN** a user without project access requests an app route for a Bunny-backed asset
- **THEN** the system denies the request before fetching or revealing the Bunny object
