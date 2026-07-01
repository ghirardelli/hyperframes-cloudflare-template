## 1. Trusted Registry Source

- [x] 1.1 Define schemas and types for materializable registry components, trusted file records, canonical host snippets, source metadata, hashes, and materialization manifests.
- [x] 1.2 Extend the gallery/catalog sync path or add a dedicated sync script that resolves selected catalog entries into trusted component files using a pinned HyperFrames registry source or controlled temp install.
- [x] 1.3 Mark catalog entries as `materializable` only when trusted files, canonical usage snippet, dimensions/duration, and content hashes are available.
- [x] 1.4 Add `--check` validation that fails when a materializable component's trusted files or canonical snippet drift from the generated/cache artifact.
- [x] 1.5 Add focused tests for App Showcase metadata, trusted file hashes, prompt-only fallback entries, and credential/path leak prevention.

## 2. Project Materializer

- [x] 2.1 Implement a server-side materializer service that validates component ids against the trusted registry and refuses arbitrary component HTML input.
- [x] 2.2 Copy trusted component files and required assets into the project file/storage model with safe normalized paths.
- [x] 2.3 Inject or update canonical host snippets in `index.html` from bounded placement data including start, duration, track index, width, and height.
- [x] 2.4 Record installed component manifests with source URL, source revision or package version, content hashes, installed paths, host placements, actor, timestamp, and snapshot/version references.
- [x] 2.5 Ensure repeated materialization of the same component/source hash reuses trusted files and updates only requested placements.
- [x] 2.6 Add rollback/snapshot support so restoring a snapshot restores host snippets, trusted files, and materialization metadata.

## 3. Agent And Generation Boundaries

- [x] 3.1 Add typed schemas for component placement requests and materialization results to the prompt-agent contract.
- [x] 3.2 Add an approval-gated `materialize_hyperframe_components` server tool that accepts component ids and placements but not component file contents.
- [x] 3.3 Update the prompt-agent system prompt and tests to forbid recreating selected materializable component internals and to prefer trusted materialization.
- [x] 3.4 Extend generation request bodies to carry selected component/materialization metadata alongside prompt text.
- [x] 3.5 Validate generated host HTML so selected materializable components resolve through canonical snippets and trusted files.
- [x] 3.6 Reject, repair, or retry outputs where the model invents selected component internals such as `compositions/app-showcase.html`.

## 4. Main Page UX

- [x] 4.1 Update selected context data structures to preserve materialization state, canonical usage snippets, install command/source metadata, and component ids.
- [x] 4.2 Update Selected Context UI copy/badges to distinguish prompt-only references from real installable component blocks.
- [x] 4.3 Add a way for users to express placement intent for selected materializable components without writing raw host snippets.
- [x] 4.4 Update Manual Prompt insertion to include trusted-component instructions and canonical snippet context without encouraging users to paste component internals.
- [x] 4.5 Update AI Agent chat/artifact UI to show approval cards for component materialization and summarize installed component results.

## 5. Studio And Project Visibility

- [x] 5.1 Show registry-managed component files in Studio's project tree with source/component metadata.
- [x] 5.2 Prevent direct accidental edits to registry-managed files or require an explicit detach/customize action before edits are saved as user-authored files.
- [x] 5.3 Add Studio detail/status affordances showing component id, source URL, source revision or package version, installed paths, and hash-match state.
- [x] 5.4 Ensure project preview resolves materialized `data-composition-src` paths from trusted project files.
- [x] 5.5 Ensure render handoff includes trusted component files/assets in the selected project snapshot.

## 6. Verification

- [x] 6.1 Add unit tests for materializer path safety, trusted file overwrite behavior, manifest persistence, and repeated install idempotency.
- [x] 6.2 Add Worker/tool tests covering auth, approval boundary, invalid component ids, rejected arbitrary HTML, and App Showcase materialization.
- [x] 6.3 Add prompt-agent tests proving selected materializable components are requested by id/placement and not recreated as HTML.
- [x] 6.4 Add UI tests for prompt-only versus materializable selected-context states, placement intent, manual prompt insertion, and approval flow.
- [x] 6.5 Add Studio tests for registry-managed file display, detach/customize behavior, preview resolution, and snapshot restore.
- [x] 6.6 Run `npm test`, `npm run check:hyperframe-gallery` or the new registry check, `npm run typecheck`, `npm run build`, and targeted browser verification with App Showcase.
