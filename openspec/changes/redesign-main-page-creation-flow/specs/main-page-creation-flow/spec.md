## ADDED Requirements

### Requirement: Tabbed creation modes
The system SHALL present the main page creation controls as mutually exclusive AI Agent and Manual Prompt modes so only one primary prompting input is visible at a time.

#### Scenario: User starts in AI Agent mode
- **WHEN** a user opens the main page with AI Agent mode selected
- **THEN** the page shows the agent conversation input, agent messages, structured prompt package area, and generation approval controls without showing the manual prompt textarea as a competing primary input

#### Scenario: User switches to Manual Prompt mode
- **WHEN** a user selects Manual Prompt mode
- **THEN** the page shows the editable final generation prompt and direct Generate Preview control without showing the agent chat input as a competing primary input

#### Scenario: Prompt state is shared between modes
- **WHEN** a user applies an agent prompt package and then opens Manual Prompt mode
- **THEN** the manual prompt field contains the applied final generation prompt

### Requirement: Remembered creation mode
The system SHALL remember the user's selected creation mode on the client and restore it for later main page new-project sessions.

#### Scenario: User returns after choosing Manual Prompt
- **WHEN** a user selects Manual Prompt mode and later opens the main page again
- **THEN** Manual Prompt mode is selected by default

#### Scenario: User returns after choosing AI Agent
- **WHEN** a user selects AI Agent mode and later opens the main page again with AI generation available
- **THEN** AI Agent mode is selected by default

#### Scenario: AI Agent preference is unavailable
- **WHEN** the stored creation mode is AI Agent but AI generation is disabled or not configured
- **THEN** the page remains usable through Manual Prompt mode and does not require the user to clear the stored preference

### Requirement: Prompting guidance affordance
The system SHALL provide compact prompting guidance from the creation panel without permanently occupying the main workspace.

#### Scenario: User hovers over prompting info
- **WHEN** a user hovers over or focuses the creation panel information affordance
- **THEN** the page shows concise advice about including subject, mood, pacing, brand cues, camera movement, duration, and final beat in a HyperFrames prompt

#### Scenario: User navigates with keyboard
- **WHEN** a keyboard user focuses the information affordance
- **THEN** the prompting guidance is available without requiring pointer hover

### Requirement: Stable top preview layout
The system SHALL keep the HyperFrame preview top-aligned, width-constrained, and visually independent from the height of the creation controls.

#### Scenario: Conversation grows on desktop
- **WHEN** the prompt-agent conversation or creation panel content grows taller than the preview
- **THEN** the preview remains near the top of the page and does not stretch vertically to match the creation panel height

#### Scenario: User views desktop workspace
- **WHEN** a user views the main page at a desktop width
- **THEN** the preview occupies roughly half of the workspace width and is not wrapped in a large black outer stage

#### Scenario: User views mobile workspace
- **WHEN** a user views the main page at a mobile width
- **THEN** the preview stacks above the creation controls without horizontal overflow or overlapping controls

### Requirement: Duration before generation
The system SHALL let the user choose generation duration before generating a HyperFrame and use that duration for manual and agent-assisted generation.

#### Scenario: User generates manually with duration
- **WHEN** a user selects a duration and clicks Generate Preview from Manual Prompt mode
- **THEN** the generation request includes the selected `durationSec`

#### Scenario: User chats with agent with duration
- **WHEN** a user sends an AI Agent message
- **THEN** the prompt-agent request includes the selected `durationSec` as forwarded context

#### Scenario: User applies agent package duration
- **WHEN** a user applies a valid agent prompt package that includes a duration
- **THEN** the visible duration control updates to that duration along with the final generation prompt

#### Scenario: User approves agent generation with duration
- **WHEN** a user approves agent-triggered generation
- **THEN** the approved generation path uses the selected or applied `durationSec`

### Requirement: Export settings at render time
The system SHALL expose render output settings near the Render action while keeping the generated composition canvas stable.

#### Scenario: User renders default export
- **WHEN** a user clicks Render MP4 without changing export settings
- **THEN** the render request uses the default MP4 output at 1920x1080

#### Scenario: User changes export resolution
- **WHEN** a user selects an export resolution preset before rendering
- **THEN** the render request includes the corresponding `width` and `height`

#### Scenario: User changes export format
- **WHEN** a user selects an export format before rendering
- **THEN** the render request includes the selected `format` and the render action reflects that format

### Requirement: Flow preservation
The system SHALL preserve existing main page generation and render behavior while changing the layout.

#### Scenario: User generates through AI Agent approval
- **WHEN** a user approves an AI Agent generation request
- **THEN** the workspace updates the preview, project metadata, model, attempts, and lint status through the existing approved generation flow

#### Scenario: User generates through Manual Prompt
- **WHEN** a user clicks Generate Preview in Manual Prompt mode
- **THEN** the workspace updates the preview, project metadata, model, attempts, and lint status through the existing `/api/generate` flow

#### Scenario: User renders generated preview
- **WHEN** a generated preview is available and the user clicks Render
- **THEN** the system renders through the existing Worker, Container Durable Object, and R2 pipeline
