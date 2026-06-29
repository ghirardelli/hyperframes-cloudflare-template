## ADDED Requirements

### Requirement: Private-source HyperFrames skill sync
The system SHALL provide a repeatable sync mechanism that imports HyperFrames skill catalog data from the configured private repository instead of fetching public upstream skill files at runtime.

#### Scenario: Sync from private fork
- **WHEN** a developer or CI job runs the HyperFrames skills sync command with access to `github.com/aaronpie/hyperframes.git`
- **THEN** the system generates a local skill catalog artifact containing skill metadata, normalized instruction content, source repo URL, source commit SHA, and per-file content hashes

#### Scenario: Build without private repo access
- **WHEN** the application build runs without credentials for the private HyperFrames fork and a generated catalog artifact is already present
- **THEN** the build uses the existing generated artifact and does not attempt to fetch private repository content during application runtime

### Requirement: Skill catalog discovery
The system SHALL expose a typed prompt-agent tool for discovering available HyperFrames skills without returning unbounded markdown content.

#### Scenario: Agent lists available skills
- **WHEN** the prompt agent calls the skill catalog listing tool
- **THEN** the tool returns compact metadata for each synced skill, including id, name, description, group, source path, source revision, and whether references are available

#### Scenario: Required skills are absent
- **WHEN** the generated catalog is missing required skills such as `hyperframes`, `hyperframes-core`, `hyperframes-animation`, or `website-to-video`
- **THEN** catalog validation fails with a clear error before the prompt agent can rely on the incomplete catalog

### Requirement: Bounded skill instruction loading
The system SHALL expose a typed prompt-agent tool for loading selected skill instructions with bounded output and no secret material.

#### Scenario: Agent loads a selected skill
- **WHEN** the prompt agent requests instruction content for a synced skill id
- **THEN** the tool returns the skill frontmatter, bounded markdown body, reference index, source revision, and truncation metadata if the content exceeds the allowed size

#### Scenario: Agent requests unknown skill
- **WHEN** the prompt agent requests a skill id that is not present in the generated catalog
- **THEN** the tool returns a typed not-found result and does not fall back to network access

### Requirement: No runtime private credential exposure
The system SHALL keep private repository credentials out of generated catalog content, browser bundles, Worker responses, and prompt-agent messages.

#### Scenario: Catalog artifact is generated
- **WHEN** the sync command writes the generated catalog artifact
- **THEN** the artifact contains source identity and commit metadata but does not contain GitHub tokens, SSH keys, local credential paths, or remote URLs with embedded credentials

#### Scenario: Agent returns skill context
- **WHEN** a user views prompt-agent tool calls or assistant output
- **THEN** the response can mention the skill id and source revision but MUST NOT reveal private repository credentials or local checkout paths
