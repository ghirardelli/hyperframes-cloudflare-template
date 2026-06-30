## ADDED Requirements

### Requirement: Authenticated My Projects route
The system SHALL provide an authenticated My Projects page that lists HyperFrame projects/videos the current user can access.

#### Scenario: User opens My Projects
- **WHEN** an authenticated user opens the My Projects page
- **THEN** the system shows projects from the user's organization that the user owns, has explicit access to, can administer, or that are shared with the organization

#### Scenario: Unauthenticated user opens My Projects
- **WHEN** an unauthenticated user opens the My Projects page
- **THEN** the system sends the user through the existing login flow before showing project data

### Requirement: Bento project gallery
The system SHALL present accessible projects as a bento-style gallery of video project cards with stable, responsive tile sizes.

#### Scenario: User has projects
- **WHEN** the My Projects page receives one or more accessible projects
- **THEN** it renders a responsive bento gallery with project name, optional description, updated date, duration, latest render or preview affordance, and primary actions

#### Scenario: Project has latest render
- **WHEN** a project has a persisted render output
- **THEN** its gallery card exposes a playable or openable latest-render preview without exposing inaccessible render URLs

#### Scenario: Project has no render
- **WHEN** a project has no persisted render output
- **THEN** its gallery card still shows project metadata and an action to open the project in Studio

### Requirement: Project card actions
The system SHALL let users navigate from My Projects to continue work on an accessible project.

#### Scenario: User opens a project card
- **WHEN** a user chooses the primary action on a project card
- **THEN** the system opens the existing Studio route for that project

#### Scenario: User opens latest render
- **WHEN** a user chooses a latest-render action on a project card
- **THEN** the system opens the authorized render playback or download route for that project render

### Requirement: My Projects empty and loading states
The system SHALL provide clear non-disruptive loading, error, and empty states for My Projects.

#### Scenario: Projects are loading
- **WHEN** the My Projects page is waiting for project data
- **THEN** it shows a stable loading state that does not shift the page layout unexpectedly

#### Scenario: User has no projects
- **WHEN** the authenticated user has no accessible projects
- **THEN** the page shows an empty state with an action to return to the main creation workspace
