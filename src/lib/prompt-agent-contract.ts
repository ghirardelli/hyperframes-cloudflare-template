import { toolDefinition } from "@tanstack/ai/client";
import { z } from "zod";

import {
  hyperframesCatalogListOutputSchema,
  hyperframesLoadSkillInputSchema,
  hyperframesLoadSkillOutputSchema,
  hyperframesWorkflowRouteOutputSchema,
  hyperframesWorkflowRouteRequestSchema,
} from "./hyperframes-skill-catalog-schema";
import { selectedGalleryPromptContextSchema } from "./hyperframe-gallery-catalog-schema";
import {
  materializeHyperframeComponentsToolInputSchema,
  materializeHyperframeComponentsToolOutputSchema,
} from "./hyperframe-component-materializer-schema";
import {
  applyWorkflowStagePatchInputSchema,
  inspectWorkflowStageInputSchema,
  rerunWorkflowStageValidationInputSchema,
  wizardStageArtifactContentSchema,
  wizardStagePlanSchema,
  wizardStageSchema,
  wizardStageValidationResultSchema,
  workflowStagePatchProposalSchema,
  proposeWorkflowStagePatchInputSchema,
} from "./pipeline-wizard";
import { normalizeProjectPath } from "./project-paths";

const projectAssetPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(isProjectAssetPath, "attached assets must be stored under assets/")
  .overwrite(normalizeProjectAssetPath);

export const promptAgentAttachedAssetSchema = z.object({
  path: projectAssetPathSchema,
  url: z.string().max(2_000).optional(),
  contentType: z.string().trim().min(1).max(160),
  size: z.number().int().min(0).max(25 * 1024 * 1024),
  originalName: z.string().trim().min(1).max(240).optional(),
  description: z.string().trim().max(1_000).optional(),
  transcript: z.string().trim().max(10_000).optional(),
});

export type PromptAgentAttachedAsset = z.infer<typeof promptAgentAttachedAssetSchema>;

export const promptAgentTranscriptionRequestSchema = z.object({
  audio: z.string().min(1),
  mimeType: z.string().trim().min(1).max(120),
  durationMs: z.number().int().min(1).max(5 * 60 * 1000).optional(),
  language: z.string().trim().min(2).max(16).optional(),
  prompt: z.string().trim().max(500).optional(),
});

export const promptAgentTranscriptionResultSchema = z.object({
  text: z.string().trim().min(1).max(20_000),
  language: z.string().trim().min(2).max(16).optional(),
  durationSec: z.number().min(0).max(5 * 60).optional(),
});

export type PromptAgentTranscriptionRequest = z.infer<
  typeof promptAgentTranscriptionRequestSchema
>;
export type PromptAgentTranscriptionResult = z.infer<
  typeof promptAgentTranscriptionResultSchema
>;

export const promptAgentForwardedPropsSchema = z.object({
  projectId: z.string().trim().min(1).max(200).optional(),
  currentPrompt: z.string().max(8_000).optional(),
  durationSec: z.number().min(1).max(300).optional(),
  activeProjectTitle: z.string().max(160).optional(),
  selectedGalleryContext: selectedGalleryPromptContextSchema.optional(),
  attachedAssets: z.array(promptAgentAttachedAssetSchema).max(24).optional(),
  workflowRunId: z.string().trim().min(1).max(200).optional(),
  activeWizardStageId: z.string().trim().min(1).max(80).optional(),
});

export type PromptAgentForwardedProps = z.infer<typeof promptAgentForwardedPropsSchema>;

export const hyperframesGuidelinesSchema = z.object({
  canvas: z.object({
    width: z.number(),
    height: z.number(),
    defaultDurationSec: z.number(),
  }),
  requiredStructure: z.array(z.string()),
  timelineRules: z.array(z.string()),
  visualRules: z.array(z.string()),
  allowedResources: z.array(z.string()),
  forbiddenPatterns: z.array(z.string()),
});

export type HyperframesGuidelines = z.infer<typeof hyperframesGuidelinesSchema>;

export const promptMotionStepSchema = z.object({
  phase: z.enum(["build", "breathe", "resolve"]),
  timing: z.string().min(1).max(80),
  description: z.string().min(1).max(260),
});

export const promptChecklistItemSchema = z.object({
  label: z.string().min(1).max(120),
  satisfied: z.boolean(),
  notes: z.string().min(1).max(240),
});

export const promptAgentSkillProvenanceSchema = z.object({
  workflowId: z.string().nullable(),
  loadedSkillIds: z.array(z.string().min(1).max(120)).max(16),
  sourceRevision: z.string().max(600),
  fullPipelineAvailable: z.boolean(),
  capabilityNotice: z.string().max(700).optional(),
});

export const promptAgentResultSchema = z.object({
  assistantMessage: z.string().min(1).max(1_200),
  title: z.string().max(120),
  generationPrompt: z.string().max(8_000),
  durationSec: z.number().min(1).max(300),
  creativeDirection: z.object({
    mood: z.string().max(120),
    palette: z.array(z.string().max(80)).max(8),
    typography: z.string().max(180),
  }),
  motionPlan: z.array(promptMotionStepSchema).max(8),
  hyperframesChecklist: z.array(promptChecklistItemSchema).max(12),
  suggestedNextAction: z.enum([
    "ask_follow_up",
    "apply_prompt",
    "generate_after_approval",
    "start_workflow_after_approval",
    "manual_generate",
    "none",
  ]),
  followUpQuestions: z.array(z.string().min(1).max(240)).max(4),
  skillProvenance: promptAgentSkillProvenanceSchema.optional(),
});

export type PromptAgentResult = z.infer<typeof promptAgentResultSchema>;

export const projectContextInputSchema = z.object({
  projectId: z.string().trim().min(1).max(200).optional(),
});

export const projectContextOutputSchema = z.object({
  hasProject: z.boolean(),
  projectId: z.string().nullable(),
  title: z.string().nullable(),
  prompt: z.string().nullable(),
  durationSec: z.number().nullable(),
  hasHtml: z.boolean(),
  htmlSummary: z.string(),
});

export const listProjectAssetsInputSchema = z.object({
  projectId: z.string().trim().min(1).max(200).optional(),
});

export const listProjectAssetsOutputSchema = z.object({
  projectId: z.string().nullable(),
  assets: z.array(promptAgentAttachedAssetSchema).max(200),
});

export type ListProjectAssetsOutput = z.infer<typeof listProjectAssetsOutputSchema>;

export const draftPromptInputSchema = z.object({
  title: z.string().max(120),
  generationPrompt: z.string().min(1).max(8_000),
  durationSec: z.number().min(1).max(300),
  assistantMessage: z.string().max(1_200).optional(),
});

export const draftPromptOutputSchema = z.object({
  applied: z.boolean(),
  prompt: z.string().max(8_000),
});

export const highlightAgentSectionInputSchema = z.object({
  section: z.enum(["chat", "draft", "checklist", "approval", "preview"]),
});

export const highlightAgentSectionOutputSchema = z.object({
  highlighted: z.boolean(),
  section: z.enum(["chat", "draft", "checklist", "approval", "preview"]),
});

export const generateHyperframeInputSchema = z.object({
  prompt: z.string().min(1).max(8_000),
  durationSec: z.number().min(1).max(300).optional(),
  projectId: z.string().trim().min(1).max(200).optional(),
  title: z.string().max(120).optional(),
  selectedGalleryContext: selectedGalleryPromptContextSchema.optional(),
});

export const generateHyperframeOutputSchema = z.object({
  html: z.string(),
  project: z.object({
    id: z.string(),
    title: z.string(),
  }).nullable(),
  model: z.string(),
  attempts: z.number(),
  durationMs: z.number(),
  lintOk: z.boolean(),
  lintErrors: z.array(z.object({
    code: z.string(),
    message: z.string(),
  })),
});

export type GenerateHyperframeOutput = z.infer<typeof generateHyperframeOutputSchema>;
export type MaterializeHyperframeComponentsOutput = z.infer<
  typeof materializeHyperframeComponentsToolOutputSchema
>;

const workflowProgressSchema = z.object({
  current: z.number(),
  total: z.number(),
  label: z.string(),
});

const workflowSkippedStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  reason: z.string(),
});

const workflowStoragePointerSchema = z.object({
  provider: z.enum(["postgres", "r2", "bunny-storage", "bunny-stream"]),
  key: z.string().nullable(),
  sha256: z.string().nullable().optional(),
  streamLibraryId: z.string().nullable().optional(),
  streamVideoId: z.string().nullable().optional(),
  streamStatus: z.string().nullable().optional(),
  streamPlaybackUrl: z.string().nullable().optional(),
  streamEmbedUrl: z.string().nullable().optional(),
});

const workflowArtifactSchema = z.object({
  path: z.string(),
  role: z.string(),
  contentType: z.string(),
  size: z.number(),
  storage: workflowStoragePointerSchema,
});

const workflowArtifactManifestSchema = z.object({
  runId: z.string(),
  skillId: z.string(),
  artifacts: z.array(workflowArtifactSchema),
  skippedSteps: z.array(workflowSkippedStepSchema),
  warnings: z.array(z.string()).optional(),
  studioUrl: z.string().nullable().optional(),
});

const workflowErrorSchema = z.object({
  phase: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});

export const workflowRunClientSchema = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  skillId: z.string(),
  status: z.enum(["intake", "queued", "running", "awaiting_approval", "succeeded", "failed", "cancelled"]),
  phase: z.enum(["preflight", "capture", "compose", "validate", "persist", "complete"]),
  inputUrl: z.string(),
  options: z.record(z.string(), z.unknown()).nullable(),
  progress: workflowProgressSchema.nullable(),
  artifactManifest: workflowArtifactManifestSchema.nullable(),
  artifacts: z.array(workflowArtifactSchema),
  skippedSteps: z.array(workflowSkippedStepSchema),
  error: workflowErrorSchema.nullable(),
  studioUrl: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});

export const startHyperframesWorkflowInputSchema = z.object({
  workflowId: z.literal("website-to-video"),
  url: z.string().trim().min(1).max(2_000),
  durationSec: z.number().min(1).max(300).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  projectId: z.string().trim().min(1).max(200).optional(),
});

export const workflowRunLookupInputSchema = z.object({
  runId: z.string().trim().min(1).max(200),
});

export const inspectWorkflowStageOutputSchema = z.object({
  stagePlan: wizardStagePlanSchema,
  activeStage: wizardStageSchema.nullable(),
});

export const getHyperframesGuidelinesTool = toolDefinition({
  name: "get_hyperframes_guidelines",
  description: "Return the HyperFrames composition rules needed to prepare render-safe prompts.",
  inputSchema: z.object({}),
  outputSchema: hyperframesGuidelinesSchema,
});

export const listHyperframesSkillCatalogTool = toolDefinition({
  name: "list_hyperframes_skill_catalog",
  description: "Read-only. List the synced HyperFrames skill catalog groups and source revision without loading full markdown.",
  inputSchema: z.object({}),
  outputSchema: hyperframesCatalogListOutputSchema,
});

export const routeHyperframesWorkflowTool = toolDefinition({
  name: "route_hyperframes_workflow",
  description: "Read-only. Route a user request to the relevant HyperFrames workflow and domain skills, including full-pipeline availability.",
  inputSchema: hyperframesWorkflowRouteRequestSchema,
  outputSchema: hyperframesWorkflowRouteOutputSchema,
});

export const loadHyperframesSkillTool = toolDefinition({
  name: "load_hyperframes_skill",
  description: "Read-only. Load bounded markdown instructions for one synced HyperFrames skill plus its reference index.",
  inputSchema: hyperframesLoadSkillInputSchema,
  outputSchema: hyperframesLoadSkillOutputSchema,
});

export const inspectProjectContextTool = toolDefinition({
  name: "inspect_project_context",
  description: "Inspect the active project title, prompt, duration, and a safe summary of its HTML.",
  inputSchema: projectContextInputSchema,
  outputSchema: projectContextOutputSchema,
});

export const listProjectAssetsTool = toolDefinition({
  name: "list_project_assets",
  description: "Read-only. List project-scoped assets uploaded under assets/ that the agent may reference by path.",
  inputSchema: listProjectAssetsInputSchema,
  outputSchema: listProjectAssetsOutputSchema,
});

export const preparePromptPackageTool = toolDefinition({
  name: "prepare_prompt_package",
  description: "Validate and return a structured generation-ready prompt package.",
  inputSchema: promptAgentResultSchema,
  outputSchema: promptAgentResultSchema,
});

export const generateHyperframeTool = toolDefinition({
  name: "generate_hyperframe",
  description: "Generate a HyperFrame from an approved final prompt and update or create the project.",
  inputSchema: generateHyperframeInputSchema,
  outputSchema: generateHyperframeOutputSchema,
  needsApproval: true,
});

export const materializeHyperframeComponentsTool = toolDefinition({
  name: "materialize_hyperframe_components",
  description: "Install trusted HyperFrames registry components into a project using component ids and placement data only.",
  inputSchema: materializeHyperframeComponentsToolInputSchema,
  outputSchema: materializeHyperframeComponentsToolOutputSchema,
  needsApproval: true,
});

export const startHyperframesWorkflowTool = toolDefinition({
  name: "start_hyperframes_workflow",
  description: "Start an approved HyperFrames workflow run, currently website-to-video, and return the queued run state.",
  inputSchema: startHyperframesWorkflowInputSchema,
  outputSchema: workflowRunClientSchema,
  needsApproval: true,
});

export const getHyperframesWorkflowRunTool = toolDefinition({
  name: "get_hyperframes_workflow_run",
  description: "Read-only. Fetch compact status, artifacts, skipped steps, and Studio handoff metadata for a workflow run.",
  inputSchema: workflowRunLookupInputSchema,
  outputSchema: workflowRunClientSchema,
});

export const continueHyperframesWorkflowTool = toolDefinition({
  name: "continue_hyperframes_workflow",
  description: "Continue an approved HyperFrames workflow run that is in intake, queued, or awaiting approval.",
  inputSchema: workflowRunLookupInputSchema,
  outputSchema: workflowRunClientSchema,
  needsApproval: true,
});

export const cancelHyperframesWorkflowTool = toolDefinition({
  name: "cancel_hyperframes_workflow",
  description: "Cancel an approved intake, queued, running, or awaiting-approval HyperFrames workflow run.",
  inputSchema: workflowRunLookupInputSchema,
  outputSchema: workflowRunClientSchema,
  needsApproval: true,
});

export const inspectWorkflowStageTool = toolDefinition({
  name: "inspect_workflow_stage",
  description: "Read-only. Inspect the authorized wizard stage plan and active stage artifacts for a workflow run.",
  inputSchema: inspectWorkflowStageInputSchema,
  outputSchema: inspectWorkflowStageOutputSchema,
});

export const proposeWorkflowStagePatchTool = toolDefinition({
  name: "propose_workflow_stage_patch",
  description: "Read-only. Summarize a proposed bounded edit to an editable workflow stage artifact without mutating it.",
  inputSchema: proposeWorkflowStagePatchInputSchema,
  outputSchema: workflowStagePatchProposalSchema,
});

export const applyWorkflowStagePatchTool = toolDefinition({
  name: "apply_workflow_stage_patch",
  description: "Apply an approved full-content update to an editable workflow stage artifact.",
  inputSchema: applyWorkflowStagePatchInputSchema,
  outputSchema: wizardStageArtifactContentSchema,
  needsApproval: true,
});

export const rerunWorkflowStageValidationTool = toolDefinition({
  name: "rerun_workflow_stage_validation",
  description: "Rerun validation for an approved workflow wizard stage.",
  inputSchema: rerunWorkflowStageValidationInputSchema,
  outputSchema: wizardStageValidationResultSchema,
  needsApproval: true,
});

export const setDraftPromptTool = toolDefinition({
  name: "set_draft_prompt",
  description: "Apply a validated prompt draft to the local editable prompt field.",
  inputSchema: draftPromptInputSchema,
  outputSchema: draftPromptOutputSchema,
});

export const highlightAgentSectionTool = toolDefinition({
  name: "highlight_agent_section",
  description: "Focus a prompt-agent workspace section in the local UI.",
  inputSchema: highlightAgentSectionInputSchema,
  outputSchema: highlightAgentSectionOutputSchema,
});

export function normalizePromptAgentForwardedProps(value: unknown): PromptAgentForwardedProps {
  const parsed = promptAgentForwardedPropsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

function normalizeProjectAssetPath(value: string): string {
  const normalized = normalizeProjectPath(value);
  if (!normalized.startsWith("assets/")) {
    throw new Error("attached assets must be stored under assets/");
  }
  return normalized;
}

function isProjectAssetPath(value: string): boolean {
  try {
    normalizeProjectAssetPath(value);
    return true;
  } catch {
    return false;
  }
}
