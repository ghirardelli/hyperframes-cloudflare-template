# tenant-admin Specification

## Purpose

Give admins the tools to bootstrap the first admin, manage organizations, create and assign users, and lock/unlock accounts, while restricting these capabilities to admins only.

## Requirements

### Requirement: First admin bootstrap
The system SHALL provide a documented bootstrap path that allows at least one trusted account to become an admin before any admin-managed users exist.

#### Scenario: Bootstrap admin signs in
- **WHEN** a user matching the configured bootstrap admin identity authenticates
- **THEN** the system grants admin capabilities according to the bootstrap policy

### Requirement: Organization management
The system SHALL allow admins to create organizations and view previously created organizations for assignment.

#### Scenario: Admin creates organization
- **WHEN** an admin submits a new organization name
- **THEN** the system creates the organization and makes it available for user assignment

#### Scenario: Admin selects existing organization
- **WHEN** an admin creates a user and selects an existing organization
- **THEN** the system assigns the user to that organization

### Requirement: Admin-created users
The system SHALL allow admins to create user accounts with name, email, password, role, and organization assignment.

#### Scenario: Admin creates user with new organization
- **WHEN** an admin submits valid user details and a new organization name
- **THEN** the system creates the organization, creates the user, and associates the user with the new organization

#### Scenario: Admin creates user with existing organization
- **WHEN** an admin submits valid user details and selects an existing organization
- **THEN** the system creates the user and associates the user with the selected organization

#### Scenario: Missing organization assignment
- **WHEN** an admin submits user details without an organization assignment
- **THEN** the system rejects the request and does not create an unassigned tenant user

### Requirement: User lock controls
The system SHALL allow admins to lock and unlock users.

#### Scenario: Admin locks user
- **WHEN** an admin locks a user
- **THEN** the system prevents that user from logging in and rejects that user's protected requests

#### Scenario: Admin unlocks user
- **WHEN** an admin unlocks a user
- **THEN** the system allows that user to authenticate if their credentials are valid

### Requirement: Admin-only access
The system SHALL restrict organization and user administration to admin users.

#### Scenario: Non-admin opens admin page
- **WHEN** a non-admin user requests an admin route
- **THEN** the system denies access

#### Scenario: Non-admin calls admin API
- **WHEN** a non-admin user calls a user or organization administration API
- **THEN** the system returns an authorization error and does not mutate data
