## ADDED Requirements

### Requirement: Studio file management
The system SHALL provide a file tree in the Studio for managing a project's source files (create, rename, delete, duplicate, move, and open), scoped to the user's organization.

#### Scenario: User edits a project with multiple files
- **WHEN** a user opens a project that has multiple source files
- **THEN** the Studio shows the file tree and lets the user open and edit files in the project

#### Scenario: User creates or removes a file
- **WHEN** a user creates, renames, duplicates, moves, or deletes a file in the Studio file tree
- **THEN** the system persists the change to the project within the user's organization

### Requirement: Studio compositions navigation
The system SHALL let the user navigate sub-compositions of a project (referenced via composition source) and preview each composition level.

#### Scenario: User opens the Compositions tab
- **WHEN** a user opens the Compositions view for a project
- **THEN** the Studio lists the project's compositions and lets the user open a composition's preview

#### Scenario: User drills into and back out of a sub-composition
- **WHEN** a user navigates into a sub-composition and then back
- **THEN** the Studio previews the selected composition level and provides breadcrumb navigation between levels

### Requirement: Studio asset management
The system SHALL let the user upload, list, and reference organization-scoped assets for a project from the Assets view.

#### Scenario: User uploads an asset
- **WHEN** a user uploads an asset in the Studio Assets view
- **THEN** the system stores the asset for the project under the user's organization and lists it

#### Scenario: Assets are organization-scoped
- **WHEN** the Studio Assets view loads
- **THEN** it lists only assets belonging to the user's organization
