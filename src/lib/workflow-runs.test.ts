import { describe, expect, it } from "vitest";

import {
  assertWorkflowTransition,
  isActiveWorkflowStatus,
  workflowRunToClient,
} from "./workflow-runs";

describe("workflow run lifecycle helpers", () => {
  it("identifies active workflow statuses for quota enforcement", () => {
    expect(isActiveWorkflowStatus("intake")).toBe(true);
    expect(isActiveWorkflowStatus("queued")).toBe(true);
    expect(isActiveWorkflowStatus("running")).toBe(true);
    expect(isActiveWorkflowStatus("awaiting_approval")).toBe(true);
    expect(isActiveWorkflowStatus("succeeded")).toBe(false);
    expect(isActiveWorkflowStatus("failed")).toBe(false);
    expect(isActiveWorkflowStatus("cancelled")).toBe(false);
  });

  it("enforces valid workflow status transitions", () => {
    expect(() => assertWorkflowTransition("intake", "queued")).not.toThrow();
    expect(() => assertWorkflowTransition("intake", "cancelled")).not.toThrow();
    expect(() => assertWorkflowTransition("queued", "running")).not.toThrow();
    expect(() => assertWorkflowTransition("running", "succeeded")).not.toThrow();
    expect(() => assertWorkflowTransition("running", "failed")).not.toThrow();
    expect(() => assertWorkflowTransition("awaiting_approval", "cancelled")).not.toThrow();
    expect(() => assertWorkflowTransition("succeeded", "running")).toThrow("invalid workflow transition");
  });

  it("serializes workflow runs into compact client state", () => {
    const client = workflowRunToClient({
      id: "run-1",
      organizationId: "org-1",
      userId: "user-1",
      projectId: "project-1",
      skillId: "website-to-video",
      status: "succeeded",
      phase: "complete",
      inputUrl: "https://example.com",
      options: { durationSec: 8 },
      progress: { current: 6, total: 6, label: "Complete" },
      artifactManifest: {
        runId: "run-1",
        skillId: "website-to-video",
        artifacts: [],
        skippedSteps: [{ id: "voice", label: "Voice", reason: "Not configured" }],
      },
      error: null,
      createdAt: new Date("2026-06-29T12:00:00Z"),
      updatedAt: new Date("2026-06-29T12:01:00Z"),
      startedAt: new Date("2026-06-29T12:00:05Z"),
      completedAt: new Date("2026-06-29T12:01:00Z"),
    });

    expect(client).toMatchObject({
      id: "run-1",
      status: "succeeded",
      phase: "complete",
      projectId: "project-1",
      studioUrl: "/projects/project-1/studio",
      skippedSteps: [{ id: "voice" }],
    });
    expect("organizationId" in client).toBe(false);
  });

  it("serializes intake workflow runs with stored options", () => {
    const client = workflowRunToClient({
      id: "run-intake",
      organizationId: "org-1",
      userId: "user-1",
      projectId: null,
      skillId: "website-to-video",
      status: "intake",
      phase: "preflight",
      inputUrl: "",
      options: {
        intake: {
          source: "main-page-chat",
          prompt: "Make a compact launch video",
          durationSec: 8,
        },
      },
      progress: { current: 0, total: 6, label: "Ready for brief" },
      artifactManifest: null,
      error: null,
      createdAt: new Date("2026-06-29T12:00:00Z"),
      updatedAt: new Date("2026-06-29T12:01:00Z"),
      startedAt: null,
      completedAt: null,
    });

    expect(client).toMatchObject({
      id: "run-intake",
      status: "intake",
      inputUrl: "",
      options: {
        intake: {
          prompt: "Make a compact launch video",
        },
      },
    });
  });
});
