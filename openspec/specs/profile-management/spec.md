# profile-management Specification

## Purpose

Let authenticated users view and update their own profile and password while keeping organization assignment immutable for non-admin users.

## Requirements

### Requirement: User profile view
The system SHALL allow authenticated users to view their profile and assigned organization.

#### Scenario: User opens profile
- **WHEN** an authenticated user opens their profile settings
- **THEN** the system displays the user's name, email, role, and assigned organization

### Requirement: User profile updates
The system SHALL allow authenticated users to update editable profile fields.

#### Scenario: User updates name
- **WHEN** an authenticated user submits a valid profile name change
- **THEN** the system saves the change and displays the updated profile

#### Scenario: User submits invalid profile data
- **WHEN** an authenticated user submits invalid profile data
- **THEN** the system rejects the update and shows validation feedback

### Requirement: Password changes
The system SHALL allow authenticated users to change their password after providing the required current-password confirmation.

#### Scenario: User changes password
- **WHEN** an authenticated user submits their current password and a valid new password
- **THEN** the system updates the password and requires the new password for future sign-in

#### Scenario: User provides wrong current password
- **WHEN** an authenticated user submits an incorrect current password
- **THEN** the system rejects the password change

### Requirement: Organization assignment is immutable for users
The system MUST NOT allow non-admin users to change their organization assignment.

#### Scenario: User attempts organization change
- **WHEN** a non-admin user submits a profile request containing organization assignment changes
- **THEN** the system ignores or rejects the organization change and preserves the existing assignment

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
