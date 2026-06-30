## ADDED Requirements

### Requirement: Desktop creation column proportions
The system SHALL present the main page desktop creation workspace with a 60% first column and 40% second column while preserving a single-column mobile layout.

#### Scenario: Desktop user opens main page
- **WHEN** the viewport supports the two-column main page layout
- **THEN** the first column occupies approximately 60% of the available grid width and the second column occupies approximately 40%

#### Scenario: Mobile user opens main page
- **WHEN** the viewport does not support the two-column main page layout
- **THEN** the page stacks the columns vertically without horizontal overflow

### Requirement: Component filter buttons fit without horizontal scrollbar
The system SHALL render gallery filter buttons with compact text and spacing so the component filter row does not require a horizontal scrollbar in supported layouts.

#### Scenario: User opens Components tab on desktop
- **WHEN** the component category filters are visible in the gallery workspace on a supported desktop viewport
- **THEN** the filter controls fit within the column without showing a horizontal scrollbar

#### Scenario: Filter labels are long
- **WHEN** a filter label is longer than the available inline space
- **THEN** the filter control wraps or truncates gracefully without overlapping adjacent controls

### Requirement: Correct launch-video examples source
The system SHALL source Examples tab launch videos from `https://github.com/heygen-com/hyperframes-launches` and treat each launch-video folder as a separate example.

#### Scenario: Gallery catalog sync reads launch folders
- **WHEN** a developer or CI job runs the gallery catalog sync command
- **THEN** the system discovers launch-video folders from `https://github.com/heygen-com/hyperframes-launches` and creates distinct examples for each folder containing a HyperFrames composition

#### Scenario: Launch folder has metadata
- **WHEN** a discovered launch folder contains project metadata such as `meta.json`, README, storyboard, render, or preview assets
- **THEN** the generated example uses folder-specific title, description, duration, resolution, source URL, prompt text, and preview media instead of reusing the same thumbnail for every card

#### Scenario: Launch folder is incomplete
- **WHEN** a discovered launch folder is missing required example metadata or preview media
- **THEN** catalog validation fails with a clear error or excludes the broken folder without publishing duplicate placeholder cards

### Requirement: Selected context visual emphasis
The system SHALL visually distinguish the Selected Context box with a colored, selection-positive background when gallery context is selected.

#### Scenario: User selects gallery context
- **WHEN** one or more examples or components are selected for prompt context
- **THEN** the Selected Context box appears with a blue or green tinted background, clear border contrast, and readable chips

#### Scenario: User removes all selected context
- **WHEN** the user removes every selected example and component
- **THEN** the Selected Context box is hidden or returns to the neutral empty state without leaving stale selection styling visible
