## Purpose

Define the main page creation workflow for prompting, agent-assisted prompt refinement, and rendering HyperFrame videos.

## Requirements

### Requirement: Three-tab creation workflow
The system SHALL present AI Agent, Manual Prompt, and Render as a single tabbed workflow on the main page, with Render in the last tab position.

#### Scenario: User sees Render in the tab menu
- **WHEN** a user opens the main page creation panel
- **THEN** the tab menu shows AI Agent, Manual Prompt, and Render in that order

#### Scenario: User opens Render tab
- **WHEN** a user selects the Render tab
- **THEN** the panel shows render resolution, format, render, reset, download, and selected export summary controls without showing the AI Agent chat input or Manual Prompt textarea as the primary tab content

#### Scenario: Render tab does not overwrite creation preference
- **WHEN** a user selects the Render tab after selecting AI Agent or Manual Prompt
- **THEN** the remembered new-project creation mode remains the last selected AI Agent or Manual Prompt mode, not Render

### Requirement: Render controls inside tab workflow
The system SHALL move existing render controls from the separate Export card into the Render tab while preserving render behavior.

#### Scenario: User changes render settings in Render tab
- **WHEN** a user selects a render resolution and output format in the Render tab
- **THEN** the next render request includes the selected `width`, `height`, and `format`

#### Scenario: User renders generated preview from Render tab
- **WHEN** a generated preview or bundled composition is available and the user clicks Render in the Render tab
- **THEN** the system renders through the existing Worker, Container Durable Object, and R2 pipeline

#### Scenario: User downloads rendered output from Render tab
- **WHEN** a render completes successfully
- **THEN** the Render tab exposes the download action for the selected output format

### Requirement: Expanded duration choices
The system SHALL expose duration options up to 5 minutes and accept those durations through manual and agent-assisted generation.

#### Scenario: User opens duration menu
- **WHEN** a user opens the duration control
- **THEN** the available choices include 30 seconds, 1 minute, 2 minutes, 3 minutes, 4 minutes, and 5 minutes in addition to the existing short-form options

#### Scenario: User generates with a long duration manually
- **WHEN** a user selects a duration greater than 2 minutes and generates from Manual Prompt mode
- **THEN** the generation request preserves the selected `durationSec` value without clamping it below the selected duration

#### Scenario: User asks the agent with a long duration
- **WHEN** a user selects a duration greater than 2 minutes and sends an AI Agent message
- **THEN** the prompt-agent request and approved generation path preserve the selected `durationSec` value

### Requirement: Quiet idle state
The system SHALL remove non-actionable idle status copy from the bottom of the main page while preserving meaningful feedback.

#### Scenario: Bundled composition is idle
- **WHEN** the main page is showing the default bundled composition and no generation or render action has occurred
- **THEN** the page does not show a bottom status box that only says "Bundled composition loaded."

#### Scenario: Action feedback is available
- **WHEN** generation, render, error, lint, or download feedback is relevant
- **THEN** the page shows concise actionable status feedback in the relevant workflow context

### Requirement: Chat-style agent workspace
The system SHALL present the AI Agent tab as a chat-style workspace with the conversation stream above and the composer anchored at the bottom.

#### Scenario: AI Agent tab is empty
- **WHEN** a user opens the AI Agent tab before any messages exist
- **THEN** the tab shows helper text for asking the agent without wrapping that helper text in a border that resembles an input field

#### Scenario: Agent streams response
- **WHEN** the AI Agent is generating or streaming a response
- **THEN** the response appears in the conversation stream above the composer

#### Scenario: User composes a message
- **WHEN** a user types into the Ask the agent field
- **THEN** the composer remains at the bottom of the AI Agent tab with the Send action adjacent to or visually grouped with the input

### Requirement: Inline prompt proposal approval
The system SHALL show agent-suggested prompts and approval actions inside the chat stream instead of in a separate suggested prompt box.

#### Scenario: Agent proposes a prompt
- **WHEN** the agent prepares a structured prompt package
- **THEN** the proposed prompt, duration, checklist, and assistant explanation appear as an assistant artifact in the chat stream

#### Scenario: Agent asks for confirmation
- **WHEN** the agent proposes a prompt for the HyperFrame video
- **THEN** the agent asks whether the user is happy with the proposed prompt before running generation

#### Scenario: User approves generation
- **WHEN** the agent has an approved generation tool request ready
- **THEN** the chat stream shows an Apply or Approve action that the user can click to run the prompt and create the HyperFrame video

#### Scenario: User applies prompt to manual flow
- **WHEN** the user applies a proposed prompt without immediately generating
- **THEN** the canonical prompt state updates so Manual Prompt mode contains the applied prompt

### Requirement: Form-managed creation intake
The system SHALL manage main creation prompt, context, duration, resolution, and format inputs through TanStack Form while preserving existing manual and agent-assisted generation behavior.

#### Scenario: User edits creation settings
- **WHEN** a user edits prompt, duration, render resolution, or render format in the main creation flow
- **THEN** the form tracks the changed values and validation state for those inputs

#### Scenario: User generates directly
- **WHEN** a user submits a valid prompt through the existing direct manual or agent-approved generation path
- **THEN** the system preserves the current generation behavior and sends the validated form values to the generation mutation

### Requirement: Wizard routing from creation intake
The system SHALL allow suitable creation prompts to route from the main AI Agent intake into an adaptive workflow wizard.

#### Scenario: Agent recommends wizard workflow
- **WHEN** the AI Agent determines that a user's prompt would benefit from a staged HyperFrames pipeline
- **THEN** the system can present a wizard start action with the selected stage plan, project target, and workflow context

#### Scenario: User starts wizard from intake
- **WHEN** the user approves starting the wizard workflow from the main creation intake
- **THEN** the system creates or attaches to the workflow context and routes the user to the wizard page

#### Scenario: Prompt does not need wizard
- **WHEN** the AI Agent determines that the user's prompt is suitable for direct generation
- **THEN** the system keeps the user in the existing main creation flow and does not force a wizard route

### Requirement: Creation context handoff
The system SHALL preserve relevant creation context when routing from the main page into the wizard.

#### Scenario: Wizard starts from populated intake
- **WHEN** a user starts a wizard after entering prompt, duration, gallery context, selected project, resolution, or format values
- **THEN** the wizard receives the relevant context needed to initialize the workflow and stage plan

#### Scenario: User returns from wizard
- **WHEN** a user navigates back from a wizard to the main creation page
- **THEN** the main page preserves or reloads the relevant project and creation state from canonical server data

### Requirement: Selected components expose materialization state
The main page creation workflow SHALL distinguish selected gallery items that are prompt-only references from selected components that can be materialized as real HyperFrames project blocks.

#### Scenario: User selects materializable component
- **WHEN** a user selects a materializable catalog component such as App Showcase
- **THEN** the selected context UI indicates that the component can be installed into the project as a real block rather than only used as prompt inspiration

#### Scenario: User selects prompt-only example
- **WHEN** a user selects a gallery example or non-materializable component
- **THEN** the selected context UI indicates that it will be used as prompt/reference context and not installed as a project file

### Requirement: User can provide component placement intent
The main page creation workflow SHALL allow users to express where selected materializable components should appear in the video without requiring them to write raw HyperFrames host snippets by hand.

#### Scenario: User describes placement in prompt
- **WHEN** a user writes that App Showcase should be used as the opening scene
- **THEN** the AI Agent receives that placement intent along with the selected component id and trusted usage metadata

#### Scenario: User provides no placement details
- **WHEN** a user selects a materializable component but does not specify placement
- **THEN** the AI Agent may propose a sensible placement for user approval before materializing the component into project files

### Requirement: Manual prompt preserves trusted component instructions
Manual Prompt mode SHALL make it clear that adding selected materializable component context does not require the user to paste or invent component internals.

#### Scenario: User adds selected component to manual prompt
- **WHEN** a user clicks Add to prompt for a materializable component
- **THEN** the appended prompt text identifies the component id, trusted usage snippet, and instruction to use the registry-authored block instead of recreating its HTML

#### Scenario: User generates with selected materializable component
- **WHEN** a user generates manually with a selected materializable component and real component use enabled
- **THEN** the generation request carries component selection metadata so the server can validate or materialize trusted files instead of relying only on prose in the prompt

### Requirement: Agent flow uses selected components as build inputs
The AI Agent flow SHALL treat selected materializable components as available build inputs and route real project mutation through the approved materialization boundary.

#### Scenario: Agent prepares prompt with selected component
- **WHEN** the AI Agent prepares a prompt package using App Showcase
- **THEN** the prompt package references App Showcase by component id and intended placement, and does not instruct the generation model to author App Showcase internals

#### Scenario: Agent wants to install selected component
- **WHEN** the AI Agent wants to use a selected materializable component in the project
- **THEN** the chat stream presents an approval action for the materialization/generation mutation before the component files or host snippets are written

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
