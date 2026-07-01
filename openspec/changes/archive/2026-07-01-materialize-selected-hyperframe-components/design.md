## Context

The gallery picker now exposes HyperFrames catalog blocks/components such as App Showcase. Each catalog entry includes metadata like `installCommand`, `usageSnippet`, source URL, preview media, and prompt text. Today, selecting those entries only forwards prompt context to the AI Agent or appends text to the manual prompt. It does not install the registry block, write `compositions/app-showcase.html`, copy assets, or guarantee that the host composition references a real file.

That gap matters because HyperFrames registry blocks are authored and tested by the HyperFrames team. If the model tries to recreate a selected component from scratch, it can generate plausible-but-invalid HTML that breaks timeline behavior, sub-composition loading, or rendering. The existing Studio file model and preview path already support project files such as `index.html` and `compositions/*.html`, so the app has the right persistence layer for trusted component files; it needs a deterministic materialization layer between gallery selection and project output.

## Goals / Non-Goals

**Goals:**

- Use HyperFrames-authored registry block/component files when selected catalog components are used in a project.
- Prevent the AI Agent and manual generation path from relying on model-recreated component HTML for selected registry components.
- Let the AI Agent plan component placement while a trusted server-side tool performs installation/copying and host snippet injection.
- Persist component materialization metadata, source revision/hash, installed file paths, host placements, versions, and snapshots.
- Make materialized components visible and understandable in Studio and in the main page selected-context UI.
- Preserve explicit approval before agent-driven project mutation.

**Non-Goals:**

- Running arbitrary `npx hyperframes add <user-input>` during normal user requests.
- Letting the browser install registry blocks directly.
- Replacing every generated scene with registry components; surrounding host composition and custom scenes can still be generated.
- Guaranteeing every catalog entry is materializable in the first release; entries without trusted source files can remain prompt-only references.
- Building a general package manager, dependency resolver, or live registry marketplace.

## Decisions

**1. Create a trusted registry component bundle at sync/build time.**

Extend the gallery/skills sync pipeline, or add a dedicated sync script, to resolve materializable catalog entries into a server-owned bundle. For each materializable component, the bundle records component id, source URL, source revision/package version, install command, canonical host usage snippet, files, asset references, content hashes, dimensions, and duration.

The sync may use a controlled temp project and `npx hyperframes add <catalog-id>` or a pinned HyperFrames registry source, but this happens in developer/CI sync, not from untrusted runtime input. The generated artifact or cached object store becomes the runtime source of truth.

Alternative considered: run `npx hyperframes add` on every user request. Rejected because request-time package execution is slower, harder to secure, and more failure-prone. Alternative considered: ask the model to generate component HTML. Rejected because the whole purpose is to avoid untrusted reconstructions of known-good blocks.

**2. Materialize only selected/used components into each project.**

The application should maintain a global trusted registry cache, but each project receives only the component files it actually uses. Materialization copies trusted source files into the project's logical file tree, usually under `compositions/<component-id>.html` plus any required `assets/` paths. It records an installed-component manifest for that project.

Alternative considered: pre-install every component into every project. Rejected because it bloats projects, makes versioning noisy, and hides which components are actually part of the video.

**3. Add a typed approved tool for component materialization.**

Introduce an approved prompt-agent/server tool such as `materialize_hyperframe_components`. The input is a bounded placement plan:

- `projectId` or create-project intent;
- `components[]` with catalog id, placement start, duration, track index, width, height, and optional scene/role notes;
- host insertion mode such as append to timeline, replace marker, or ensure snippet exists.

The tool validates component ids against the trusted materializable registry, copies files, injects canonical snippets, updates `index.html`, records versions/snapshots, and returns installed file paths plus any warnings. The agent can decide creative placement, but cannot provide replacement component file contents.

Alternative considered: let the agent directly write `project_files` rows. Rejected because it bypasses catalog validation, path safety, source auditing, and the no-recreated-component rule.

**4. Treat generated host composition and trusted components as separate responsibilities.**

Generation can still create or update `index.html`, scene wrappers, transitions, captions, and non-registry custom scenes. For selected registry components, the generated host must reference canonical snippets or tool-inserted markers. The materializer then enforces that the referenced `data-composition-src` resolves to trusted project files.

If the model outputs a fake file path for a selected component, the materializer replaces/repairs it when safe or returns a validation error that drives a retry. If the model attempts to inline or create `compositions/<selected-id>.html`, the trusted registry file wins and the generated file is discarded or moved aside as a custom draft.

Alternative considered: forbid the model from mentioning component snippets at all. Rejected because the model still needs to plan timing and scene order; the safe boundary is component internals, not host orchestration.

**5. Preserve an explicit prompt-only fallback.**

Some catalog examples/components may lack trusted materialization files, or a user may intentionally want inspiration rather than installation. Those entries remain selectable as prompt references. The UI and payload should distinguish `prompt-only` from `materializable` selections.

Alternative considered: hide non-materializable items. Rejected because examples and technique references are still valuable for style and pacing.

**6. Surface source state in Studio.**

Studio should show materialized files in the project tree with registry/source metadata. Trusted component files should default to read-only or visibly "registry-managed" to discourage accidental corruption. If editing is needed, users can detach/duplicate the component into a custom file, which removes the trusted-source guarantee for that copy.

Alternative considered: make registry files ordinary editable files. Rejected because silent edits weaken the assurance that the project is using a known-good HyperFrames-authored block.

**7. Keep source and placement metadata auditable.**

Each materialization records component id, source URL, source revision/package version, content hashes, installed paths, host snippets, placement data, actor, timestamp, and project snapshot/version ids. This allows render failures to be traced to either trusted component source, host placement, or later user customization.

Alternative considered: only store copied file contents. Rejected because it prevents explaining which registry version a project used.

## Risks / Trade-offs

- **Registry source shape changes** -> Keep sync validation strict and fail `--check` when a materializable component cannot produce expected files/snippets.
- **Large generated bundle** -> Keep runtime manifest compact and store larger file bodies server-side or in a generated server-only artifact; materialize on demand.
- **Component dependencies/assets are incomplete** -> Validate copied files by rendering/previewing representative materialized components during sync or tests.
- **Model still tries to recreate selected components** -> Add system-prompt rules, schema boundaries, post-generation validation, and tests that reject AI-provided contents for selected component paths.
- **Host snippet injection can disrupt generated scene layout** -> Use explicit placement plans and markers where possible, then validate `data-start`, `data-duration`, `data-track-index`, width, and height.
- **Read-only registry files may frustrate advanced users** -> Provide a deliberate "detach/customize" path that duplicates files and marks them as custom.
- **Runtime installer failures block generation** -> Support prompt-only fallback only when the user did not request real component installation; otherwise surface a clear error instead of silently recreating HTML.

## Migration Plan

1. Add materializable registry schemas and generated/cache artifact support for trusted component files, canonical snippets, hashes, and source metadata.
2. Extend catalog helpers so selections expose `materializable` state, canonical snippet, install command, component id, and source revision.
3. Implement a project materializer service that copies trusted component files/assets into `project_files`/project storage and injects canonical snippets into `index.html`.
4. Add approved prompt-agent/server tool schemas for component placement and materialization results.
5. Update generation flow so selected materializable components are validated and materialized after project creation/update, with retry/error behavior when the host composition tries to recreate component internals.
6. Update main-page UI copy and controls to distinguish prompt-only references from real installable components and allow users to express placement intent.
7. Update Studio to show registry-managed component files, source metadata, snapshots, and detach/customize affordances.
8. Add tests for sync validation, materializer path safety, canonical App Showcase installation, agent approval, no-AI-recreated component paths, Studio preview, render handoff, and rollback/snapshot behavior.

Rollback: keep generated projects' `index.html` and copied files as ordinary project files, disable new materialization entry points, and keep gallery selections as prompt-only context. No existing render pipeline behavior needs to be removed.

## Open Questions

- Should trusted component file bodies live in a committed generated artifact, Cloudflare assets, R2, or be populated by an admin sync job?
- Should registry-managed component files be strictly read-only, or editable with an immediate "detached/custom" state?
- Should materialization happen before generation with placeholders, after generation with injection/validation, or both depending on whether a project already exists?
- What is the minimum sync-time validation for a component to be marked materializable: file presence only, HyperFrames lint, snapshot render, or full MP4 render?
