import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_WORKFLOW_LIMITS,
  HYPERFRAMES_WORKFLOW_COMMANDS,
  WEBSITE_TO_VIDEO_OUTPUT_PLAN,
  WEBSITE_TO_VIDEO_SKIPPED_STEPS,
  WEBSITE_TO_VIDEO_STAGE_PLAN,
  createWorkflowArtifactManifest,
  isWebsiteToVideoWorkflowEnabled,
  toBoundedWorkflowError,
  validateWorkflowRedirects,
  validateWorkflowUrl,
  workflowProjectPath,
} from "./website-to-video-workflow";

describe("website-to-video workflow configuration", () => {
  it("defines the bounded HyperFrames CLI commands used by the workflow container", () => {
    expect(HYPERFRAMES_WORKFLOW_COMMANDS.capture).toEqual(
      expect.arrayContaining(["hyperframes", "capture", "--json"]),
    );
    expect(HYPERFRAMES_WORKFLOW_COMMANDS.lint).toEqual(
      expect.arrayContaining(["hyperframes", "lint", "--json"]),
    );
    expect(HYPERFRAMES_WORKFLOW_COMMANDS.validate).toEqual(
      expect.arrayContaining(["hyperframes", "validate", "--json"]),
    );
    expect(HYPERFRAMES_WORKFLOW_COMMANDS.snapshot).toEqual(
      expect.arrayContaining(["hyperframes", "snapshot"]),
    );
  });

  it("exposes cheap-first stage, limit, skipped-step, and output decisions", () => {
    expect(WEBSITE_TO_VIDEO_STAGE_PLAN).toEqual([
      "preflight",
      "capture",
      "compose",
      "validate",
      "persist",
      "complete",
    ]);
    expect(DEFAULT_WORKFLOW_LIMITS.maxRedirects).toBeGreaterThan(0);
    expect(DEFAULT_WORKFLOW_LIMITS.maxArtifactBytes).toBeLessThanOrEqual(10 * 1024 * 1024);
    expect(WEBSITE_TO_VIDEO_SKIPPED_STEPS.map((step) => step.id)).toEqual(
      expect.arrayContaining(["voice", "timing", "final-render"]),
    );
    expect(WEBSITE_TO_VIDEO_OUTPUT_PLAN.projectWorkspace).toContain("DESIGN.md");
    expect(WEBSITE_TO_VIDEO_OUTPUT_PLAN.bunnyStream).toContain("stage-video");
  });

  it("uses an explicit feature flag for the workflow runner", () => {
    expect(isWebsiteToVideoWorkflowEnabled({ ENABLE_WEBSITE_TO_VIDEO_WORKFLOW: "true" })).toBe(true);
    expect(isWebsiteToVideoWorkflowEnabled({ ENABLE_WEBSITE_TO_VIDEO_WORKFLOW: "false" })).toBe(false);
    expect(isWebsiteToVideoWorkflowEnabled({})).toBe(false);
  });

  it("validates public http and https URLs and blocks unsafe network targets", () => {
    expect(validateWorkflowUrl("https://example.com/product").ok).toBe(true);
    expect(validateWorkflowUrl("http://example.com").ok).toBe(true);

    for (const unsafe of [
      "ftp://example.com/file",
      "https://localhost:3000",
      "https://127.0.0.1",
      "https://10.0.0.1",
      "https://172.16.0.1",
      "https://192.168.1.1",
      "https://169.254.169.254",
      "https://[::1]",
      "https://metadata.google.internal",
      "https://printer.local",
    ]) {
      expect(validateWorkflowUrl(unsafe), unsafe).toMatchObject({ ok: false });
    }
  });

  it("re-validates redirects before capture", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://127.0.0.1/admin" } }));

    await expect(
      validateWorkflowRedirects("https://example.com", {
        fetcher: fetchMock,
        maxRedirects: 3,
      }),
    ).resolves.toMatchObject({ ok: false, reason: expect.stringContaining("unsafe redirect") });
  });

  it("creates bounded artifact manifests with provider pointers and skipped steps", () => {
    const manifest = createWorkflowArtifactManifest({
      runId: "run-1",
      skillId: "website-to-video",
      artifacts: [
        {
          path: "pipeline/website-to-video/run-1/DESIGN.md",
          role: "design",
          contentType: "text/markdown; charset=utf-8",
          size: 120,
          storage: {
            provider: "bunny-storage",
            key: "orgs/org-1/users/user-1/projects/project-1/workspace/pipeline/website-to-video/run-1/DESIGN.md",
          },
        },
        {
          path: "renders/run-1-stage.mp4",
          role: "stage-video",
          contentType: "video/mp4",
          size: 0,
          storage: {
            provider: "bunny-stream",
            key: "stream-video-1",
            streamLibraryId: "library-1",
            streamVideoId: "stream-video-1",
            streamStatus: "uploaded",
          },
        },
      ],
      skippedSteps: WEBSITE_TO_VIDEO_SKIPPED_STEPS,
    });

    expect(manifest.artifacts[0].storage.provider).toBe("bunny-storage");
    expect(manifest.artifacts[1].storage.provider).toBe("bunny-stream");
    expect(manifest.skippedSteps.map((step) => step.id)).toContain("final-render");
  });

  it("normalizes workflow project paths under the website-to-video run folder", () => {
    expect(workflowProjectPath("run-1", "DESIGN.md")).toBe(
      "pipeline/website-to-video/run-1/DESIGN.md",
    );
    expect(() => workflowProjectPath("run-1", "../secret.txt")).toThrow("invalid workflow path");
  });

  it("bounds user-visible workflow errors", () => {
    const error = toBoundedWorkflowError(new Error("x".repeat(2_000)), "capture", 80);
    expect(error.phase).toBe("capture");
    expect(error.message.length).toBeLessThanOrEqual(80);
  });
});
