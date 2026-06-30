## Why

Users can generate and render HyperFrame videos, but there is no dedicated place to browse, name, describe, and reopen the videos they have created. The main creation page also needs a few polish passes so the gallery/examples area feels correctly sized, the filter controls do not create horizontal scroll, selected context is visually clearer, and the Examples tab uses the correct official launch-video source.

## What Changes

- Add an authenticated "My Projects" page that presents the user's accessible HyperFrame projects/videos in a bento-style gallery.
- Add project naming and optional short descriptions to project create, update, list, search, and Studio/My Projects UI flows.
- Add a "My Projects" navigation item and preserve existing Studio links for editing a selected project.
- Adjust the main page desktop grid so the first column receives 60% width and the second column receives 40% width.
- Reduce component filter button text sizing and spacing so the filter row fits without a horizontal scrollbar at supported desktop widths.
- Update the Examples tab catalog sync to use `https://github.com/heygen-com/hyperframes-launches`, treating each launch-video folder as a distinct example with unique metadata and preview media.
- Give the Selected Context box a colored, selection-positive background, such as a calm blue or green tint, when gallery context is selected.

## Capabilities

### New Capabilities
- `my-projects-gallery`: Authenticated project library page for browsing, opening, and editing metadata for the user's HyperFrame projects/videos.

### Modified Capabilities
- `tenant-projects`: Add optional project descriptions and ensure project name/description metadata is persisted and returned through project APIs.
- `main-page-creation-flow`: Refine home-page layout proportions, filter button fit, selected context styling, and Examples tab source behavior.

## Impact

- Affected UI: `src/routes/index.tsx`, `src/components/hyperframe-gallery-workspace.tsx`, `src/components/app-header.tsx`, new My Projects route/component files.
- Affected APIs/data: `src/worker/render-api.ts`, `src/db/schema.ts`, Drizzle migration files, project list/search/update response shapes, and Studio project metadata loading.
- Affected catalog generation: `scripts/sync-hyperframe-gallery-catalog.mjs`, `src/generated/hyperframe-gallery-catalog.ts`, gallery catalog tests/check scripts.
- Affected tests: project API tests, main page/gallery behavior tests, catalog sync validation, and route/component tests for the new My Projects page.
