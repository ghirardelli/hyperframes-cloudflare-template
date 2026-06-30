import { describe, expect, it } from "vitest";

import { buildWizardStagePlan, stageIdForArtifactPath } from "./pipeline-wizard";
import type { WorkflowRunOutput } from "./prompt-agent-client";

function workflowRun(overrides: Partial<WorkflowRunOutput> = {}): WorkflowRunOutput {
  return {
    id: "run-1",
    projectId: "project-1",
    skillId: "website-to-video",
    status: "succeeded",
    phase: "complete",
    inputUrl: "https://example.com/",
    options: {},
    progress: { current: 6, total: 6, label: "Complete" },
    artifactManifest: null,
    artifacts: [
      {
        path: "pipeline/website-to-video/run-1/DESIGN.md",
        role: "design",
        contentType: "text/markdown",
        size: 10,
        storage: { provider: "postgres", key: null },
      },
      {
        path: "pipeline/website-to-video/run-1/SCRIPT.md",
        role: "script",
        contentType: "text/markdown",
        size: 10,
        storage: { provider: "postgres", key: null },
      },
      {
        path: "index.html",
        role: "composition",
        contentType: "text/html",
        size: 10,
        storage: { provider: "postgres", key: null },
      },
    ],
    skippedSteps: [
      {
        id: "voice",
        label: "Voiceover generation",
        reason: "Voice is not configured.",
      },
    ],
    error: null,
    studioUrl: "/projects/project-1/studio",
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:01:00.000Z",
    startedAt: null,
    completedAt: "2026-06-30T00:01:00.000Z",
    ...overrides,
  };
}

describe("pipeline wizard stage planning", () => {
  it("maps workflow artifacts to user-facing stages", () => {
    const plan = buildWizardStagePlan(workflowRun());

    expect(plan.activeStageId).toBe("build");
    expect(plan.stages.find((stage) => stage.id === "design")).toMatchObject({
      status: "ready",
      editable: true,
    });
    expect(plan.stages.find((stage) => stage.id === "vo-timing")).toMatchObject({
      status: "skipped",
      skippedReason: "Voice is not configured.",
    });
  });

  it("classifies artifact paths into stages", () => {
    expect(stageIdForArtifactPath("pipeline/website-to-video/run-1/DESIGN.md")).toBe("design");
    expect(stageIdForArtifactPath("SCRIPT.md")).toBe("script");
    expect(stageIdForArtifactPath("STORYBOARD.md")).toBe("storyboard");
    expect(stageIdForArtifactPath("index.html")).toBe("build");
    expect(stageIdForArtifactPath("snapshots/check.png")).toBe("validate");
  });

  it("marks the active backend phase as running for in-progress runs", () => {
    const plan = buildWizardStagePlan(workflowRun({ status: "running", phase: "capture", artifacts: [] }));

    expect(plan.activeStageId).toBe("capture");
    expect(plan.stages.find((stage) => stage.id === "capture")?.status).toBe("running");
  });
});
