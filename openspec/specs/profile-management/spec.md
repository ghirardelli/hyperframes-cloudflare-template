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
