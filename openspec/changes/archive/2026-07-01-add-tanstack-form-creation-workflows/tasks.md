## 1. Form Foundation

- [x] 1.1 Add `@tanstack/react-form` to the app dependencies and lockfile.
- [x] 1.2 Add a small form test helper that renders components with the existing Query Client test provider.
- [x] 1.3 Add shared form utilities only for repeated field error, submit state, and Zod validation wiring.
- [x] 1.4 Identify existing Zod schemas that can be reused by login, admin, profile, project metadata, creation intake, and workflow tools.
- [x] 1.5 Add narrowly scoped Zod schemas for missing client form contracts, including admin organization mode and wizard stage patch input.

## 2. Existing App Forms

- [x] 2.1 Convert the `/login` email/password form to TanStack Form while preserving the existing auth request and generic error behavior.
- [x] 2.2 Add login form tests for missing fields, pending submit state, failed sign-in, and successful identity refresh/navigation.
- [x] 2.3 Convert the `/admin` create-user form to TanStack Form with conditional existing-organization versus new-organization validation.
- [x] 2.4 Add admin create-user tests for conditional organization validation, successful creation, query invalidation, and server error display.
- [x] 2.5 Convert the `/profile` profile update form to TanStack Form with dirty-state-aware save behavior.
- [x] 2.6 Convert the `/profile` password change form to TanStack Form with field clearing after success.
- [x] 2.7 Add profile/password tests for validation feedback, mutation errors, success reset behavior, and identity query refresh.
- [x] 2.8 Convert inline project metadata editing on `/projects` to per-project TanStack Form instances.
- [x] 2.9 Add project metadata tests for edit, cancel, save, validation feedback, and project query refresh.

## 3. Main Creation Intake

- [x] 3.1 Add a creation intake schema for prompt, selected context, duration, resolution, and render format values.
- [x] 3.2 Convert main creation prompt/settings/render inputs to TanStack Form without changing the visible AI Agent, Manual Prompt, and Render tab workflow.
- [x] 3.3 Preserve existing direct manual generation and agent-approved generation behavior using validated form values.
- [x] 3.4 Preserve existing render behavior using validated resolution and format values from the form.
- [x] 3.5 Add tests for creation input validation, direct generation submission, render settings submission, and tab behavior preservation.

## 4. Wizard Stage Model And APIs

- [x] 4.1 Add adaptive stage plan types and Zod schemas for user-facing stages, artifact paths, status, editability, skipped state, and validation results.
- [x] 4.2 Add or extend app-owned workflow APIs to read an authorized wizard stage plan for a workflow run or project workflow context.
- [x] 4.3 Add or extend app-owned APIs to read editable stage artifact content with revision metadata.
- [x] 4.4 Add or extend app-owned APIs to save stage artifact edits with authorization and conflict detection.
- [x] 4.5 Add or extend app-owned APIs to rerun validation for supported stages or workflows.
- [x] 4.6 Add TanStack Query keys and hooks for wizard stage plans, stage artifacts, artifact saves, and validation reruns.
- [x] 4.7 Add API and hook tests for tenant authorization, project permissions, artifact conflict handling, and validation rerun states.

## 5. Wizard Route And UI

- [x] 5.1 Add an app-owned wizard route for authorized workflow-stage editing without modifying Studio route or Studio components.
- [x] 5.2 Build the two-column wizard layout with stage navigation/editor on the left and workflow-scoped AI Agent chat on the right.
- [x] 5.3 Render adaptive stage status, skipped/unavailable stages, artifact paths, validation state, and available actions.
- [x] 5.4 Add TanStack Form Groups for editable stage artifacts so each stage can validate and submit independently.
- [x] 5.5 Add markdown artifact editing for editable files such as `DESIGN.md`, `SCRIPT.md`, and `STORYBOARD.md`.
- [x] 5.6 Add save, discard, dirty-state warning, and conflict recovery behavior for stage artifact forms.
- [x] 5.7 Add responsive layout behavior that keeps stage editing and agent chat usable on smaller screens.
- [x] 5.8 Add wizard UI tests for route authorization, stage selection, manual edit/save/discard, skipped-stage display, and conflict warnings.

## 6. Agent Stage Tools

- [x] 6.1 Extend prompt-agent contracts with stage inspection, patch proposal, approved patch application, and validation rerun tool schemas.
- [x] 6.2 Implement read-only stage inspection tool handling with tenant/project authorization.
- [x] 6.3 Implement stage patch proposal handling that returns affected paths and bounded patch summaries without mutating artifacts.
- [x] 6.4 Implement approved stage patch application handling with artifact revision checks and Query cache refresh.
- [x] 6.5 Implement approved validation rerun handling for supported stages.
- [x] 6.6 Scope the existing prompt agent panel to the active wizard workflow, project, and selected stage.
- [x] 6.7 Add tests for approval boundaries, unauthorized tool calls, patch preview, patch apply, cache refresh, and validation rerun.

## 7. Wizard Routing From Creation

- [x] 7.1 Add a main AI Agent action that recommends a wizard when the agent classifies the prompt as benefiting from a staged workflow.
- [x] 7.2 Create or attach the workflow context when the user approves starting the wizard from the main creation intake.
- [x] 7.3 Route approved wizard starts to the wizard page with relevant prompt, context, duration, project, resolution, and format values preserved.
- [x] 7.4 Preserve the existing direct generation path when the agent determines that a wizard is unnecessary.
- [x] 7.5 Add tests for wizard recommendation, approved redirect, direct-generation fallback, and return/resume behavior.

## 8. Verification And Guardrails

- [x] 8.1 Verify no Studio route, `StudioEditor`, `@hyperframes/studio`, or Studio-owned file tree behavior changed.
- [x] 8.2 Run the project typecheck and fix any type errors introduced by form or wizard contracts.
- [x] 8.3 Run affected unit and component tests for login, admin, profile, projects, main creation, workflow APIs, wizard UI, and agent tools.
- [x] 8.4 Add a focused manual QA pass for login, admin create-user, profile/password, project metadata edit, direct generation, wizard creation, manual stage edit, agent patch apply, and validation rerun.
- [x] 8.5 Run `openspec validate add-tanstack-form-creation-workflows --strict` and address any OpenSpec issues.
