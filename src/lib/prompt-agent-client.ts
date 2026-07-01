import {
  generateHyperframeOutputSchema,
  workflowRunClientSchema,
  type GenerateHyperframeOutput,
} from "./prompt-agent-contract";
import type { z } from "zod";

type MessageLike = {
  parts?: Array<unknown>;
};

type ToolCallLike = {
  type: "tool-call";
  id: string;
  name: string;
  output?: unknown;
};

type ToolResultLike = {
  type: "tool-result";
  toolCallId: string;
  content: unknown;
};

export interface GeneratedHyperframeMatch {
  key: string;
  output: GenerateHyperframeOutput;
}

export type WorkflowRunOutput = z.infer<typeof workflowRunClientSchema>;

export interface WorkflowRunMatch {
  key: string;
  output: WorkflowRunOutput;
}

export function findLatestGeneratedHyperframe(
  messages: Array<MessageLike>,
  appliedKeys: ReadonlySet<string>,
): GeneratedHyperframeMatch | null {
  for (const message of [...messages].reverse()) {
    const parts = message.parts ?? [];
    for (const part of [...parts].reverse()) {
      const direct = parseGenerateToolCall(part);
      if (direct && !appliedKeys.has(direct.key)) return direct;

      const result = parseGenerateToolResult(part);
      if (result && !appliedKeys.has(result.key)) return result;
    }
  }
  return null;
}

export function findLatestWorkflowRun(
  messages: Array<MessageLike>,
): WorkflowRunMatch | null {
  for (const message of [...messages].reverse()) {
    const parts = message.parts ?? [];
    for (const part of [...parts].reverse()) {
      const direct = parseWorkflowToolCall(part);
      if (direct) return direct;

      const result = parseWorkflowToolResult(part);
      if (result) return result;
    }
  }
  return null;
}

export function findLatestStartedWorkflowRun(
  messages: Array<MessageLike>,
): WorkflowRunMatch | null {
  const startToolCallIds = new Set<string>();
  for (const message of messages) {
    const parts = message.parts ?? [];
    for (const part of parts) {
      if (isToolCallLike(part) && part.name === "start_hyperframes_workflow") {
        startToolCallIds.add(part.id);
      }
    }
  }

  for (const message of [...messages].reverse()) {
    const parts = message.parts ?? [];
    for (const part of [...parts].reverse()) {
      if (isToolCallLike(part) && part.name === "start_hyperframes_workflow") {
        const output = parseWorkflowRunOutput(part.output);
        if (output) return { key: `tool-call:${part.id}`, output };
      }

      if (isToolResultLike(part) && startToolCallIds.has(part.toolCallId)) {
        const output = parseWorkflowRunOutput(part.content);
        if (output) return { key: `tool-result:${part.toolCallId}`, output };
      }
    }
  }
  return null;
}

export function promptAgentToolLabel(name: string): string {
  switch (name) {
    case "get_hyperframes_guidelines":
      return "HyperFrames guidance";
    case "list_hyperframes_skill_catalog":
      return "Skill catalog";
    case "route_hyperframes_workflow":
      return "Workflow route";
    case "load_hyperframes_skill":
      return "Load skill";
    case "inspect_project_context":
      return "Project context";
    case "list_project_assets":
      return "Project assets";
    case "prepare_prompt_package":
      return "Prompt package";
    case "generate_hyperframe":
      return "Generate HyperFrame";
    case "materialize_hyperframe_components":
      return "Install trusted components";
    case "start_hyperframes_workflow":
      return "Start workflow";
    case "get_hyperframes_workflow_run":
      return "Workflow status";
    case "continue_hyperframes_workflow":
      return "Continue workflow";
    case "cancel_hyperframes_workflow":
      return "Cancel workflow";
    case "inspect_workflow_stage":
      return "Inspect stage";
    case "propose_workflow_stage_patch":
      return "Propose stage edit";
    case "apply_workflow_stage_patch":
      return "Apply stage edit";
    case "rerun_workflow_stage_validation":
      return "Rerun stage validation";
    case "set_draft_prompt":
      return "Apply draft prompt";
    case "highlight_agent_section":
      return "Focus section";
    default:
      return name.replaceAll("_", " ");
  }
}

export function formatAgentToolState(state: string): string {
  switch (state) {
    case "awaiting-input":
      return "waiting";
    case "input-streaming":
      return "reading";
    case "input-complete":
      return "ready";
    case "approval-requested":
      return "approval";
    case "approval-responded":
      return "approved";
    case "complete":
      return "done";
    case "error":
      return "error";
    default:
      return state;
  }
}

export function safePreview(value: unknown, max = 180): string {
  if (value === undefined || value === null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text;
}

function parseGenerateToolCall(part: unknown): GeneratedHyperframeMatch | null {
  if (!isToolCallLike(part) || part.name !== "generate_hyperframe") return null;
  const output = parseGenerateOutput(part.output);
  return output ? { key: `tool-call:${part.id}`, output } : null;
}

function parseWorkflowToolCall(part: unknown): WorkflowRunMatch | null {
  if (!isToolCallLike(part) || !isWorkflowToolName(part.name)) return null;
  const output = parseWorkflowRunOutput(part.output);
  return output ? { key: `tool-call:${part.id}`, output } : null;
}

function parseGenerateToolResult(part: unknown): GeneratedHyperframeMatch | null {
  if (!isToolResultLike(part)) return null;
  const output = parseGenerateOutput(part.content);
  return output ? { key: `tool-result:${part.toolCallId}`, output } : null;
}

function parseWorkflowToolResult(part: unknown): WorkflowRunMatch | null {
  if (!isToolResultLike(part)) return null;
  const output = parseWorkflowRunOutput(part.content);
  return output ? { key: `tool-result:${part.toolCallId}`, output } : null;
}

function parseGenerateOutput(value: unknown): GenerateHyperframeOutput | null {
  if (typeof value === "string") {
    try {
      return parseGenerateOutput(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) return null;
  const parsed = generateHyperframeOutputSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseWorkflowRunOutput(value: unknown): WorkflowRunOutput | null {
  if (typeof value === "string") {
    try {
      return parseWorkflowRunOutput(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) return null;
  const parsed = workflowRunClientSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function isWorkflowToolName(name: string): boolean {
  return (
    name === "start_hyperframes_workflow" ||
    name === "get_hyperframes_workflow_run" ||
    name === "continue_hyperframes_workflow" ||
    name === "cancel_hyperframes_workflow"
  );
}

function isToolCallLike(value: unknown): value is ToolCallLike {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as ToolCallLike).type === "tool-call" &&
    typeof (value as ToolCallLike).id === "string" &&
    typeof (value as ToolCallLike).name === "string"
  );
}

function isToolResultLike(value: unknown): value is ToolResultLike {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as ToolResultLike).type === "tool-result" &&
    typeof (value as ToolResultLike).toolCallId === "string"
  );
}
