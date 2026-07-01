import { z } from "zod";

import type { WorkflowRunOutput } from "./prompt-agent-client";
import { getWorkflowIntakePayload } from "./workflow-intake";

export const wizardStageIdSchema = z.enum([
  "capture",
  "design",
  "script",
  "storyboard",
  "vo-timing",
  "build",
  "validate",
]);

export const wizardStageStatusSchema = z.enum([
  "not_started",
  "running",
  "ready",
  "failed",
  "skipped",
  "unavailable",
]);

export const wizardStageArtifactSchema = z.object({
  path: z.string().min(1),
  label: z.string().min(1),
  role: z.string().min(1),
  contentType: z.string().min(1),
  editable: z.boolean(),
  size: z.number().nonnegative().optional(),
});

export const wizardStageSchema = z.object({
  id: wizardStageIdSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  status: wizardStageStatusSchema,
  required: z.boolean(),
  editable: z.boolean(),
  artifacts: z.array(wizardStageArtifactSchema),
  skippedReason: z.string().optional(),
  validationMessage: z.string().optional(),
});

export const wizardStagePlanSchema = z.object({
  runId: z.string().min(1),
  projectId: z.string().nullable(),
  workflowId: z.string().min(1),
  status: z.string().min(1),
  options: z.record(z.string(), z.unknown()).nullable(),
  activeStageId: wizardStageIdSchema,
  stages: z.array(wizardStageSchema),
  studioUrl: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const wizardStageArtifactContentSchema = z.object({
  runId: z.string().min(1),
  projectId: z.string().min(1),
  stageId: wizardStageIdSchema,
  path: z.string().min(1),
  content: z.string(),
  contentType: z.string().min(1),
  revision: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const wizardStageArtifactSaveSchema = z.object({
  content: z.string().max(2 * 1024 * 1024),
  revision: z.string().nullable().optional(),
});

export const wizardStageValidationResultSchema = z.object({
  runId: z.string().min(1),
  stageId: wizardStageIdSchema,
  status: z.enum(["passed", "warning", "failed", "unavailable"]),
  checkedAt: z.string(),
  warnings: z.array(z.string()),
});

export const inspectWorkflowStageInputSchema = z.object({
  runId: z.string().trim().min(1).max(200),
  stageId: wizardStageIdSchema.optional(),
});

export const proposeWorkflowStagePatchInputSchema = z.object({
  runId: z.string().trim().min(1).max(200),
  stageId: wizardStageIdSchema,
  path: z.string().trim().min(1).max(600),
  instructions: z.string().trim().min(1).max(2_000),
});

export const applyWorkflowStagePatchInputSchema = z.object({
  runId: z.string().trim().min(1).max(200),
  stageId: wizardStageIdSchema,
  path: z.string().trim().min(1).max(600),
  content: z.string().max(2 * 1024 * 1024),
  revision: z.string().nullable().optional(),
});

export const rerunWorkflowStageValidationInputSchema = z.object({
  runId: z.string().trim().min(1).max(200),
  stageId: wizardStageIdSchema,
});

export const workflowStagePatchProposalSchema = z.object({
  runId: z.string(),
  stageId: wizardStageIdSchema,
  path: z.string(),
  summary: z.string(),
  requiresApproval: z.literal(true),
});

export type WizardStageId = z.infer<typeof wizardStageIdSchema>;
export type WizardStage = z.infer<typeof wizardStageSchema>;
export type WizardStagePlan = z.infer<typeof wizardStagePlanSchema>;
export type WizardStageArtifactContent = z.infer<typeof wizardStageArtifactContentSchema>;
export type WizardStageValidationResult = z.infer<typeof wizardStageValidationResultSchema>;
export type WorkflowStagePatchProposal = z.infer<typeof workflowStagePatchProposalSchema>;

const STAGE_DETAILS: Record<
  WizardStageId,
  Pick<WizardStage, "label" | "description" | "required">
> = {
  capture: {
    label: "Capture",
    description: "Source screenshots, assets, fonts, and visual references.",
    required: false,
  },
  design: {
    label: "Design",
    description: "Brand reference, colors, typography, components, and guardrails.",
    required: true,
  },
  script: {
    label: "Script",
    description: "Narration or on-screen story with hook, proof, and CTA.",
    required: true,
  },
  storyboard: {
    label: "Storyboard",
    description: "Per-beat creative direction, mood, assets, transitions, and motion.",
    required: true,
  },
  "vo-timing": {
    label: "VO + Timing",
    description: "Voiceover audio and word-level timing when configured.",
    required: false,
  },
  build: {
    label: "Build",
    description: "Animated HTML compositions and supporting source files.",
    required: true,
  },
  validate: {
    label: "Validate",
    description: "Snapshots, lint checks, runtime validation, and delivery readiness.",
    required: true,
  },
};

export function buildWizardStagePlan(run: WorkflowRunOutput): WizardStagePlan {
  const stages = wizardStageIdSchema.options.map((id) => buildWizardStage(id, run));
  return {
    runId: run.id,
    projectId: run.projectId,
    workflowId: run.skillId,
    status: run.status,
    options: run.options,
    activeStageId: activeStageForRun(run),
    stages,
    studioUrl: run.studioUrl,
    updatedAt: run.updatedAt,
  };
}

export function stageIdForArtifactPath(path: string): WizardStageId {
  const lower = path.toLowerCase();
  if (lower.includes("design.md")) return "design";
  if (lower.includes("script.md")) return "script";
  if (lower.includes("storyboard.md")) return "storyboard";
  if (lower.includes("narration") || lower.includes("transcript")) return "vo-timing";
  if (lower.endsWith(".html") || lower.includes("/compositions/")) return "build";
  if (lower.includes("snapshot") || lower.includes("validate")) return "validate";
  if (lower.includes("capture")) return "capture";
  return "build";
}

export function isEditableWizardArtifactPath(path: string): boolean {
  return /\.(md|html?|css|js|mjs|json|txt)$/i.test(path);
}

export function wizardArtifactLabel(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

function buildWizardStage(id: WizardStageId, run: WorkflowRunOutput): WizardStage {
  const intake = getWorkflowIntakePayload(run.options);
  const isIntakeBriefStage = run.status === "intake" && id === "capture" && Boolean(intake);
  const artifacts = run.artifacts
    .filter((artifact) => stageIdForArtifactPath(artifact.path) === id)
    .map((artifact) => ({
      path: artifact.path,
      label: wizardArtifactLabel(artifact.path),
      role: artifact.role,
      contentType: artifact.contentType,
      editable: isEditableWizardArtifactPath(artifact.path),
      size: artifact.size,
    }));
  const skippedReason = skippedReasonForStage(id, run);
  const status = stageStatus(id, run, artifacts.length, skippedReason);
  const details = isIntakeBriefStage
    ? {
        label: "Brief",
        description: "Review prompt, selected templates, components, and source details.",
        required: true,
      }
    : STAGE_DETAILS[id];
  return {
    id,
    ...details,
    status: isIntakeBriefStage ? "ready" : status,
    editable: isIntakeBriefStage || artifacts.some((artifact) => artifact.editable),
    artifacts,
    skippedReason,
    validationMessage: validationMessageForStage(id, run),
  };
}

function activeStageForRun(run: WorkflowRunOutput): WizardStageId {
  if (run.status === "intake") return "capture";
  switch (run.phase) {
    case "capture":
      return "capture";
    case "compose":
      return "design";
    case "validate":
      return "validate";
    case "persist":
    case "complete":
      return "build";
    case "preflight":
    default:
      return "capture";
  }
}

function stageStatus(
  id: WizardStageId,
  run: WorkflowRunOutput,
  artifactCount: number,
  skippedReason: string | undefined,
): WizardStage["status"] {
  if (skippedReason) return "skipped";
  if (run.status === "intake") {
    return id === "capture" ? "ready" : "not_started";
  }
  if (run.status === "failed" && activeStageForRun(run) === id) return "failed";
  if ((run.status === "running" || run.status === "queued") && activeStageForRun(run) === id) {
    return "running";
  }
  if (artifactCount > 0) return "ready";
  if (run.status === "succeeded" && id === "validate") return "ready";
  return run.projectId ? "not_started" : "unavailable";
}

function skippedReasonForStage(id: WizardStageId, run: WorkflowRunOutput): string | undefined {
  if (id !== "vo-timing") return undefined;
  const skipped = run.skippedSteps.find((step) => step.id === "voice" || step.id === "timing");
  return skipped?.reason;
}

function validationMessageForStage(id: WizardStageId, run: WorkflowRunOutput): string | undefined {
  if (id !== "validate") return undefined;
  if (run.error?.message) return run.error.message;
  const warnings = run.artifactManifest?.warnings ?? [];
  return warnings[0];
}
