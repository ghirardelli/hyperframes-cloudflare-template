import { describe, expect, it } from "vitest";

import {
  findLatestGeneratedHyperframe,
  findLatestStartedWorkflowRun,
  findLatestWorkflowRun,
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

const workflowOutput = {
  id: "run-1",
  projectId: "project-1",
  skillId: "website-to-video",
  status: "succeeded",
  phase: "complete",
  inputUrl: "https://example.com/",
  options: {},
  progress: { current: 6, total: 6, label: "Complete" },
  artifactManifest: {
    runId: "run-1",
    skillId: "website-to-video",
    artifacts: [
      {
        path: "pipeline/website-to-video/run-1/DESIGN.md",
        role: "design",
        contentType: "text/markdown; charset=utf-8",
        size: 120,
        storage: { provider: "bunny-storage", key: "orgs/org-1/users/user-1/projects/project-1/workspace/pipeline/website-to-video/run-1/DESIGN.md" },
      },
    ],
    skippedSteps: [{ id: "voice", label: "Voice", reason: "Not configured" }],
    studioUrl: "/projects/project-1/studio",
  },
  artifacts: [],
  skippedSteps: [{ id: "voice", label: "Voice", reason: "Not configured" }],
  error: null,
  studioUrl: "/projects/project-1/studio",
  createdAt: "2026-06-29T12:00:00.000Z",
  updatedAt: "2026-06-29T12:01:00.000Z",
  startedAt: null,
  completedAt: "2026-06-29T12:01:00.000Z",
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

  it("finds the latest workflow run output from workflow tool calls", () => {
    const match = findLatestWorkflowRun([
      {
        parts: [
          {
            type: "tool-call",
            id: "workflow-call-1",
            name: "start_hyperframes_workflow",
            output: workflowOutput,
          },
        ],
      },
    ]);

    expect(match).toEqual({ key: "tool-call:workflow-call-1", output: workflowOutput });
  });

  it("finds only started workflow runs for wizard routing", () => {
    const match = findLatestStartedWorkflowRun([
      {
        parts: [
          {
            type: "tool-call",
            id: "status-call-1",
            name: "get_hyperframes_workflow_run",
            output: { ...workflowOutput, id: "status-run" },
          },
          {
            type: "tool-call",
            id: "start-call-1",
            name: "start_hyperframes_workflow",
            output: workflowOutput,
          },
        ],
      },
    ]);

    expect(match).toEqual({ key: "tool-call:start-call-1", output: workflowOutput });
  });

  it("formats tool names, states, and previews for compact UI rendering", () => {
    expect(promptAgentToolLabel("generate_hyperframe")).toBe("Generate HyperFrame");
    expect(promptAgentToolLabel("materialize_hyperframe_components")).toBe("Install trusted components");
    expect(promptAgentToolLabel("start_hyperframes_workflow")).toBe("Start workflow");
    expect(promptAgentToolLabel("list_hyperframes_skill_catalog")).toBe("Skill catalog");
    expect(promptAgentToolLabel("route_hyperframes_workflow")).toBe("Workflow route");
    expect(promptAgentToolLabel("load_hyperframes_skill")).toBe("Load skill");
    expect(formatAgentToolState("approval-requested")).toBe("approval");
    expect(safePreview({ prompt: "x".repeat(250) }, 40)).toHaveLength(40);
    expect(safePreview({ markdown: "x".repeat(10_000) }, 80)).toHaveLength(80);
  });
});
