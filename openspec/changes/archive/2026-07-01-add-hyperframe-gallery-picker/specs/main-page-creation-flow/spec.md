## ADDED Requirements

### Requirement: Examples and Components bento picker
The system SHALL replace the main page's default preview-first surface with a scrollable bento picker grouped by Examples and Components tabs.

#### Scenario: User opens the main page
- **WHEN** an authenticated user opens the main page
- **THEN** the primary workspace surface shows an Examples and Components gallery tab group instead of a default large HyperFrames preview player

#### Scenario: User switches gallery tabs
- **WHEN** a user selects the Examples or Components gallery tab
- **THEN** the main page shows the corresponding bento card grid while preserving the existing AI Agent, Manual Prompt, and Render workflow controls

#### Scenario: Gallery overflows available height
- **WHEN** the gallery contains more cards than fit in the viewport
- **THEN** the gallery region scrolls independently without causing the prompt composer or render controls to overlap other UI

### Requirement: Launch-video example selection
The system SHALL let users select launch-video examples as inspiration for a new HyperFrame prompt.

#### Scenario: User selects a launch-video example
- **WHEN** a user selects an example card
- **THEN** the page records that example as selected and displays it as prompt context available to the AI Agent and Manual Prompt workflow

#### Scenario: User asks the agent with selected examples
- **WHEN** a user sends an AI Agent message while one or more examples are selected
- **THEN** the agent request includes the selected example ids, titles, source URLs, and prompt insertion text so the agent can reference them in its generated prompt package

#### Scenario: User clears an example selection
- **WHEN** a user removes a selected example from prompt context
- **THEN** subsequent AI Agent requests and manual prompt insertion actions no longer include that example

### Requirement: Component browsing and detail modal
The system SHALL let users browse HyperFrames components and inspect component details from the Components gallery.

#### Scenario: User opens component details
- **WHEN** a user clicks a component card's info icon
- **THEN** the page opens a modal containing the component name, category, tags, preview media, summary, detail text, source link, and prompt insertion text

#### Scenario: User copies component prompt text
- **WHEN** a user clicks the copy action in the component detail modal
- **THEN** the system writes the component's prompt insertion text to the clipboard and confirms the copied state without closing the modal unexpectedly

#### Scenario: Clipboard write fails
- **WHEN** the browser denies clipboard access
- **THEN** the modal keeps the component prompt text visible and reports a recoverable copy failure state

### Requirement: Component selection for generation prompts
The system SHALL let users add catalog components to prompt context for AI-assisted or manual generation.

#### Scenario: User selects a component
- **WHEN** a user selects a component card or chooses the modal action to use that component
- **THEN** the page records the component as selected prompt context with component id, name, source URL, and prompt insertion text

#### Scenario: User asks the agent with selected components
- **WHEN** a user sends an AI Agent message while one or more components are selected
- **THEN** the agent request includes the selected component context and instructs the agent to incorporate the exact component vocabulary where relevant

#### Scenario: User inserts component text manually
- **WHEN** a user is in Manual Prompt mode and chooses to insert selected gallery context
- **THEN** the manual prompt textarea receives the selected examples and component prompt text without deleting existing user-written prompt content

### Requirement: Generated output actions remain available
The system SHALL preserve generation, Studio handoff, and render/export behavior after replacing the default preview surface.

#### Scenario: User generates from selected gallery context
- **WHEN** AI Agent or Manual Prompt generation succeeds
- **THEN** the system stores the generated HTML/project data, switches the gallery region to a generated preview player, shows generated project status and Studio handoff actions, and keeps Render tab actions available for the generated output

#### Scenario: User renders after gallery-driven generation
- **WHEN** a generated project or HTML output is available and the user clicks Render in the Render tab
- **THEN** the system renders through the existing Worker, Container Durable Object, and R2 pipeline using the selected render settings

#### Scenario: User has not generated output
- **WHEN** the user opens the Render tab before generating a new output
- **THEN** the tab clearly reflects that rendering will use the current bundled/default composition or requires generation first, without restoring the removed default large preview player

### Requirement: Returnable post-generation preview
The system SHALL show the generated preview player in the gallery workspace after successful generation and let users return to the bento gallery for further refinement.

#### Scenario: Approved agent generation shows preview
- **WHEN** a user approves or applies an AI Agent prompt and the HyperFrame generation succeeds
- **THEN** the workspace area that previously showed the bento gallery switches to a generated preview player for the new HyperFrame video

#### Scenario: Manual generation shows preview
- **WHEN** a user generates successfully from Manual Prompt mode
- **THEN** the workspace area that previously showed the bento gallery switches to a generated preview player for the new HyperFrame video

#### Scenario: User returns to gallery from preview
- **WHEN** a generated preview is visible and the user chooses the return-to-gallery action
- **THEN** the workspace restores the Examples/Components bento gallery with the prior active tab, filters, selected examples, and selected components preserved

#### Scenario: User refines after returning to gallery
- **WHEN** a user returns from generated preview to the gallery and selects additional examples or components
- **THEN** the page adds those items to prompt context for the next AI Agent or Manual Prompt iteration without discarding the current generated preview, project id, render URL, or render eligibility

#### Scenario: User reopens current preview
- **WHEN** a generated preview exists and the user has returned to the gallery
- **THEN** the page offers a control to show the current preview again without requiring another generation or render
