# auth-gate Specification

## Purpose

Gate all application access behind authenticated, unlocked user sessions scoped to an organization, providing a public login page while disabling public self-service signup.

## Requirements

### Requirement: Authenticated application access
The system SHALL require an authenticated, unlocked user session before allowing access to application routes other than the login page and auth endpoints.

#### Scenario: Unauthenticated user opens the workspace
- **WHEN** a visitor without a valid session requests the creator workspace
- **THEN** the system redirects or routes the visitor to the login page

#### Scenario: Authenticated user opens the workspace
- **WHEN** a user with a valid unlocked session requests the creator workspace
- **THEN** the system renders the authenticated application shell for that user's organization

### Requirement: Login page
The system SHALL provide a public login page with email and password authentication, the header copy "Welcome to MotionFrame. Create a promo video, presentation deck, and more...", and a stylized Motion Frames workspace preview that follows `DESIGN.md`.

#### Scenario: User views the login page
- **WHEN** an unauthenticated visitor opens `/login`
- **THEN** the page displays the requested welcome copy, email field, password field, sign-in action, and workspace preview

#### Scenario: Login fails
- **WHEN** a visitor submits invalid credentials
- **THEN** the system shows a concise error without revealing whether the email or password was incorrect

### Requirement: Public signup disabled
The system MUST NOT allow public self-service user signup.

#### Scenario: Visitor attempts public signup
- **WHEN** an unauthenticated visitor calls the email/password signup endpoint
- **THEN** the system rejects the request and does not create a user

### Requirement: Locked user enforcement
The system SHALL prevent locked users from signing in and SHALL reject protected requests from locked users with existing sessions.

#### Scenario: Locked user attempts login
- **WHEN** a locked user submits valid credentials
- **THEN** the system denies access and shows locked-account messaging

#### Scenario: Locked user has an old session
- **WHEN** a locked user with an existing session requests a protected route or API
- **THEN** the system rejects the request and does not expose organization data

### Requirement: Protected API access
The system SHALL require an authenticated organization context for generation, preview, render, project, publishing, profile, and admin APIs.

#### Scenario: Unauthenticated API request
- **WHEN** a request without a valid session calls a protected API
- **THEN** the system returns an authentication error and does not perform the action

#### Scenario: Authenticated API request
- **WHEN** a request with a valid unlocked session calls a protected API
- **THEN** the system evaluates the request using the user's role and organization
