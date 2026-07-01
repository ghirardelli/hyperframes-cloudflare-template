## ADDED Requirements

### Requirement: Studio reflects prompt-agent assets
The system SHALL show assets uploaded through the prompt agent in the same Studio file tree and Assets view used for Studio-originated uploads.

#### Scenario: User opens Studio after chat attachment
- **WHEN** an authorized user opens Studio for a project after uploading an attachment through the prompt agent
- **THEN** the Studio lists the uploaded asset with its logical path, kind, artifact role, content type, size, and modified metadata

#### Scenario: User inserts chat-uploaded asset
- **WHEN** an authorized editor inserts a prompt-agent-uploaded asset from the Studio Assets view
- **THEN** the Studio uses the same `assets/...` logical path returned by the prompt-agent attachment upload

### Requirement: Studio preview resolves prompt-agent assets
The system SHALL resolve prompt-agent-uploaded assets through the existing project-scoped preview and asset-serving routes.

#### Scenario: Preview composition references chat-uploaded asset
- **WHEN** a Studio composition references an asset uploaded through the prompt agent
- **THEN** the preview loads the asset through the project-scoped preview or asset route without exposing cross-organization data

#### Scenario: Inaccessible asset is requested
- **WHEN** a user requests a prompt-agent-uploaded asset from a project they cannot access
- **THEN** the system denies the request using the same project permission checks as Studio-uploaded assets
