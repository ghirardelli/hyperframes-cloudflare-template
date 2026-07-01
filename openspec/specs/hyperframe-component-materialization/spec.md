# hyperframe-component-materialization Specification

## Purpose

Define trusted materialization of selected HyperFrames registry components into project files, host snippets, prompt-agent tool boundaries, audit metadata, and prompt-only fallback behavior.

## Requirements

### Requirement: Trusted component source bundle
The system SHALL maintain a trusted registry source for materializable HyperFrames catalog components that contains the HyperFrames-authored files, canonical usage snippets, source metadata, and content hashes used at runtime.

#### Scenario: Materializable component is synced
- **WHEN** a catalog component such as App Showcase is marked materializable
- **THEN** the trusted registry source includes its component id, source URL, source revision or package version, canonical host snippet, file paths, file contents or storage keys, and content hashes

#### Scenario: Component cannot be resolved during sync
- **WHEN** a catalog component has an install command but the sync process cannot resolve trusted component files
- **THEN** the system does not mark that component as materializable and leaves it available only as prompt context

### Requirement: Deterministic project materialization
The system SHALL materialize selected registry components by copying trusted component files into the project and inserting canonical host snippets rather than asking the AI model to create component internals.

#### Scenario: App Showcase is materialized
- **WHEN** App Showcase is selected for real component use in a project
- **THEN** the system writes the trusted `compositions/app-showcase.html` file and inserts a host snippet equivalent to the catalog's canonical App Showcase `data-composition-id` usage

#### Scenario: Component files already exist
- **WHEN** a selected component has already been materialized in the project from the same trusted source hash
- **THEN** the system reuses the existing trusted files and updates only the requested host placement when needed

### Requirement: Agent cannot supply selected component internals
The system MUST reject or override AI-generated file contents for selected materializable registry component internals when trusted source files are available.

#### Scenario: Agent generates a fake component file
- **WHEN** the AI output includes contents for `compositions/app-showcase.html` while App Showcase is selected as a materialized component
- **THEN** the system replaces that file with the trusted App Showcase source or fails validation instead of persisting the AI-authored component internals as the registry component

#### Scenario: Agent references a selected component by snippet
- **WHEN** the AI output references a selected component through its canonical `data-composition-id` and `data-composition-src`
- **THEN** the system preserves the host placement and ensures the referenced file resolves to trusted materialized component files

### Requirement: Approved materialization tool boundary
The system SHALL expose component materialization through an authenticated, typed, approval-gated server tool or API that accepts component ids and placement data but not replacement component HTML.

#### Scenario: Agent requests component materialization
- **WHEN** the AI Agent decides that a selected component should be used at a specific time and track
- **THEN** it requests materialization with catalog component id, timing, track, dimensions, and placement notes, and the user must approve before project files are mutated

#### Scenario: Request includes untrusted component HTML
- **WHEN** a materialization request attempts to submit arbitrary component file contents for a selected registry component
- **THEN** the system rejects that input and uses only trusted registry source files for the selected component

### Requirement: Materialization audit metadata
The system SHALL persist audit metadata for each materialized component installation and host placement.

#### Scenario: Component is installed into a project
- **WHEN** a trusted component is materialized
- **THEN** the system records component id, source URL, source revision or package version, content hashes, installed paths, host snippet placement, actor, timestamp, and project snapshot or version metadata

#### Scenario: Render failure is investigated
- **WHEN** a project using materialized components fails preview or render validation
- **THEN** the recorded metadata allows the system or developer to distinguish trusted component source files from generated host composition code and later user customizations

### Requirement: Prompt-only fallback is explicit
The system SHALL distinguish prompt-only gallery references from materializable components and MUST NOT silently recreate a trusted component when materialization fails.

#### Scenario: Selected item is prompt-only
- **WHEN** a selected gallery item lacks trusted materialization files
- **THEN** the system may forward it as prompt context but does not present it as an installed project component

#### Scenario: Materialization fails for selected component
- **WHEN** a user selected a component for real installation and trusted materialization fails
- **THEN** the system reports a recoverable error and does not ask the AI model to rebuild the component from scratch as an automatic fallback
