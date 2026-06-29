import { requireProjectAccess, type AppAuthContext } from "./auth-context";
import { getHyperframesGuidelines, summarizeHtmlForAgent } from "./hyperframes-guidance";
import {
  generateHyperframeTool,
  getHyperframesGuidelinesTool,
  inspectProjectContextTool,
  preparePromptPackageTool,
  promptAgentResultSchema,
  type GenerateHyperframeOutput,
} from "./prompt-agent-contract";
import type { WorkerEnv } from "../worker/render-api";

export interface PromptAgentToolContext {
  env: WorkerEnv;
  auth: AppAuthContext;
  forwardedProjectId?: string;
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
        durationSec: args.durationSec,
        projectId: args.projectId || runtime.forwardedProjectId,
        title: args.title,
      });
    }),
  ] as const;
}

function requireRuntimeContext(
  context: PromptAgentToolContext | undefined,
): PromptAgentToolContext {
  if (!context) throw new Error("prompt-agent runtime context is missing");
  return context;
}
