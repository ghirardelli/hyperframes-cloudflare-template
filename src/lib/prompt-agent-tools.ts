import { requireProjectAccess, type AppAuthContext } from "./auth-context";
import { getHyperframesGuidelines, summarizeHtmlForAgent } from "./hyperframes-guidance";
import {
  generateHyperframeTool,
  applyWorkflowStagePatchTool,
  cancelHyperframesWorkflowTool,
  continueHyperframesWorkflowTool,
  getHyperframesWorkflowRunTool,
  getHyperframesGuidelinesTool,
  inspectWorkflowStageTool,
  inspectProjectContextTool,
  listProjectAssetsOutputSchema,
  listProjectAssetsTool,
  listHyperframesSkillCatalogTool,
  loadHyperframesSkillTool,
  materializeHyperframeComponentsTool,
  preparePromptPackageTool,
  promptAgentResultSchema,
  proposeWorkflowStagePatchTool,
  rerunWorkflowStageValidationTool,
  routeHyperframesWorkflowTool,
  startHyperframesWorkflowTool,
  type PromptAgentAttachedAsset,
  type GenerateHyperframeOutput,
  type MaterializeHyperframeComponentsOutput,
} from "./prompt-agent-contract";
import {
  materializeHyperframeComponentsToolInputSchema,
  type MaterializeComponentPlacement,
} from "./hyperframe-component-materializer-schema";
import {
  listHyperframesSkillCatalog,
  loadHyperframesSkill,
  routeHyperframesWorkflow,
} from "./hyperframes-skill-catalog";
import type { WorkerEnv } from "../worker/render-api";
import {
  normalizeSelectedGalleryPromptContext,
  type SelectedGalleryPromptContext,
} from "./hyperframe-gallery-catalog";
import { normalizeProjectPath } from "./project-paths";
import {
  cancelWebsiteToVideoWorkflowRun,
  continueWebsiteToVideoWorkflowRun,
  getWebsiteToVideoWorkflowRun,
  getWorkflowWizardStagePlan,
  saveWorkflowWizardStageArtifact,
  startWebsiteToVideoWorkflowRun,
  validateWorkflowWizardStage,
} from "../worker/workflow-api";

export interface PromptAgentToolContext {
  env: WorkerEnv;
  auth: AppAuthContext;
  forwardedProjectId?: string;
  forwardedPrompt?: string;
  forwardedDurationSec?: number;
  forwardedActiveProjectTitle?: string;
  forwardedWorkflowRunId?: string;
  forwardedActiveWizardStageId?: string;
  forwardedGalleryContext?: SelectedGalleryPromptContext;
  forwardedAttachedAssets?: Array<PromptAgentAttachedAsset>;
  listProjectAssets?: (projectId: string) => Promise<Array<PromptAgentAttachedAsset>>;
  generateHyperframe: (input: {
    prompt: string;
    durationSec?: number;
    projectId?: string;
    title?: string;
    selectedGalleryContext?: SelectedGalleryPromptContext;
  }) => Promise<GenerateHyperframeOutput>;
  materializeHyperframeComponents?: (input: {
    projectId: string;
    placements: Array<MaterializeComponentPlacement>;
  }) => Promise<MaterializeHyperframeComponentsOutput>;
}

export function createPromptAgentServerTools() {
  return [
    getHyperframesGuidelinesTool.server(async () => getHyperframesGuidelines()),
    listHyperframesSkillCatalogTool.server(async () => listHyperframesSkillCatalog()),
    routeHyperframesWorkflowTool.server(async (args, execution) => {
      const runtime = requireRuntimeContext(execution?.context as PromptAgentToolContext | undefined);
      return routeHyperframesWorkflow({
        message: args.message,
        currentPrompt: args.currentPrompt ?? runtime.forwardedPrompt,
        activeProjectTitle: args.activeProjectTitle ?? runtime.forwardedActiveProjectTitle,
      });
    }),
    loadHyperframesSkillTool.server(async (args) => loadHyperframesSkill(args)),
    inspectProjectContextTool.server(async (args, execution) => {
      const runtime = requireRuntimeContext(execution?.context as PromptAgentToolContext | undefined);
      const projectId = args.projectId || runtime.forwardedProjectId;
      if (!projectId) {
        return {
          hasProject: false,
          projectId: null,
          title: null,
          prompt: null,
          durationSec: null,
          hasHtml: false,
          htmlSummary: "No active project was provided.",
        };
      }

      const project = await requireProjectAccess(runtime.auth, projectId, runtime.env);
      return {
        hasProject: true,
        projectId: project.id,
        title: project.title,
        prompt: project.prompt,
        durationSec: project.durationSec,
        hasHtml: Boolean(project.currentHtml),
        htmlSummary: summarizeHtmlForAgent(project.currentHtml),
      };
    }),
    listProjectAssetsTool.server(async (args, execution) => {
      const runtime = requireRuntimeContext(execution?.context as PromptAgentToolContext | undefined);
      const projectId = args.projectId || runtime.forwardedProjectId;
      if (!projectId) {
        return listProjectAssetsOutputSchema.parse({ projectId: null, assets: [] });
      }
      const assets = runtime.listProjectAssets
        ? await runtime.listProjectAssets(projectId)
        : runtime.forwardedAttachedAssets ?? [];
      return listProjectAssetsOutputSchema.parse({ projectId, assets });
    }),
    preparePromptPackageTool.server(async (args, execution) => {
      const runtime = requireRuntimeContext(execution?.context as PromptAgentToolContext | undefined);
      const parsed = promptAgentResultSchema.parse(args);
      await assertKnownAssetReferences(parsed.generationPrompt, runtime);
      return parsed;
    }),
    generateHyperframeTool.server(async (args, execution) => {
      const runtime = requireRuntimeContext(execution?.context as PromptAgentToolContext | undefined);
      await assertKnownAssetReferences(args.prompt, runtime);
      const selectedGalleryContext = args.selectedGalleryContext ?? runtime.forwardedGalleryContext;
      return runtime.generateHyperframe({
        prompt: args.prompt,
        durationSec: args.durationSec ?? runtime.forwardedDurationSec,
        projectId: args.projectId || runtime.forwardedProjectId,
        title: args.title,
        selectedGalleryContext: selectedGalleryContext
          ? normalizeSelectedGalleryPromptContext(selectedGalleryContext)
          : undefined,
      });
    }),
    materializeHyperframeComponentsTool.server(async (args, execution) => {
      const runtime = requireRuntimeContext(execution?.context as PromptAgentToolContext | undefined);
      const parsed = materializeHyperframeComponentsToolInputSchema.parse(args);
      const projectId = parsed.projectId || runtime.forwardedProjectId;
      if (!projectId) throw new Error("materialize_hyperframe_components requires an active project");
      if (!runtime.materializeHyperframeComponents) {
        throw new Error("component materialization is not available in this runtime");
      }
      return runtime.materializeHyperframeComponents({
        projectId,
        placements: parsed.placements,
      });
    }),
    startHyperframesWorkflowTool.server(async (args, execution) => {
      const runtime = requireRuntimeContext(execution?.context as PromptAgentToolContext | undefined);
      return startWebsiteToVideoWorkflowRun(runtime.env, runtime.auth, {
        url: args.url,
        title: args.title,
        durationSec: args.durationSec ?? runtime.forwardedDurationSec,
        projectId: args.projectId || runtime.forwardedProjectId,
      });
    }),
    getHyperframesWorkflowRunTool.server(async (args, execution) => {
      const runtime = requireRuntimeContext(execution?.context as PromptAgentToolContext | undefined);
      return getWebsiteToVideoWorkflowRun(runtime.env, runtime.auth, args.runId);
    }),
    continueHyperframesWorkflowTool.server(async (args, execution) => {
      const runtime = requireRuntimeContext(execution?.context as PromptAgentToolContext | undefined);
      return continueWebsiteToVideoWorkflowRun(runtime.env, runtime.auth, args.runId);
    }),
    cancelHyperframesWorkflowTool.server(async (args, execution) => {
      const runtime = requireRuntimeContext(execution?.context as PromptAgentToolContext | undefined);
      return cancelWebsiteToVideoWorkflowRun(runtime.env, runtime.auth, args.runId);
    }),
    inspectWorkflowStageTool.server(async (args, execution) => {
      const runtime = requireRuntimeContext(execution?.context as PromptAgentToolContext | undefined);
      const runId = args.runId || runtime.forwardedWorkflowRunId;
      if (!runId) throw new Error("inspect_workflow_stage requires a workflow run");
      const stagePlan = await getWorkflowWizardStagePlan(runtime.env, runtime.auth, runId);
      const stageId = args.stageId || runtime.forwardedActiveWizardStageId;
      const activeStage = stageId
        ? stagePlan.stages.find((stage) => stage.id === stageId) ?? null
        : stagePlan.stages.find((stage) => stage.id === stagePlan.activeStageId) ?? null;
      return { stagePlan, activeStage };
    }),
    proposeWorkflowStagePatchTool.server(async (args, execution) => {
      const runtime = requireRuntimeContext(execution?.context as PromptAgentToolContext | undefined);
      const runId = args.runId || runtime.forwardedWorkflowRunId;
      if (!runId) throw new Error("propose_workflow_stage_patch requires a workflow run");
      await getWorkflowWizardStagePlan(runtime.env, runtime.auth, runId);
      return {
        runId,
        stageId: args.stageId,
        path: args.path,
        summary: args.instructions,
        requiresApproval: true as const,
      };
    }),
    applyWorkflowStagePatchTool.server(async (args, execution) => {
      const runtime = requireRuntimeContext(execution?.context as PromptAgentToolContext | undefined);
      const runId = args.runId || runtime.forwardedWorkflowRunId;
      if (!runId) throw new Error("apply_workflow_stage_patch requires a workflow run");
      return saveWorkflowWizardStageArtifact(runtime.env, runtime.auth, runId, args.stageId, args.path, {
        content: args.content,
        revision: args.revision ?? null,
      });
    }),
    rerunWorkflowStageValidationTool.server(async (args, execution) => {
      const runtime = requireRuntimeContext(execution?.context as PromptAgentToolContext | undefined);
      const runId = args.runId || runtime.forwardedWorkflowRunId;
      if (!runId) throw new Error("rerun_workflow_stage_validation requires a workflow run");
      return validateWorkflowWizardStage(runtime.env, runtime.auth, runId, args.stageId);
    }),
  ] as const;
}

function requireRuntimeContext(
  context: PromptAgentToolContext | undefined,
): PromptAgentToolContext {
  if (!context) throw new Error("prompt-agent runtime context is missing");
  return context;
}

async function assertKnownAssetReferences(
  text: string,
  runtime: PromptAgentToolContext,
): Promise<void> {
  const references = extractProjectAssetReferences(text);
  if (!references.length) return;

  const known = new Set((runtime.forwardedAttachedAssets ?? []).map((asset) => asset.path));
  if (runtime.forwardedProjectId && runtime.listProjectAssets) {
    const projectAssets = await runtime.listProjectAssets(runtime.forwardedProjectId);
    for (const asset of projectAssets ?? []) known.add(asset.path);
  }

  const unknown = references.filter((path) => !known.has(path));
  if (unknown.length) {
    throw new Error(
      `unknown project asset path: ${unknown.join(", ")}. Use list_project_assets and uploaded assets/ paths only.`,
    );
  }
}

const PROJECT_ASSET_REF_RE = /\bassets\/[A-Za-z0-9._~!$&'*+,;=:@%/-]+/g;

function extractProjectAssetReferences(text: string): Array<string> {
  const paths = new Set<string>();
  for (const match of text.matchAll(PROJECT_ASSET_REF_RE)) {
    const normalized = normalizeAssetReference(match[0]);
    if (normalized) paths.add(normalized);
  }
  return [...paths];
}

function normalizeAssetReference(value: string): string | null {
  const trimmed = value.replace(/[.,;:!?]+$/g, "");
  try {
    const normalized = normalizeProjectPath(trimmed);
    return normalized.startsWith("assets/") ? normalized : null;
  } catch {
    return null;
  }
}
