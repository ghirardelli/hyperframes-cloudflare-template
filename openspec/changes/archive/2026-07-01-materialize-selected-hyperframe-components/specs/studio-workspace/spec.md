## ADDED Requirements

### Requirement: Studio shows registry-managed component files
The Studio workspace SHALL show materialized registry component files in the project tree with source metadata that distinguishes trusted registry-managed files from generated or user-authored files.

#### Scenario: User opens project with App Showcase
- **WHEN** a user opens Studio for a project where App Showcase was materialized
- **THEN** the file tree includes the trusted App Showcase composition file and displays registry/source state for that file

#### Scenario: User inspects component source metadata
- **WHEN** a user selects a registry-managed component file or installed component record
- **THEN** Studio shows component id, source URL, source revision or package version, installed paths, and whether the file still matches the trusted hash

### Requirement: Studio protects trusted component files from accidental corruption
The Studio workspace SHALL prevent accidental editing of registry-managed component internals unless the user deliberately detaches or customizes the component.

#### Scenario: User edits registry-managed component file
- **WHEN** a user attempts to edit a trusted registry-managed component file
- **THEN** Studio either blocks direct edits or requires a deliberate detach/customize action that marks the file as custom rather than trusted

#### Scenario: User detaches component for customization
- **WHEN** a user chooses to customize a registry-managed component
- **THEN** the system preserves the original trusted metadata in history and marks the edited copy as user-authored or detached

### Requirement: Preview and render resolve materialized components
The Studio workspace SHALL preview and render host compositions that reference materialized registry component files through canonical `data-composition-src` paths.

#### Scenario: Preview loads materialized component
- **WHEN** `index.html` contains the canonical App Showcase host snippet
- **THEN** Studio preview resolves `compositions/app-showcase.html` from the project's materialized trusted files

#### Scenario: Render uses materialized component files
- **WHEN** a user renders a project containing materialized registry components
- **THEN** the render pipeline receives the project snapshot with the trusted component files needed by the host composition

### Requirement: Snapshots include materialized component state
The Studio workspace SHALL include materialized component files and source metadata in project versions and snapshots.

#### Scenario: Snapshot is created after component materialization
- **WHEN** the system creates a project snapshot after installing App Showcase
- **THEN** the snapshot records both the host composition change and the trusted component files/source metadata

#### Scenario: Snapshot is restored
- **WHEN** an authorized editor restores a snapshot that included materialized components
- **THEN** Studio restores the host snippets, component files, and source metadata needed for preview/render consistency
