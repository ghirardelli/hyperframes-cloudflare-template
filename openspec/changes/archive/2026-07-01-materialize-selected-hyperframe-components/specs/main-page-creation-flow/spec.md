## ADDED Requirements

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
