import { describe, expect, it } from "vitest";

import {
  findLatestGeneratedHyperframe,
  formatAgentToolState,
  promptAgentToolLabel,
  safePreview,
} from "./prompt-agent-client";

const generatedOutput = {
  html: "<!DOCTYPE html>",
  project: { id: "project-1", title: "Launch Reel" },
  model: "openrouter/auto",
  attempts: 1,
  durationMs: 50,
  lintOk: true,
  lintErrors: [],
};

describe("prompt agent client helpers", () => {
  it("finds unapplied generation output from tool call parts", () => {
    const match = findLatestGeneratedHyperframe(
      [
        {
          parts: [
            {
              type: "tool-call",
              id: "call-1",
              name: "generate_hyperframe",
              output: generatedOutput,
            },
          ],
        },
      ],
      new Set(),
    );

    expect(match).toEqual({ key: "tool-call:call-1", output: generatedOutput });
  });

  it("ignores generation output that has already been applied", () => {
    const match = findLatestGeneratedHyperframe(
      [
        {
          parts: [
            {
              type: "tool-call",
              id: "call-1",
              name: "generate_hyperframe",
              output: generatedOutput,
            },
          ],
        },
      ],
      new Set(["tool-call:call-1"]),
    );

    expect(match).toBeNull();
  });

  it("parses generated output from JSON tool-result content", () => {
    const match = findLatestGeneratedHyperframe(
      [
        {
          parts: [
            {
              type: "tool-result",
              toolCallId: "call-2",
              content: JSON.stringify(generatedOutput),
              state: "complete",
            },
          ],
        },
      ],
      new Set(),
    );

    expect(match).toEqual({ key: "tool-result:call-2", output: generatedOutput });
  });

  it("formats tool names, states, and previews for compact UI rendering", () => {
    expect(promptAgentToolLabel("generate_hyperframe")).toBe("Generate HyperFrame");
    expect(promptAgentToolLabel("list_hyperframes_skill_catalog")).toBe("Skill catalog");
    expect(promptAgentToolLabel("route_hyperframes_workflow")).toBe("Workflow route");
    expect(promptAgentToolLabel("load_hyperframes_skill")).toBe("Load skill");
    expect(formatAgentToolState("approval-requested")).toBe("approval");
    expect(safePreview({ prompt: "x".repeat(250) }, 40)).toHaveLength(40);
    expect(safePreview({ markdown: "x".repeat(10_000) }, 80)).toHaveLength(80);
  });
});
