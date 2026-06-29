## MODIFIED Requirements

### Requirement: Studio editing workspace
The system SHALL provide a non-linear Studio editing workspace for the project composition, comprising a source code editor, a live preview player with timeline scrubbing and selection, and a property panel for editing the selected element, all scoped to the user's organization and preserving a live HyperFrames preview.

#### Scenario: User edits composition source in the code editor
- **WHEN** a user edits the composition in the Studio source code editor
- **THEN** the system updates the project source state and the live preview reflects the change without exposing another organization's data

#### Scenario: User scrubs and plays the timeline
- **WHEN** a user plays, pauses, or scrubs the timeline in the Studio preview
- **THEN** the preview seeks to the corresponding time and reflects the current composition

#### Scenario: User selects and edits an element via the property panel
- **WHEN** a user selects an element on the canvas or timeline and changes a supported property
- **THEN** the system applies the edit to the composition source and updates the preview

#### Scenario: Visual selection unavailable for a composition
- **WHEN** a composition does not support on-canvas element selection
- **THEN** the system keeps the code editor and timeline-scrubbing preview usable and indicates that visual selection is unavailable rather than failing

## ADDED Requirements

### Requirement: Studio render settings
The system SHALL let the user choose render settings (such as resolution and duration) in the Studio workspace and carry them through to the render request, defaulting to the project's existing behavior when not specified.

#### Scenario: User renders with chosen settings
- **WHEN** a user selects render settings and triggers a render from the Studio workspace
- **THEN** the system includes the chosen resolution and duration in the render request to the existing render pipeline

#### Scenario: User renders without changing settings
- **WHEN** a user triggers a render without changing render settings
- **THEN** the system renders using the project's existing default resolution and duration

### Requirement: Studio renders history
The system SHALL display the project's render history in the Studio workspace, scoped to the user's organization, with access to each render output.

#### Scenario: User views renders for a project
- **WHEN** a user opens the Studio renders panel for a project in their organization
- **THEN** the system lists that project's renders with links to their outputs and shows an empty state when there are none

#### Scenario: Renders are organization-scoped
- **WHEN** the Studio renders panel loads
- **THEN** it never lists renders belonging to another organization
