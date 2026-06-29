## ADDED Requirements

### Requirement: Full-viewport responsive page shell
The system SHALL render every application route in a full-viewport, responsive shell that uses the full width and height of the browser viewport rather than a centered fixed-width column.

#### Scenario: Authenticated content route uses full viewport
- **WHEN** an authenticated user opens any primary route (workspace, admin, profile, playground, or studio)
- **THEN** the page shell spans the full viewport width and height and does not constrain the overall page to a centered fixed maximum width

#### Scenario: Unauthenticated login route uses full viewport
- **WHEN** an unauthenticated user opens the login route
- **THEN** the login layout fills the viewport responsively across breakpoints

### Requirement: Readable density within full-bleed shells
The system SHALL preserve comfortable, readable widths for dense form and text content within the full-bleed shell so that maximizing screen real estate does not reduce form legibility.

#### Scenario: Form-heavy route remains legible
- **WHEN** a user views a form-heavy route such as admin user creation or profile settings
- **THEN** the surrounding shell is full-bleed while the form content is constrained to a comfortable reading width

### Requirement: Responsive usability across devices
The system SHALL keep all full-page layouts usable on mobile and desktop without overlapping or clipped text and controls.

#### Scenario: Mobile layout has no overlap
- **WHEN** a user views any route at a mobile viewport width
- **THEN** controls and text reflow without overlapping or being clipped

#### Scenario: Desktop layout uses available space
- **WHEN** a user views any route at a wide desktop viewport width
- **THEN** the layout expands to use the available space instead of leaving large empty margins

### Requirement: Design system preservation
The system SHALL apply the full-page layout changes while preserving the established DESIGN.md visual language (quiet surfaces, single blue action accent, restrained chrome).

#### Scenario: Full-page layout keeps the design language
- **WHEN** the full-page layouts are applied
- **THEN** the routes continue to use the DESIGN.md surfaces, accent color, and chrome conventions
