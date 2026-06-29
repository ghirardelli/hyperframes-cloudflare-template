## ADDED Requirements

### Requirement: Skill-routed HyperFrames prompt coaching
The system SHALL route HyperFrames video and composition requests through the synced HyperFrames skill catalog before preparing final prompt packages.

#### Scenario: User asks for a video or motion graphic
- **WHEN** an authenticated user sends a prompt-agent message asking to create, edit, animate, render, or plan a HyperFrames video, animation, or motion graphic
- **THEN** the prompt agent uses the synced `/hyperframes` router guidance and selects an appropriate creation workflow or domain skill set before claiming the prompt is generation-ready

#### Scenario: User asks for a non-video prompt edit
- **WHEN** an authenticated user sends a prompt-agent message that does not require HyperFrames skill routing
- **THEN** the prompt agent may continue using the existing prompt coaching tools without loading unrelated HyperFrames workflow instructions

### Requirement: Website-to-video first-pass handling
The system SHALL recognize URL-to-video requests and provide catalog-aware `/website-to-video` guidance without claiming unavailable full pipeline execution.

#### Scenario: User asks to turn a website into a video
- **WHEN** an authenticated user provides a general website URL and asks for a site tour, landing-page showcase, social clip, or video from the site's own visuals
- **THEN** the prompt agent routes the request to the synced `/website-to-video` workflow and prepares a structured prompt package or follow-up questions based on that workflow's guidance

#### Scenario: Full pipeline is unavailable
- **WHEN** the selected workflow requires capture, `DESIGN.md`, `SCRIPT.md`, `STORYBOARD.md`, voice/timing, multi-file composition build, lint, validate, snapshots, or Studio delivery that the application cannot yet execute
- **THEN** the prompt agent explicitly reports that full workflow execution is not available in the current app and limits the result to catalog-aware planning or approved single-composition generation

#### Scenario: Product launch URL is provided
- **WHEN** an authenticated user provides a product or SaaS URL and asks for a launch, promo, or marketing video
- **THEN** the prompt agent routes the request to `/product-launch-video` rather than `/website-to-video`, or asks one clarifying question if launch-vs-general-site intent is ambiguous

### Requirement: Skill-loaded prompt package provenance
The system SHALL include skill provenance in structured prompt coaching results when synced skill instructions materially influenced the recommendation.

#### Scenario: Skill instructions influence the response
- **WHEN** the prompt agent prepares a prompt package after loading HyperFrames skill catalog entries
- **THEN** the structured result or tool state includes the selected workflow id, loaded domain skill ids, and source revision metadata sufficient for debugging

#### Scenario: User applies prompt package
- **WHEN** the user applies a skill-informed prompt package to the editable prompt
- **THEN** the application updates the prompt state through the existing draft prompt path and does not mutate project HTML until approved generation occurs

### Requirement: Approved generation remains the mutation boundary
The system SHALL keep HyperFrames skill catalog tools read-only with respect to project composition HTML and project creation.

#### Scenario: Agent loads catalog and prepares prompt
- **WHEN** the prompt agent lists skills, routes a workflow, loads skill instructions, and prepares a prompt package
- **THEN** the system does not create a project, update project HTML, or write project files

#### Scenario: User approves generation after skill routing
- **WHEN** the prompt agent requests approved generation from a skill-informed final prompt and the user approves
- **THEN** the system calls the existing `generate_hyperframe` path and preserves current authentication, tenant scoping, lint retry, project versioning, and preview update behavior
