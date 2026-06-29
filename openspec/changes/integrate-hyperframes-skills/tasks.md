## 1. Skill Catalog Sync

- [x] 1.1 Add a deterministic sync script, for example `scripts/sync-hyperframes-skills.mjs`, that reads `skills/**/SKILL.md` from `github.com/aaronpie/hyperframes.git`.
- [x] 1.2 Support local private-repo access through existing Git credentials, SSH agent, or GitHub CLI auth without requiring committed credentials.
- [x] 1.3 Support CI private-repo access through environment-provided read-only credentials and document the expected variable names.
- [x] 1.4 Generate a local catalog artifact with source repo URL, source commit SHA, generated timestamp, skill metadata, normalized markdown, reference indexes, and content hashes.
- [x] 1.5 Add validation that required skill ids exist, including `hyperframes`, `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `website-to-video`, and `product-launch-video`.
- [x] 1.6 Ensure generated artifacts never include embedded GitHub tokens, SSH key paths, credential helper paths, or remote URLs containing credentials.
- [x] 1.7 Add an npm script for syncing and an optional check command that verifies the committed generated artifact matches the configured private source revision.

## 2. Shared Schemas And Catalog Utilities

- [x] 2.1 Add Zod schemas/types for skill metadata, catalog source metadata, catalog list output, route request/output, loaded skill instruction output, and typed not-found results.
- [x] 2.2 Add server-side catalog utilities that import the generated artifact, validate it once, group skills into router/workflow/domain categories, and expose safe lookup helpers.
- [x] 2.3 Add bounded markdown loading helpers that return deterministic truncation metadata and reference indexes without overloading the model context.
- [x] 2.4 Add unit tests for catalog validation, required skill detection, private-source metadata, credential redaction, grouping, lookup, and bounded loading.

## 3. Prompt-Agent Tool Integration

- [x] 3.1 Add TanStack AI tool definitions for `list_hyperframes_skill_catalog`, `route_hyperframes_workflow`, and `load_hyperframes_skill`.
- [x] 3.2 Implement server tools that use the generated catalog and never perform network access during chat requests.
- [x] 3.3 Update `createPromptAgentServerTools()` to include the new catalog tools alongside existing guidance, project inspection, prompt package, and approved generation tools.
- [x] 3.4 Update prompt-agent runtime context as needed to include forwarded prompt, duration, active project, and any catalog routing metadata required by the tools.
- [x] 3.5 Add tests proving catalog tools are read-only and cannot create projects, mutate project HTML, write project files, or bypass `generate_hyperframe` approval.

## 4. Skill-Aware Agent Behavior

- [x] 4.1 Update the prompt-agent system prompt to use the synced `/hyperframes` router for video, animation, motion graphic, render, and HyperFrames composition requests.
- [x] 4.2 Teach the agent to load only the selected workflow and relevant domain skills before preparing a final structured prompt package.
- [x] 4.3 Add routing logic and tests for general website-to-video, product launch URL, faceless explainer, motion graphic, and non-video prompt-edit requests.
- [x] 4.4 Add first-pass `/website-to-video` behavior that prepares a grounded prompt package or follow-up questions without claiming capture, storyboard, voice, validation, snapshots, or Studio delivery.
- [x] 4.5 Add explicit unavailable-full-pipeline disclosure when the selected workflow requires systems not present in the current app.
- [x] 4.6 Include selected workflow id, loaded domain skill ids, and source revision metadata in structured output or observable tool state when skill instructions materially influence the response.

## 5. UI And User Feedback

- [x] 5.1 Add prompt-agent tool labels and previews for skill catalog listing, workflow routing, skill loading, and full-pipeline-unavailable notices.
- [x] 5.2 Keep tool-card previews compact so raw skill markdown does not flood the chat panel.
- [x] 5.3 Ensure applying a skill-informed prompt package still uses the existing draft prompt path and does not mutate server project data.
- [x] 5.4 Verify the approved generation result still updates preview/project/model/attempt/lint state through the existing flow.

## 6. Future Workflow Runner Boundary

- [x] 6.1 Add a design note or TODO module comment for the future container-backed workflow runner boundary: capture, artifacts, voice/timing, multi-file build, lint, validate, snapshots, and Studio delivery.
- [x] 6.2 Ensure first-pass catalog tools return a typed `fullPipelineAvailable: false` or equivalent indicator for workflows that require the future runner.
- [x] 6.3 Do not create placeholder capture directories, fake `DESIGN.md`, fake `SCRIPT.md`, fake `STORYBOARD.md`, narration files, validation snapshots, or Studio URLs in the first-pass implementation.

## 7. Verification

- [x] 7.1 Run the catalog sync script against an accessible private fork checkout or mocked fixture and confirm deterministic generated output.
- [x] 7.2 Run prompt-agent unit tests for routing, skill loading, `/website-to-video` first-pass disclosure, and approval-bound generation.
- [x] 7.3 Run Worker route tests to confirm unauthenticated users cannot access catalog-backed prompt-agent behavior.
- [x] 7.4 Run `npm test`.
- [x] 7.5 Run `npm run typecheck`.
- [x] 7.6 Run `npm run build`.
- [ ] 7.7 Browser-verify the main prompt-agent flow for a website URL, product launch URL, general motion prompt, prompt application, and approved generation.
  - Blocked locally: dev server opened at `http://127.0.0.1:5173/` but redirected to `/login`; no test account/session was available, and approved generation would exercise the live model/generation path.
