## ADDED Requirements

### Requirement: Form-managed admin user creation
The system SHALL manage admin create-user field state, conditional validation, submit state, and errors through TanStack Form.

#### Scenario: Admin creates user with existing organization
- **WHEN** an admin selects an existing organization while creating a user
- **THEN** the form requires an organization id and does not require a new organization name

#### Scenario: Admin creates user with new organization
- **WHEN** an admin selects new organization while creating a user
- **THEN** the form requires a new organization name and does not require an existing organization id

#### Scenario: Admin submits invalid user form
- **WHEN** an admin submits missing or invalid user details
- **THEN** the form prevents the create-user mutation and shows field-level validation feedback

#### Scenario: Admin user creation succeeds
- **WHEN** an admin submits valid user details and the server creates the user
- **THEN** the form clears the create-user draft and refreshes admin users and organizations as needed
