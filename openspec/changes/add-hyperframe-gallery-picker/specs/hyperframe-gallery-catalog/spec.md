## ADDED Requirements

### Requirement: Source-backed launch video examples
The system SHALL provide a generated gallery catalog of official HyperFrames launch-video examples sourced from configured public source repositories.

#### Scenario: Sync reads launch-video source
- **WHEN** a developer or CI job runs the gallery catalog sync command
- **THEN** the system reads configured launch-video sources, including `https://github.com/heygen-com/hyperframes-launch-video`, and writes a local generated catalog artifact with source URL, source revision, title, duration, resolution, preview media, tags, and prompt insertion text for each discovered example

#### Scenario: Launch-video source has one root composition
- **WHEN** a configured launch-video source exposes a root composition and named sub-compositions but no multi-example manifest
- **THEN** the system includes the root launch video as an example and MAY include sub-composition technique cards only when they are clearly labeled as parts of the source video rather than separate launch videos

#### Scenario: Required example metadata is missing
- **WHEN** a launch-video entry is missing required display metadata such as title, source URL, duration, resolution, or preview media
- **THEN** catalog validation fails with a clear error instead of publishing a broken gallery card

### Requirement: Source-backed component catalog
The system SHALL provide a generated gallery catalog of HyperFrames components sourced from the public HyperFrames catalog pages.

#### Scenario: Sync discovers component pages
- **WHEN** the gallery catalog sync command starts from `https://hyperframes.heygen.com/catalog/blocks/code-3d-extrude`
- **THEN** the system discovers component pages from the catalog navigation or page links and records component id, name, category, tags, source URL, preview thumbnail or video, summary, detail text, and prompt insertion text

#### Scenario: Component page includes preview media
- **WHEN** a catalog component page exposes an example thumbnail or video
- **THEN** the generated component entry references that media so the Components tab can render a visual card without manual asset entry

#### Scenario: Component page cannot be parsed
- **WHEN** a component page cannot be fetched or parsed during sync
- **THEN** the sync report identifies the failed source URL and the generated catalog excludes or marks the component unavailable without breaking existing valid entries

### Requirement: Safe gallery catalog runtime shape
The system SHALL expose gallery catalog data to the client as safe metadata without secrets, local checkout paths, or unbounded remote page content.

#### Scenario: Client loads gallery catalog
- **WHEN** the main page renders the gallery
- **THEN** it imports or fetches a bounded gallery catalog containing only display-safe metadata, source links, media URLs, prompt insertion text, and generated source revision metadata

#### Scenario: Catalog artifact is generated
- **WHEN** the sync command writes the generated gallery artifact
- **THEN** the artifact MUST NOT include GitHub tokens, local filesystem paths, private credentials, or raw page dumps that are not needed for gallery display

#### Scenario: Catalog check runs in CI
- **WHEN** the gallery catalog check command runs against committed generated data
- **THEN** it exits successfully only when required schema validation passes and the generated artifact is in sync with the configured sources or intentionally pinned source revisions
