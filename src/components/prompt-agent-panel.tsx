import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useChat } from "@tanstack/ai-react";
import { clientTools, fetchServerSentEvents } from "@tanstack/ai-client";
import type { UIMessage } from "@tanstack/ai-client";
import {
  Check,
  ExternalLink,
  Loader2,
  MessageCircle,
  RotateCcw,
  Send,
  Square,
  WandSparkles,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { invalidateProjectCaches, useWorkflowRunQuery } from "@/lib/app-queries";
import {
  highlightAgentSectionTool,
  promptAgentResultSchema,
  setDraftPromptTool,
  type GenerateHyperframeOutput,
} from "@/lib/prompt-agent-contract";
import type { SelectedGalleryPromptContext } from "@/lib/hyperframe-gallery-catalog";
import {
  findLatestGeneratedHyperframe,
  findLatestStartedWorkflowRun,
  findLatestWorkflowRun,
  formatAgentToolState,
  promptAgentToolLabel,
  safePreview,
  type WorkflowRunOutput,
} from "@/lib/prompt-agent-client";

interface PromptAgentPanelProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  durationSec: number;
  onDurationChange: (durationSec: number) => void;
  aiEnabled: boolean;
  isConfigReady: boolean;
  modelLabel: string;
  activeProjectId: string;
  activeProjectTitle: string;
  workflowRunId?: string;
  activeWizardStageId?: string;
  selectedGalleryContext: SelectedGalleryPromptContext;
  isGenerating: boolean;
  isRendering: boolean;
  onGenerated: (output: GenerateHyperframeOutput) => void;
}

type PromptAgentPartialResult = {
  assistantMessage?: string;
  title?: string;
  generationPrompt?: string;
  durationSec?: number;
  hyperframesChecklist?: Array<{
    label?: string;
    satisfied?: boolean;
    notes?: string;
  }>;
};

export function PromptAgentPanel({
  prompt,
  onPromptChange,
  durationSec,
  onDurationChange,
  aiEnabled,
  isConfigReady,
  modelLabel,
  activeProjectId,
  activeProjectTitle,
  workflowRunId,
  activeWizardStageId,
  selectedGalleryContext,
  isGenerating,
  isRendering,
  onGenerated,
}: PromptAgentPanelProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [agentInput, setAgentInput] = useState("");
  const [focusedSection, setFocusedSection] = useState<
    "chat" | "draft" | "checklist" | "approval" | "preview"
  >("chat");
  const appliedGenerationKeysRef = useRef(new Set<string>());
  const invalidatedWorkflowProjectIdsRef = useRef(new Set<string>());
  const forwardedPropsRef = useRef({
    projectId: activeProjectId || undefined,
    currentPrompt: prompt,
    durationSec,
    activeProjectTitle: activeProjectTitle || undefined,
    workflowRunId,
    activeWizardStageId,
    selectedGalleryContext,
  });

  useEffect(() => {
    forwardedPropsRef.current = {
      projectId: activeProjectId || undefined,
      currentPrompt: prompt,
      durationSec,
      activeProjectTitle: activeProjectTitle || undefined,
      workflowRunId,
      activeWizardStageId,
      selectedGalleryContext,
    };
  }, [activeProjectId, activeProjectTitle, activeWizardStageId, durationSec, prompt, selectedGalleryContext, workflowRunId]);

  const connection = useMemo(
    () =>
      fetchServerSentEvents("/api/agent/chat", () => ({
        body: forwardedPropsRef.current,
      })),
    [],
  );

  const tools = useMemo(
    () =>
      clientTools(
        setDraftPromptTool.client(async (args) => {
          onPromptChange(args.generationPrompt);
          onDurationChange(args.durationSec);
          setFocusedSection("draft");
          return { applied: true, prompt: args.generationPrompt };
        }),
        highlightAgentSectionTool.client(async (args) => {
          setFocusedSection(args.section);
          return { highlighted: true, section: args.section };
        }),
      ),
    [onDurationChange, onPromptChange],
  );

  const {
    messages,
    sendMessage,
    addToolApprovalResponse,
    reload,
    stop,
    isLoading,
    error,
    clear,
    partial,
    final,
  } = useChat({
    connection,
    tools,
    outputSchema: promptAgentResultSchema,
  });

  useEffect(() => {
    const generated = findLatestGeneratedHyperframe(
      messages,
      appliedGenerationKeysRef.current,
    );
    if (!generated) return;
    appliedGenerationKeysRef.current.add(generated.key);
    onGenerated(generated.output);
    setFocusedSection("preview");
  }, [messages, onGenerated]);

  const canUseAgent = isConfigReady && aiEnabled && !isGenerating && !isRendering;
  const promptPackage =
    final ?? normalizePartialResult(partial as PromptAgentPartialResult);
  const hasPackagePrompt = Boolean(promptPackage?.generationPrompt?.trim());
  const latestWorkflowRunFromMessages = useMemo(
    () => findLatestWorkflowRun(messages)?.output ?? null,
    [messages],
  );
  const latestStartedWorkflowRun = useMemo(
    () => findLatestStartedWorkflowRun(messages)?.output ?? null,
    [messages],
  );
  const workflowRunQuery = useWorkflowRunQuery(
    latestWorkflowRunFromMessages?.id,
    latestWorkflowRunFromMessages?.status,
  );
  const latestWorkflowRun = workflowRunQuery.data ?? latestWorkflowRunFromMessages;

  useEffect(() => {
    if (workflowRunId || !latestStartedWorkflowRun?.id) return;
    void navigate({
      to: "/workflows/$runId",
      params: { runId: latestStartedWorkflowRun.id },
    });
  }, [latestStartedWorkflowRun?.id, navigate, workflowRunId]);

  useEffect(() => {
    if (latestWorkflowRun?.status !== "succeeded" || !latestWorkflowRun.projectId) return;
    if (invalidatedWorkflowProjectIdsRef.current.has(latestWorkflowRun.projectId)) return;
    invalidatedWorkflowProjectIdsRef.current.add(latestWorkflowRun.projectId);
    invalidateProjectCaches(queryClient, latestWorkflowRun.projectId);
  }, [latestWorkflowRun?.projectId, latestWorkflowRun?.status, queryClient]);

  async function submitAgentMessage() {
    const message = agentInput.trim();
    if (!message || !canUseAgent || isLoading) return;
    setAgentInput("");
    await sendMessage(message);
  }

  function applyPromptPackage() {
    if (!promptPackage?.generationPrompt?.trim()) return;
    onPromptChange(promptPackage.generationPrompt);
    if (typeof promptPackage.durationSec === "number") {
      onDurationChange(promptPackage.durationSec);
    }
    setFocusedSection("draft");
  }

  function clearConversation() {
    appliedGenerationKeysRef.current.clear();
    clear();
  }

  const hasPromptPackage = Boolean(
    promptPackage?.generationPrompt?.trim() ||
      promptPackage?.assistantMessage ||
      promptPackage?.hyperframesChecklist?.length,
  );

  return (
    <div className="flex min-h-[560px] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-hairline bg-background px-3 py-2">
        <div>
          <div className="text-sm font-medium text-foreground">AI prompt agent</div>
          <div className="text-xs text-muted-foreground">{modelLabel || "OpenRouter"}</div>
        </div>
        <Badge variant={canUseAgent ? "default" : "secondary"}>
          {canUseAgent ? "Ready" : "Offline"}
        </Badge>
      </div>

      <div
        className={cn(
          "min-h-[320px] flex-1 space-y-3 overflow-y-auto rounded-md bg-surface-card p-3",
          focusedSection === "chat" && "ring-2 ring-primary/30",
          focusedSection === "draft" && "ring-2 ring-primary/30",
          focusedSection === "checklist" && "ring-2 ring-primary/30",
          focusedSection === "approval" && "ring-2 ring-primary/30",
        )}
      >
        {messages.length ? (
          messages.map((message) => (
            <AgentMessage
              key={message.id}
              message={message}
              onApprove={(id) => addToolApprovalResponse({ id, approved: true })}
              onDeny={(id) => addToolApprovalResponse({ id, approved: false })}
            />
          ))
        ) : (
          <div className="grid min-h-40 place-items-center px-4 text-center text-sm text-muted-foreground">
            <div>
              <MessageCircle className="mx-auto mb-2 h-5 w-5" aria-hidden="true" />
              <p>Ask for help turning a rough idea into a generation-ready prompt.</p>
            </div>
          </div>
        )}
        {hasPromptPackage ? (
          <PromptPackageArtifact
            promptPackage={promptPackage}
            durationSec={durationSec}
            onApply={applyPromptPackage}
            canApply={hasPackagePrompt}
          />
        ) : null}
        {latestWorkflowRun ? <WorkflowRunArtifact run={latestWorkflowRun} /> : null}
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Thinking...</span>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error.message}
        </div>
      ) : null}

      <div className="mt-auto space-y-2 border-t border-hairline pt-3">
        <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
          Ask the agent
        </div>
        <Textarea
          aria-label="Ask the agent"
          value={agentInput}
          onChange={(event) => setAgentInput(event.target.value)}
          rows={3}
          placeholder="Describe the motion, mood, product, or problem to solve"
          disabled={!canUseAgent || isLoading}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void submitAgentMessage();
            }
          }}
        />
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            className="col-span-2"
            onClick={submitAgentMessage}
            disabled={!canUseAgent || isLoading || !agentInput.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            Send
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={isLoading ? stop : error ? reload : clearConversation}
            disabled={!messages.length && !isLoading && !error}
          >
            {isLoading ? (
              <Square className="h-4 w-4" aria-hidden="true" />
            ) : error ? (
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            ) : (
              <X className="h-4 w-4" aria-hidden="true" />
            )}
            {isLoading ? "Stop" : error ? "Retry" : "Clear"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function WorkflowRunArtifact({ run }: { run: WorkflowRunOutput }) {
  const progressLabel = run.progress?.label || run.phase;
  const progressText = run.progress
    ? `${run.progress.current}/${run.progress.total}`
    : run.status;
  const tone =
    run.status === "failed"
      ? "border-red-300 bg-red-50 text-red-950"
      : run.status === "succeeded"
        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
        : "border-hairline bg-white text-body";

  return (
    <div className={cn("rounded-md border p-3 text-sm shadow-sm", tone)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-normal opacity-70">
            Website workflow
          </div>
          <div className="mt-1 font-medium">{progressLabel}</div>
          <div className="mt-0.5 text-xs opacity-75">
            {run.status} · {progressText}
          </div>
        </div>
        <Badge variant="outline">{run.phase}</Badge>
      </div>

      {run.error ? (
        <p className="mt-3 text-sm">{run.error.message}</p>
      ) : null}

      {run.artifactManifest?.warnings?.length ? (
        <div className="mt-3 space-y-1 text-xs opacity-80">
          {run.artifactManifest.warnings.slice(0, 2).map((warning, index) => (
            <div key={`${warning}-${index}`}>{warning}</div>
          ))}
        </div>
      ) : null}

      {run.artifacts.length ? (
        <div className="mt-3 grid gap-1 text-xs">
          {run.artifacts.slice(0, 4).map((artifact) => (
            <div
              key={`${artifact.role}-${artifact.path}`}
              className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-1"
            >
              <span className="truncate">{artifact.path}</span>
              <span className="shrink-0 opacity-70">{artifact.storage.provider}</span>
            </div>
          ))}
        </div>
      ) : null}

      {run.skippedSteps.length ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {run.skippedSteps.slice(0, 4).map((step) => (
            <Badge key={step.id} variant="secondary" className="rounded-full">
              {step.label}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="secondary">
          <a href={`/workflows/${encodeURIComponent(run.id)}`}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open Wizard
          </a>
        </Button>
        {run.studioUrl ? (
          <Button asChild size="sm" variant="outline">
            <a href={run.studioUrl}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open Studio
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PromptPackageArtifact({
  promptPackage,
  durationSec,
  onApply,
  canApply,
}: {
  promptPackage: PromptAgentPartialResult | null;
  durationSec: number;
  onApply: () => void;
  canApply: boolean;
}) {
  const packageDuration = promptPackage?.durationSec ?? durationSec;
  const prompt = promptPackage?.generationPrompt?.trim();

  return (
    <div className="rounded-md border border-hairline bg-white p-3 text-sm text-body shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
            Proposed prompt
          </div>
          <div className="mt-1 font-medium text-foreground">
            {promptPackage?.title || "Generation-ready draft"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {formatDurationLabel(packageDuration)} duration
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onApply}
          disabled={!canApply}
        >
          <WandSparkles className="h-4 w-4" aria-hidden="true" />
          Apply
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {promptPackage?.assistantMessage ||
          "Review this proposed HyperFrame prompt. If it looks right, apply it or approve generation in the chat."}
      </p>
      {prompt ? (
        <div className="mt-3 rounded-md bg-surface-card p-3 text-sm text-body">
          {prompt}
        </div>
      ) : null}
      {promptPackage?.hyperframesChecklist?.length ? (
        <div className="mt-3 space-y-1">
          {promptPackage.hyperframesChecklist.slice(0, 5).map((item, index) => (
            <div
              key={`${item.label ?? "check"}-${index}`}
              className="flex items-start gap-2 text-xs text-muted-foreground"
            >
              <Check
                className={cn(
                  "mt-0.5 h-3.5 w-3.5 shrink-0",
                  item.satisfied ? "text-emerald-600" : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
              <span>{item.label || item.notes || "HyperFrames check"}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AgentMessage({
  message,
  onApprove,
  onDeny,
}: {
  message: UIMessage;
  onApprove: (approvalId: string) => void;
  onDeny: (approvalId: string) => void;
}) {
  const structured = message.parts.find((part) => part.type === "structured-output");
  const structuredOutput = structured as
    | { data?: PromptAgentPartialResult; partial?: PromptAgentPartialResult }
    | undefined;
  const structuredMessage =
    structured?.type === "structured-output"
      ? structuredOutput?.data?.assistantMessage || structuredOutput?.partial?.assistantMessage
      : undefined;
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.content)
    .filter((part) => !looksLikeJson(part))
    .join("");
  const label = message.role === "user" ? "You" : "Agent";

  return (
    <div
      className={cn(
        "rounded-md p-3 text-sm",
        message.role === "user"
          ? "bg-primary text-primary-foreground"
          : "border border-hairline bg-white text-body",
      )}
    >
      <div className="mb-1 text-xs font-medium opacity-75">{label}</div>
      {structuredMessage || text ? <p>{structuredMessage || text}</p> : null}
      <div className="mt-2 space-y-2">
        {message.parts.map((part, index) => {
          if (part.type !== "tool-call") return null;
          const approvalId = part.approval?.id;
          const needsDecision =
            part.approval?.needsApproval && part.approval.approved === undefined;
          return (
            <div
              key={`${part.id}-${index}`}
              className="rounded-md border border-hairline bg-surface-card p-2 text-xs text-body"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{promptAgentToolLabel(part.name)}</span>
                <Badge variant="outline">{formatAgentToolState(part.state)}</Badge>
              </div>
              {part.input ? (
                <div className="mt-1 text-muted-foreground">
                  {safePreview(part.input)}
                </div>
              ) : null}
              {needsDecision && approvalId ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onApprove(approvalId)}
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {part.name === "generate_hyperframe"
                      ? "Approve & Generate"
                      : part.name === "materialize_hyperframe_components"
                        ? "Approve & Install"
                        : "Approve"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onDeny(approvalId)}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Deny
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function normalizePartialResult(
  value: PromptAgentPartialResult,
): PromptAgentPartialResult | null {
  return value && Object.keys(value).length ? value : null;
}

function formatDurationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = seconds / 60;
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function looksLikeJson(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}
