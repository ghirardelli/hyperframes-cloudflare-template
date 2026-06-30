## 1. Project Metadata Foundation

- [x] 1.1 Add nullable `description` support to the `projects` table in `src/db/schema.ts` and generate the matching Drizzle migration.
- [x] 1.2 Update project create and update request handling to accept, trim, persist, clear, and return optional project descriptions.
- [x] 1.3 Update project list, get, and search responses so accessible project metadata includes title and optional description without exposing inaccessible matches.
- [x] 1.4 Add or update project API tests for create/list/update/search description behavior and edit-permission enforcement.

## 2. My Projects Page

- [x] 2.1 Add an authenticated `/projects` route titled "My Projects" and add the matching navigation item to the app header.
- [x] 2.2 Build the My Projects data loader/client fetch flow using permission-scoped project APIs and login redirect behavior.
- [x] 2.3 Render a responsive bento-style project gallery with stable tile sizing, project name, optional description, duration, updated date, and latest render or preview affordance.
- [x] 2.4 Add project card actions for opening Studio and opening an authorized latest render when one exists.
- [x] 2.5 Add title and optional short-description editing from the My Projects experience for authorized editors.
- [x] 2.6 Add loading, error, and empty states, including a create-workspace action when no projects exist.

## 3. Main Page UI Refinements

- [x] 3.1 Change the main page desktop grid to a 60% first column and 40% second column while preserving mobile stacking.
- [x] 3.2 Reduce component filter button typography and spacing, remove the horizontal scrollbar behavior, and handle long labels without overlap.
- [x] 3.3 Restyle the Selected Context box with a blue or green tinted selected state and readable selected-item chips.
- [x] 3.4 Add or update focused UI tests or snapshot/browser checks for column proportions, filter overflow, and selected-context styling.

## 4. Correct Examples Catalog Source

- [x] 4.1 Update `scripts/sync-hyperframe-gallery-catalog.mjs` default launch source from `heygen-com/hyperframes-launch-video` to `heygen-com/hyperframes-launches`.
- [x] 4.2 Implement folder-based launch discovery so each valid launch folder becomes a distinct Examples tab item with unique title, description, source URL, duration, resolution, prompt text, and preview media.
- [x] 4.3 Make launch sync LFS-safe or tree/API based so CI does not need to download large binary assets to build the catalog.
- [x] 4.4 Add catalog validation/tests that reject duplicate placeholder previews and incomplete launch folders with clear errors or skip reporting.
- [x] 4.5 Regenerate `src/generated/hyperframe-gallery-catalog.ts` from the corrected source and verify `npm run check:hyperframe-gallery`.

## 5. Verification

- [x] 5.1 Run targeted Vitest suites for project APIs, gallery catalog parsing, main page creation flow, and any new My Projects components.
- [x] 5.2 Run `npm run typecheck`.
- [x] 5.3 Run `npm run build`.
- [x] 5.4 Manually verify the authenticated My Projects route, main page 60/40 layout, filter row overflow, colored Selected Context box, and distinct Examples thumbnails in a browser.
