import { requireProjectAccess, type AppAuthContext } from "./auth-context";
import { getHyperframesGuidelines, summarizeHtmlForAgent } from "./hyperframes-guidance";
import {
  generateHyperframeTool,
  cancelHyperframesWorkflowTool,
  continueHyperframesWorkflowTool,
  getHyperframesWorkflowRunTool,
  getHyperframesGuidelinesTool,
  inspectProjectContextTool,
  listHyperframesSkillCatalogTool,
  loadHyperframesSkillTool,
  preparePromptPackageTool,
  promptAgentResultSchema,
  routeHyperframesWorkflowTool,
  startHyperframesWorkflowTool,
  type GenerateHyperframeOutput,
} from "./prompt-agent-contract";
import {
  listHyperframesSkillCatalog,
  loadHyperframesSkill,
  routeHyperframesWorkflow,
} from "./hyperframes-skill-catalog";
import type { WorkerEnv } from "../worker/render-api";
import type { SelectedGalleryPromptContext } from "./hyperframe-gallery-catalog";
import {
  cancelWebsiteToVideoWorkflowRun,
  continueWebsiteToVideoWorkflowRun,
  getWebsiteToVideoWorkflowRun,
  startWebsiteToVideoWorkflowRun,
} from "../worker/workflow-api";

export interface PromptAgentToolContext {
  env: WorkerEnv;
  auth: AppAuthContext;
  forwardedProjectId?: string;
  forwardedPrompt?: string;
  forwardedDurationSec?: number;
  forwardedActiveProjectTitle?: string;
  forwardedGalleryContext?: SelectedGalleryPromptContext;
  generateHyperframe: (input: {
    prompt: string;
    durationSec?: number;
    projectId?: string;
    title?: string;
  }) => Promise<GenerateHyperframeOutput>;
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
    preparePromptPackageTool.server(async (args) => promptAgentResultSchema.parse(args)),
    generateHyperframeTool.server(async (args, execution) => {
      const runtime = requireRuntimeContext(execution?.context as PromptAgentToolContext | undefined);
      return runtime.generateHyperframe({
        prompt: args.prompt,
        durationSec: args.durationSec ?? runtime.forwardedDurationSec,
        projectId: args.projectId || runtime.forwardedProjectId,
        title: args.title,
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
  ] as const;
}

function requireRuntimeContext(
  context: PromptAgentToolContext | undefined,
): PromptAgentToolContext {
  if (!context) throw new Error("prompt-agent runtime context is missing");
  return context;
}
