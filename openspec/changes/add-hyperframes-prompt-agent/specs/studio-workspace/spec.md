## ADDED Requirements

### Requirement: Assisted prompt creation flow
The system SHALL provide an assisted prompt creation flow in the main workspace while preserving the user's ability to manually edit and directly generate from a prompt.

#### Scenario: User refines a prompt with the agent
- **WHEN** a user chats with the prompt agent from the main workspace
- **THEN** the workspace can update the editable generation prompt with the agent's approved or selected prompt draft

#### Scenario: User generates manually
- **WHEN** a user edits the prompt field and clicks the existing Generate control without using the agent
- **THEN** the system generates through the existing `/api/generate` flow

#### Scenario: Agent generation requires approval
- **WHEN** the prompt agent proposes generating a HyperFrame from its prepared prompt
- **THEN** the workspace shows an approval decision before the generation request can update the preview or project
