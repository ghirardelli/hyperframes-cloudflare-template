import { describe, expect, it } from "vitest";

import {
  buildWorkflowRunOptions,
  extractFirstHttpUrl,
  getWorkflowIntakePayload,
} from "./workflow-intake";

describe("workflow intake helpers", () => {
  it("stores main-page prompt and selected context as structured intake options", () => {
    const options = buildWorkflowRunOptions({
      prompt: " Make a product launch video ",
      sourceUrl: "https://example.com/",
      durationSec: 8,
      selectedGalleryContext: {
        examples: [
          {
            id: "template-1",
            kind: "example",
            name: "Launch",
            sourceUrl: "https://example.com/template",
            promptText: "Use sharp editorial pacing.",
            materialization: { state: "prompt-only" },
          },
        ],
        components: [],
      },
    });

    expect(getWorkflowIntakePayload(options)).toMatchObject({
      source: "main-page-chat",
      prompt: "Make a product launch video",
      sourceUrl: "https://example.com/",
      durationSec: 8,
      selectedGalleryContext: {
        examples: [expect.objectContaining({ id: "template-1" })],
      },
    });
  });

  it("extracts the first URL from a prompt when one is present", () => {
    expect(extractFirstHttpUrl("Turn https://example.com into a launch video")).toBe(
      "https://example.com",
    );
    expect(extractFirstHttpUrl("No source URL yet")).toBeNull();
  });
});
