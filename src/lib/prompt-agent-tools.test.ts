import { beforeEach, describe, expect, it, vi } from "vitest";

const toolMocks = vi.hoisted(() => ({
  requireProjectAccess: vi.fn(),
}));

vi.mock("./auth-context", async () => {
  const actual = await vi.importActual<typeof import("./auth-context")>("./auth-context");
  return {
    ...actual,
    requireProjectAccess: toolMocks.requireProjectAccess,
  };
});

import { ForbiddenError } from "./auth-context";
import { createPromptAgentServerTools, type PromptAgentToolContext } from "./prompt-agent-tools";
import type { WorkerEnv } from "../worker/render-api";

const auth = {
  user: { id: "user-1", name: "Member", email: "member@example.com", role: "user" },
  organization: { id: "org-1", name: "Acme" },
};

const validPromptPackage = {
  assistantMessage: "This prompt is ready.",
  title: "Launch Reel",
  generationPrompt: "A crisp 8 second launch reel with layered type and teal accents.",
  durationSec: 8,
  creativeDirection: {
    mood: "clean energetic",
    palette: ["deep navy", "teal", "orange"],
    typography: "bold editorial sans",
  },
  motionPlan: [
    { phase: "build", timing: "0.2-2.4s", description: "Hero type enters in staggered waves." },
    { phase: "breathe", timing: "2.4-5.8s", description: "Background timeline and glow drift." },
    { phase: "resolve", timing: "5.8-8.0s", description: "Accents exit before the title." },
  ],
  hyperframesChecklist: [
    { label: "1920x1080", satisfied: true, notes: "Uses the target canvas." },
  ],
  suggestedNextAction: "apply_prompt",
  followUpQuestions: [],
};

function runtime(
  generateHyperframe = vi.fn(),
  forwardedDurationSec?: number,
  materializeHyperframeComponents = vi.fn(),
): PromptAgentToolContext {
  return {
    env: {} as WorkerEnv,
    auth,
    forwardedProjectId: "project-1",
    forwardedDurationSec,
    generateHyperframe,
    materializeHyperframeComponents,
  };
}

function getTool(name: string): any {
  const tool = createPromptAgentServerTools().find((item) => item.name === name);
  if (!tool?.execute) throw new Error(`missing tool ${name}`);
  return tool;
}

describe("prompt agent server tools", () => {
  beforeEach(() => {
    toolMocks.requireProjectAccess.mockReset();
  });

  it("returns distilled HyperFrames guidance without exposing the generation system prompt", async () => {
    const tool = getTool("get_hyperframes_guidelines");

    const output = await tool.execute({}, { context: runtime() } as never);

    expect(output.canvas).toMatchObject({ width: 1920, height: 1080 });
    expect(output.timelineRules.join(" ")).toContain("tl.fromTo");
    expect(JSON.stringify(output)).not.toContain("Reference example");
    expect(JSON.stringify(output)).not.toContain("Return ONLY the complete HTML");
  });

  it("validates prompt packages through the prepare tool", async () => {
    const tool = getTool("prepare_prompt_package");

    await expect(tool.execute(validPromptPackage, { context: runtime() } as never)).resolves.toEqual(
      validPromptPackage,
    );
    await expect(
      tool.execute({ ...validPromptPackage, durationSec: 300 }, { context: runtime() } as never),
    ).resolves.toMatchObject({ durationSec: 300 });
    await expect(
      tool.execute({ ...validPromptPackage, durationSec: 999 }, { context: runtime() } as never),
    ).rejects.toThrow();
  });

  it("exposes read-only skill catalog tools without touching projects or generation", async () => {
    const generateHyperframe = vi.fn();
    const toolRuntime = runtime(generateHyperframe);
    const listTool = getTool("list_hyperframes_skill_catalog");
    const routeTool = getTool("route_hyperframes_workflow");
    const loadTool = getTool("load_hyperframes_skill");

    expect(listTool.needsApproval).not.toBe(true);
    expect(routeTool.needsApproval).not.toBe(true);
    expect(loadTool.needsApproval).not.toBe(true);

    const list = await listTool.execute({}, { context: toolRuntime } as never);
    expect(list.groups.workflow.map((skill: { id: string }) => skill.id)).toEqual(
      expect.arrayContaining(["website-to-video", "product-launch-video"]),
    );

    const route = await routeTool.execute(
      { message: "Make a website video from https://example.com" },
      { context: toolRuntime } as never,
    );
    expect(route).toMatchObject({
      workflowId: "website-to-video",
      fullPipelineAvailable: false,
      requiresWorkflowRunner: true,
    });

    const loaded = await loadTool.execute(
      { skillId: "website-to-video", maxChars: 500 },
      { context: toolRuntime } as never,
    );
    expect(loaded).toMatchObject({
      found: true,
      skillId: "website-to-video",
      truncated: true,
    });

    expect(generateHyperframe).not.toHaveBeenCalled();
    expect(toolMocks.requireProjectAccess).not.toHaveBeenCalled();
  });

  it("propagates project access denial when inspecting another organization", async () => {
    toolMocks.requireProjectAccess.mockRejectedValue(new ForbiddenError("organization access denied"));
    const tool = getTool("inspect_project_context");

    await expect(
      tool.execute({ projectId: "project-2" }, { context: runtime() } as never),
    ).rejects.toThrow("organization access denied");
  });

  it("marks generation as approval-gated and reuses the injected generation path", async () => {
    const output = {
      html: "<!DOCTYPE html>",
      project: { id: "project-1", title: "Launch Reel" },
      model: "openrouter/auto",
      attempts: 1,
      durationMs: 42,
      lintOk: true,
      lintErrors: [],
    };
    const generateHyperframe = vi.fn().mockResolvedValue(output);
    const tool = getTool("generate_hyperframe");

    expect(tool.needsApproval).toBe(true);
    await expect(
      tool.execute(
        { prompt: "Launch", durationSec: 8 },
        { context: runtime(generateHyperframe) } as never,
      ),
    ).resolves.toEqual(output);
    expect(generateHyperframe).toHaveBeenCalledWith({
      prompt: "Launch",
      durationSec: 8,
      projectId: "project-1",
      title: undefined,
      selectedGalleryContext: undefined,
    });
  });

  it("uses the forwarded duration when approved generation omits duration", async () => {
    const output = {
      html: "<!DOCTYPE html>",
      project: { id: "project-1", title: "Launch Reel" },
      model: "openrouter/auto",
      attempts: 1,
      durationMs: 42,
      lintOk: true,
      lintErrors: [],
    };
    const generateHyperframe = vi.fn().mockResolvedValue(output);
    const tool = getTool("generate_hyperframe");

    await tool.execute(
      { prompt: "Launch" },
      { context: runtime(generateHyperframe, 300) } as never,
    );

    expect(generateHyperframe).toHaveBeenCalledWith({
      prompt: "Launch",
      durationSec: 300,
      projectId: "project-1",
      title: undefined,
      selectedGalleryContext: undefined,
    });
  });

  it("materializes trusted components through an approval-gated id-and-placement tool", async () => {
    const output = {
      projectId: "project-1",
      indexHtml: "<!doctype html><div data-composition-id=\"app-showcase\"></div>",
      installedPaths: ["compositions/app-showcase.html"],
      manifestPath: ".hyperframes/materialized-components.json" as const,
      manifest: {
        version: 1 as const,
        updatedAt: "2026-06-30T12:00:00.000Z",
        actor: { id: "user-1", type: "agent" as const },
        snapshotId: null,
        components: [],
      },
      warnings: [],
    };
    const materializeHyperframeComponents = vi.fn().mockResolvedValue(output);
    const tool = getTool("materialize_hyperframe_components");

    expect(tool.needsApproval).toBe(true);
    await expect(
      tool.execute(
        {
          placements: [
            {
              componentId: "app-showcase",
              startSec: 0,
              durationSec: 5.5,
              trackIndex: 1,
              width: 1920,
              height: 1080,
            },
          ],
        },
        { context: runtime(vi.fn(), undefined, materializeHyperframeComponents) } as never,
      ),
    ).resolves.toEqual(output);
    expect(materializeHyperframeComponents).toHaveBeenCalledWith({
      projectId: "project-1",
      placements: [
        {
          componentId: "app-showcase",
          startSec: 0,
          durationSec: 5.5,
          trackIndex: 1,
          width: 1920,
          height: 1080,
        },
      ],
    });

    await expect(
      tool.execute(
        {
          placements: [
            {
              componentId: "app-showcase",
              startSec: 0,
              componentHtml: "<!doctype html><p>invented</p>",
            },
          ],
        },
        { context: runtime(vi.fn(), undefined, materializeHyperframeComponents) } as never,
      ),
    ).rejects.toThrow(/unrecognized key/i);
  });
});
