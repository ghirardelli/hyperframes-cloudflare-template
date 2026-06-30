## ADDED Requirements

### Requirement: Shared TanStack Query runtime
The system SHALL provide a shared TanStack Query Client to React route and component code so authenticated server-owned data is fetched and cached through one client server-state runtime.

#### Scenario: Route reads server state
- **WHEN** a route or component needs authenticated server-owned data
- **THEN** it can access a Query Client provider without creating a page-local Query Client

#### Scenario: Tests render query-backed components
- **WHEN** a component test renders a component that uses Query hooks
- **THEN** the test can wrap the component in a test Query Client provider with retries disabled and isolated cache state

### Requirement: Authenticated API request helper
The system SHALL centralize authenticated JSON request behavior for Query query functions and mutations, including JSON parsing, error messages, and unauthenticated redirects.

#### Scenario: API returns JSON error
- **WHEN** a query or mutation receives a non-OK JSON response from an app API
- **THEN** the shared request helper exposes a bounded error message suitable for component error handling

#### Scenario: API returns unauthorized
- **WHEN** a query or mutation receives a 401 response in the browser
- **THEN** the system redirects to `/login` and prevents protected data from remaining visible as fresh server state

### Requirement: Typed query keys by domain
The system SHALL define reusable query key factories for identity, config, profile, projects, renders, admin data, playground catalog data, and workflow status.

#### Scenario: Mutation refreshes related data
- **WHEN** a mutation changes a project, render, profile, admin user, playground item, or workflow run
- **THEN** the mutation invalidates or updates the relevant domain query keys instead of relying on full-page reloads

#### Scenario: Component uses query data
- **WHEN** a component fetches server-owned data
- **THEN** it uses a shared query key factory rather than a component-local ad hoc key string

### Requirement: Query-backed server reads
The system SHALL replace high-value manual `useEffect` fetch flows with Query-backed reads while preserving existing user-visible loading, empty, success, and error states.

#### Scenario: Projects page loads projects
- **WHEN** an authenticated user opens the projects page
- **THEN** the projects list and latest render metadata load through Query and still display loading, empty, error, and project-card states equivalent to the existing page

#### Scenario: Admin page loads administration data
- **WHEN** an admin opens the admin page
- **THEN** organizations and users load through Query and remain restricted to admin-authorized API responses

### Requirement: Query-backed mutations and invalidation
The system SHALL wrap server-owned writes in Query mutations and refresh affected cached data after successful mutation.

#### Scenario: User updates project metadata
- **WHEN** a user saves a project title or description change
- **THEN** the mutation updates or invalidates the project detail and project list queries so the new metadata appears without a manual refresh

#### Scenario: User deletes a project
- **WHEN** a user confirms project deletion
- **THEN** the mutation removes or invalidates affected project list and render queries so deleted data is no longer shown as current

#### Scenario: User changes profile
- **WHEN** a user updates their profile name
- **THEN** the mutation refreshes profile and current-user query data so headers and profile screens agree

#### Scenario: Admin changes user state
- **WHEN** an admin creates, locks, or unlocks a user
- **THEN** the mutation refreshes admin user data and preserves existing authorization failures for non-admin callers

### Requirement: Active-only status polling
The system SHALL use Query polling for workflow or render status only while the represented operation is active and SHALL stop polling when the operation reaches a terminal state.

#### Scenario: Workflow run is active
- **WHEN** a workflow run status is queued, running, or awaiting approval
- **THEN** the workflow status query refetches at a bounded interval

#### Scenario: Workflow run is terminal
- **WHEN** a workflow run status is succeeded, failed, or cancelled
- **THEN** the workflow status query stops interval polling while preserving the final status for display

#### Scenario: Render status becomes ready
- **WHEN** a render or uploaded playback status reaches a ready, failed, or unavailable terminal state
- **THEN** the render status query stops interval polling and the UI shows the final action or error state

### Requirement: Studio preservation boundary
The system SHALL leave Studio route, editor, and Studio-owned server-state flows unchanged in this change so upstream HyperFrames Studio updates remain easier to apply.

#### Scenario: Studio route remains unchanged
- **WHEN** this change is implemented
- **THEN** the Studio route and `StudioEditor` continue using their existing data-loading and mutation behavior

#### Scenario: Upstream Studio changes are applied later
- **WHEN** upstream HyperFrames Studio changes need to be applied to this project
- **THEN** this TanStack Query change has not introduced Studio-specific Query hooks, query keys, or wrappers that must be reconciled before applying those updates

### Requirement: Local draft state remains local
The system SHALL keep unsaved local UI state outside the Query cache, including prompt drafts, selected gallery context, tab selection, dialog state, and form input values.

#### Scenario: User edits generation prompt
- **WHEN** a user changes the generation prompt or selected gallery context before submitting
- **THEN** those draft values remain local and are not treated as fresh server state in the Query cache
