## ADDED Requirements

### Requirement: Form-managed login submission
The system SHALL manage login field state, validation feedback, submit state, and errors through TanStack Form while preserving existing public login behavior.

#### Scenario: Visitor submits missing login fields
- **WHEN** an unauthenticated visitor submits the login form without a valid email or password
- **THEN** the form prevents the sign-in request and shows validation feedback for the relevant fields

#### Scenario: Visitor submits credentials
- **WHEN** an unauthenticated visitor submits validly shaped email and password fields
- **THEN** the system sends the existing email/password sign-in request and shows pending state until the request settles

#### Scenario: Login succeeds
- **WHEN** the email/password sign-in request succeeds
- **THEN** the system refreshes authenticated identity state and routes the user into the authenticated workspace

#### Scenario: Login fails
- **WHEN** the email/password sign-in request fails
- **THEN** the form shows the existing concise generic failure message without revealing whether the email or password was incorrect
