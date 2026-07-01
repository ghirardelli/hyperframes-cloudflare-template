## ADDED Requirements

### Requirement: Form-managed profile updates
The system SHALL manage profile update field state, validation feedback, dirty state, submit state, and errors through TanStack Form.

#### Scenario: User changes profile name
- **WHEN** an authenticated user edits their profile name
- **THEN** the form tracks the dirty value and enables the save action only when the edit is valid and changed

#### Scenario: User saves profile update
- **WHEN** an authenticated user submits a valid profile update
- **THEN** the system saves the update, refreshes profile identity data, and resets the form defaults to the saved values

#### Scenario: User submits invalid profile update
- **WHEN** an authenticated user submits invalid profile data
- **THEN** the form prevents or reports the rejected update with validation feedback

### Requirement: Form-managed password changes
The system SHALL manage password change field state, validation feedback, submit state, and errors through TanStack Form.

#### Scenario: User submits incomplete password form
- **WHEN** an authenticated user submits the password form without required current or new password values
- **THEN** the form prevents the request and shows validation feedback for the missing fields

#### Scenario: User changes password successfully
- **WHEN** an authenticated user submits a valid password change and the server accepts it
- **THEN** the system clears the password fields and shows success feedback without exposing password values

#### Scenario: Server rejects password change
- **WHEN** the server rejects a password change because the current password is wrong or policy validation fails
- **THEN** the form shows the bounded server error without clearing unrelated profile data
