## Context

The current prompt agent is already implemented as a TanStack AI chat loop: the browser uses `useChat` with `fetchServerSentEvents("/api/agent/chat")`, the Worker calls `chat()`, and typed tools expose HyperFrames guidance, project inspection, prompt package validation, local draft application, and approved generation.

That implementation intentionally distilled `src/lib/hyperframes-skill.ts` into a small `get_hyperframes_guidelines` tool. The upstream HyperFrames repository now provides a much richer `skills/` tree: `/hyperframes` as the router, creation workflows such as `/website-to-video` and `/product-launch-video`, and domain skills such as `/hyperframes-core`, `/hyperframes-animation`, `/hyperframes-creative`, `/hyperframes-media`, `/media-use`, `/hyperframes-cli`, and `/hyperframes-registry`.

Those upstream files are not TanStack AI Provider Skills. They are markdown instruction packs intended for coding agents and installed by `npx skills add`. Our app-hosted TanStack agent will not automatically load them as slash commands. We need to transform a controlled copy of those markdown files into app-level catalog data and typed tools.

The user wants the sync source to be the private fork `github.com/aaronpie/hyperframes.git` rather than the public upstream. That is reasonable: the app should depend on a repository we control, should pin a commit, and should never require public upstream availability at runtime.

The hardest workflow is `/website-to-video`. Its `SKILL.md` describes a full seven-step pipeline: capture, brand design, strategy brief, storyboard/script, voice/timing/captions, composition build, lint/validate/snapshots, and final Studio delivery. Our current app can route intent and generate a single HTML composition, but it does not yet have a long-running workflow runner that can execute `npx hyperframes capture`, persist artifacts, generate voice, build multiple files, validate snapshots, or resume artifact gates.

## Goals / Non-Goals

**Goals:**

- Sync HyperFrames skill metadata and instruction text from `github.com/aaronpie/hyperframes.git` into a generated local app artifact.
- Pin the generated catalog to a source repo URL and commit SHA so generated behavior is auditable and reproducible.
- Expose skill discovery, workflow routing, and selected skill instruction loading through typed TanStack AI tools.
- Teach the prompt agent to start with the `/hyperframes` router for video/composition requests, then load the relevant workflow/domain skills before preparing a structured prompt package.
- Support a first-pass `/website-to-video` mode that recognizes URL-to-video intent and prepares a grounded plan/prompt while disclosing that full pipeline execution is not yet available.
- Preserve the existing approval boundary: only `generate_hyperframe` can create/update project HTML, and it remains `needsApproval: true`.
- Keep private repo credentials local to developer/CI sync, never in the browser, Worker response bodies, generated catalog output, or client bundle as secrets.

**Non-Goals:**

- Running the full `/website-to-video` pipeline in this change.
- Adding autonomous long-running jobs, resumable artifact gates, capture storage, TTS, or validation snapshots in this first pass.
- Mounting upstream HyperFrames Studio Server or executing arbitrary skill markdown as code.
- Adding TanStack Provider Skills integration. HyperFrames skills are local instruction files, not hosted provider-managed skills.
- Replacing the existing manual Generate path or existing approved generation tool.

## Decisions

**1. Sync from the private fork at build/developer time, not at request time.**

Add a script such as `scripts/sync-hyperframes-skills.mjs` that fetches `skills/**/SKILL.md` and selected reference indexes from `github.com/aaronpie/hyperframes.git`. The script writes a deterministic generated artifact, for example `src/generated/hyperframes-skills.json` plus `src/generated/hyperframes-skills.ts`.

The artifact stores:

- source repo URL;
- source commit SHA;
- generated timestamp;
- skill id, name, description, tags, group, path;
- normalized markdown body;
- reference file index for workflows that include `references/`;
- optional content hash per file.

The app imports the generated artifact at runtime. The Worker never clones GitHub during a user chat request.

Alternative considered: fetch the private repo from the Worker on demand. That would require runtime GitHub credentials, introduce request latency/failure modes, and risk leaking private source metadata into app behavior.

**2. Use Git over HTTPS/SSH locally and CI secrets for private repo access.**

The sync script should support both:

- local developers with normal `git` credentials, SSH agent, or GitHub CLI auth;
- CI with a read-only deploy key or fine-grained token scoped only to `aaronpie/hyperframes`.

The token or deploy key is never committed. If CI cannot access the private repo, it can still build from the already-committed generated artifact, but a dedicated "verify catalog is current" check should fail only on sync-specific jobs.

Alternative considered: add the private repo as a git submodule. That gives commit pinning but complicates deploy/build setup and can break installs for contributors without private access. A generated artifact keeps the app build self-contained.

**3. Represent upstream slash skills as app-level catalog tools.**

Add shared schemas and server tools:

- `list_hyperframes_skill_catalog`: returns compact metadata and source revision.
- `route_hyperframes_workflow`: accepts the user request and optional context, returns a selected workflow id, confidence, rationale, and required domain skills.
- `load_hyperframes_skill`: returns bounded instruction text for a selected skill and optional reference summaries.

The model sees only the skill text it needs for the turn. The UI sees compact tool cards rather than raw large markdown dumps.

Alternative considered: inject all skill markdown into the system prompt. That wastes context, makes updates harder to test, and increases the chance of unrelated workflows steering answers.

**4. Keep first-pass skill use prompt-oriented, not pipeline-executing.**

For `/website-to-video`, the first implementation routes correctly and can prepare:

- site URL and user intent summary;
- video type/duration/aspect recommendation;
- brand/story questions if needed;
- a structured prompt package suitable for the existing `generate_hyperframe` path;
- a clear capability note that capture, voice, multi-artifact build, validation, and snapshots require the future workflow runner.

It MUST NOT claim it has run `npx hyperframes capture`, produced `DESIGN.md`, generated narration, validated snapshots, or delivered a Studio project unless those systems actually exist.

Alternative considered: approximate capture with plain fetch in the first pass and present it as `/website-to-video`. That would blur the guarantee of the upstream skill and make later full parity harder to reason about.

**5. Add an explicit future workflow runner boundary.**

Document and leave extension points for a later `hyperframes_workflow_runs` system:

- authenticated job creation from the prompt agent;
- Container-backed execution for `npx hyperframes capture`, `lint`, `validate`, `snapshot`, and possibly `render`;
- artifact persistence in project files/R2;
- resumable gates for user approvals on storyboard, voice/captions, and final render;
- progress streaming back to the agent/workspace.

The first-pass tools may return `fullPipelineAvailable: false` for workflows that require this runner.

Alternative considered: build the runner now. That is the correct end state, but it crosses data model, container execution, artifact storage, UX, and verification boundaries and should be its own implementation phase.

**6. Keep generation and project mutation centralized.**

Skill catalog tools can inspect and prepare, but they do not create projects or replace HTML. They feed the existing structured prompt package and approved `generate_hyperframe` tool. This preserves the current auth, tenant, OpenRouter key, lint retry, version history, and project file mirroring paths.

Alternative considered: give skill tools direct project-write behavior. That duplicates the mutation boundary and weakens approval semantics.

## Risks / Trade-offs

- **Private repo access can fail in CI** -> Commit the generated catalog artifact and make sync verification a separate job or explicit npm script. Use a read-only deploy key/token for automated refreshes.
- **Generated markdown could bloat the client bundle** -> Keep the generated artifact server-only where possible, return compact catalog summaries to the browser, and bound `load_hyperframes_skill` output.
- **Skill instructions can drift from installed HyperFrames packages** -> Store source commit SHA and package versions in the catalog metadata; add tests that assert required skill ids exist and that the catalog source revision is visible.
- **The agent may overclaim `/website-to-video` execution** -> Add system prompt rules and tests requiring capability disclosure when a selected workflow needs the unavailable full runner.
- **Prompt-agent context can become noisy** -> Load only `/hyperframes` plus the selected workflow and a small set of domain skills selected by the router.
- **Future full pipeline is larger than the first pass** -> Keep the workflow-runner design boundary explicit and avoid creating fake capture/storyboard artifacts in the first pass.

## Migration Plan

1. Add the sync script and generated catalog artifact using `github.com/aaronpie/hyperframes.git` as the default source.
2. Add schemas for skill catalog metadata, workflow route results, loaded instruction payloads, and unavailable pipeline notices.
3. Add server-side prompt-agent tools for catalog listing, workflow routing, and skill loading.
4. Update the prompt-agent system prompt to use `/hyperframes` routing for video/composition requests before prompt package preparation.
5. Update UI labels/tool cards so users can see when the agent is loading HyperFrames skill guidance.
6. Add tests for catalog parsing, required skill presence, private-source metadata, routing outcomes, skill loading bounds, and `/website-to-video` first-pass disclosure.
7. Verify `npm test`, `npm run typecheck`, and `npm run build`.

Rollback is straightforward: remove the skill catalog tools and system-prompt routing changes while keeping the existing `get_hyperframes_guidelines` and `generate_hyperframe` tools.

## Open Questions

- What exact private repo access method should CI use: deploy key, fine-grained GitHub token, or GitHub App installation token?
- Should generated skill markdown be committed to the app repo, or should CI regenerate it during release builds and fail when unavailable?
- How much reference-file content should first-pass `load_hyperframes_skill` return: only `SKILL.md`, summaries of `references/`, or selected full references for small files?
- Should full `/website-to-video` parity be planned as a dedicated follow-up change named around workflow runs/artifact pipeline?
