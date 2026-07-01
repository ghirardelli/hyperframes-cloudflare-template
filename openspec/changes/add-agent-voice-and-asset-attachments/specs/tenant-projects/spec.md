## ADDED Requirements

### Requirement: Prompt-agent asset ingestion
The system SHALL persist files attached through the prompt agent as organization-scoped project assets in the project entry namespace.

#### Scenario: Editor attaches an asset through prompt agent
- **WHEN** an authorized editor attaches a supported file to the prompt agent for an active project
- **THEN** the system stores the bytes in provider-backed project storage, records a binary project entry under `assets/...`, records upload metadata, and returns the logical project path

#### Scenario: Viewer attaches an asset through prompt agent
- **WHEN** a viewer without edit permission attempts to attach a file to a project through the prompt agent
- **THEN** the system rejects the upload and leaves project entries unchanged

#### Scenario: Cross-organization attachment attempt
- **WHEN** a user attempts to attach a file to a project outside their authorized organization or project access scope
- **THEN** the system denies the upload before reading or storing the file bytes

#### Scenario: Attachment exceeds limits
- **WHEN** an attached file exceeds configured size, duration, content type, or path limits
- **THEN** the system rejects the upload and does not create a project asset or project entry version

### Requirement: Project asset references in generated output
The system SHALL preserve project asset references needed by HyperFrames preview and render flows when a prompt-agent-generated composition uses uploaded assets.

#### Scenario: Generated composition references uploaded asset
- **WHEN** approved generation creates or updates project HTML that references a known `assets/...` project path
- **THEN** the system persists the composition and asset entries under the same project so preview and render can resolve the asset through project-scoped routes

#### Scenario: Generated composition references unknown asset
- **WHEN** approved generation output references an `assets/...` path that is not present in the active project
- **THEN** the system surfaces a validation or lint error rather than silently treating the missing asset as available
