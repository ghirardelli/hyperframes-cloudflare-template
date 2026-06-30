# project-access-sharing Specification

## Purpose

Control project visibility, explicit project roles, organization sharing, and permission audit metadata while preserving cross-organization isolation.

## Requirements

### Requirement: Private project default
The system SHALL make newly created projects visible only to their owner and authorized organization administrators unless the owner or an authorized editor shares the project.

#### Scenario: User creates project
- **WHEN** an authenticated user creates a project
- **THEN** the system records that user as project owner and sets project visibility to private

#### Scenario: Organization member lists projects
- **WHEN** another member of the same organization lists projects
- **THEN** the private project is omitted unless that member has an explicit project role or administrative access

### Requirement: Organization project sharing
The system SHALL allow an authorized project user to share a project with all members of the owning organization without exposing the project outside that organization.

#### Scenario: Owner shares project with organization
- **WHEN** a project owner changes project visibility to organization
- **THEN** organization members can access the project and its file tree according to organization-shared permissions

#### Scenario: External organization user opens shared project
- **WHEN** a user from another organization requests an organization-shared project
- **THEN** the system denies access

### Requirement: Explicit project member roles
The system SHALL support explicit per-project user roles within the owning organization, including owner, editor, and viewer.

#### Scenario: Owner grants editor role
- **WHEN** a project owner grants an organization user the editor role
- **THEN** that user can read and mutate project files, assets, versions, and render settings according to editor permissions

#### Scenario: Viewer attempts mutation
- **WHEN** a project viewer attempts to modify a project file, upload an asset, restore a version, or change sharing settings
- **THEN** the system rejects the mutation and leaves the project unchanged

### Requirement: Organization-role-aware administration
The system SHALL allow authorized organization administrators to manage project access within their organization while preserving cross-organization isolation.

#### Scenario: Organization admin opens private project
- **WHEN** an organization admin opens a private project in their organization
- **THEN** the system grants administrative project access

#### Scenario: Organization admin opens another organization's project
- **WHEN** an organization admin requests a project owned by a different organization
- **THEN** the system denies access

### Requirement: Entry-level authorization inheritance
The system SHALL authorize every project file, folder, asset, version, snapshot, and render through the parent project permission model.

#### Scenario: Shared project member opens asset
- **WHEN** a user with access to an organization-shared project opens a project asset
- **THEN** the system serves the asset if the user has read permission on the parent project

#### Scenario: User without project access requests version data
- **WHEN** a user without project access requests project version history
- **THEN** the system denies access to the version metadata and stored bytes

### Requirement: Permission audit metadata
The system SHALL record who changes project sharing state or explicit project member roles and when the change occurs.

#### Scenario: Project is shared
- **WHEN** an authorized user shares a project with the organization
- **THEN** the system records the actor, timestamp, previous visibility, and new visibility
