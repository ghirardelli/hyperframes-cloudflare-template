## 1. Main Page Duration UI

- [x] 1.1 Remove the non-render-tab Duration dropdown and helper copy from `src/routes/index.tsx`.
- [x] 1.2 Remove UI-only duration imports, memoized duration options, and icon usage that become unused after the dropdown is removed.
- [x] 1.3 Preserve internal `durationSec` form defaults, normalization, generation payloads, render summaries, and prompt-agent duration application.

## 2. Agent Chat Layout

- [x] 2.1 Update the main-page right creation column/card/content classes so the AI Agent panel can occupy a bounded responsive height.
- [x] 2.2 Update `PromptAgentPanel` flex sizing so the conversation stream is the only internally scrollable region.
- [x] 2.3 Keep the Ask the agent composer, attachment chips, voice/attachment errors, and chat actions anchored below the conversation stream.
- [x] 2.4 Verify empty, streaming, long-thread, attachment, and error states do not overlap the composer on desktop or mobile widths.

## 3. Tests

- [x] 3.1 Update or add main-page tests to assert the Duration dropdown and helper copy are not rendered in AI Agent or Manual Prompt mode.
- [x] 3.2 Update or add prompt-agent panel tests to assert the conversation stream uses scrollable overflow and the composer remains rendered below it.
- [x] 3.3 Keep existing duration helper/schema tests that cover internal duration normalization and long-duration preservation.

## 4. Verification

- [x] 4.1 Run focused unit/component tests for main-page creation flow and prompt-agent panel behavior.
- [x] 4.2 Run `npm run typecheck`.
- [x] 4.3 Run responsive browser verification for the main page at desktop and mobile widths, confirming the chat thread scrolls internally and the composer stays at the bottom.
