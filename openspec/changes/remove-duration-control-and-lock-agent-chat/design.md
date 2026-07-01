## Context

The main page uses a tabbed creation card for AI Agent, Manual Prompt, and Render workflows. The route currently renders a Duration dropdown and explanatory helper card for non-render tabs, derives dropdown options from `DURATION_PRESETS`, and keeps `durationSec` in TanStack Form state for generation and render summaries.

The AI Agent tab delegates its chat UI to `PromptAgentPanel`. The panel already orders the conversation stream above the composer, but the outer panel and right creation column do not enforce a full height/min-height chain. As the message list grows, the panel can expand the page instead of confining overflow to the conversation stream.

## Goals / Non-Goals

**Goals:**

- Remove the visible Duration dropdown and its helper copy from the main creation page.
- Keep existing generation behavior by preserving `durationSec` as internal form state with the default duration and agent-applied duration updates.
- Keep the Ask the agent composer at the bottom of the AI Agent panel.
- Lock the conversation stream to the available responsive panel height and use an internal scrollbar for long threads.
- Keep mobile and desktop layouts usable without overlapping controls.

**Non-Goals:**

- Change generation, render, prompt-agent, Worker, or validation APIs.
- Remove duration from generated prompts, prompt packages, render summaries, or server-side schemas.
- Redesign the entire creation card, gallery workspace, or Studio duration controls.
- Add new persistence or user preferences for chat height.

## Decisions

1. Hide duration controls only at the main-page UI layer.
   - Keep `durationSec` in `CreationIntakeFormValues` and preserve `setDurationSec` because prompt-agent packages can still supply a duration and generation still needs a validated value.
   - Remove only the visible dropdown/helper block and any imports or memoized values used solely by that block.
   - Alternative considered: remove duration from the form model entirely. Rejected because downstream generation, render labels, and prompt-agent tooling still use it as canonical creation state.

2. Treat the agent conversation as the only scrollable region inside the agent panel.
   - Use a height chain on the creation column/card/content and `PromptAgentPanel` so the panel has a bounded responsive height.
   - Use `min-h-0` on flex/grid ancestors that contain the scrollable conversation stream.
   - Keep the composer section as a non-scrolling bottom region, with attachment chips and errors remaining near the input.
   - Alternative considered: make the whole right column scroll. Rejected because it can move the composer away from the bottom and makes active chat flows feel less stable.

3. Prefer viewport-relative constraints over fixed pixel-only heights.
   - Preserve reasonable minimum heights for empty/short conversations, but use viewport-derived maximum height on desktop so the card fits the page beneath the app header.
   - On smaller/mobile layouts, allow the page to stack naturally while still preventing the message stream from forcing overlap or hiding the composer.
   - Alternative considered: hard-code a single chat height. Rejected because the layout already adapts between mobile and desktop and header/selected-context content can change available space.

4. Keep tests focused on visible behavior and layout contracts.
   - Update tests that expect duration presets/control visibility only if those expectations are tied to the main page UI.
   - Add or update component/layout assertions that the prompt-agent conversation region is scrollable and the composer remains rendered after a populated thread.
   - Use browser verification for desktop and mobile screenshots if available during implementation, because this is primarily a responsive layout change.

## Risks / Trade-offs

- Hidden duration state may surprise future maintainers -> Leave duration helpers and schemas intact, remove only UI-specific imports and add focused tests around preserved generation behavior.
- Scroll constraints can fail without a complete `min-h-0` chain -> Verify the actual rendered page at desktop and mobile widths and adjust the parent/card/content classes together.
- Attachments, voice errors, or selected gallery context can reduce available chat space -> Keep these regions outside the scroll stream where they belong, and let only the conversation stream absorb overflow.
- Removing the visible control supersedes the previous "Expanded duration choices" UI contract -> Capture the spec delta explicitly so archived requirements do not reintroduce the dropdown.

## Migration Plan

1. Remove the duration dropdown/helper UI from the main route while preserving internal duration state.
2. Update layout classes for the right creation column/card, card content, and `PromptAgentPanel` so the conversation stream scrolls internally.
3. Update tests for removed visible duration UI and bounded chat thread behavior.
4. Run focused unit/component tests, typecheck, and responsive browser verification.

Rollback is a UI revert only: restore the duration control block and prior panel classes. No data or API migration is required.

## Open Questions

None.
