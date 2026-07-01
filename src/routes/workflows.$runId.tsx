import { useEffect, useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react";
import { z } from "zod";

import { AppHeader } from "@/components/app-header";
import { PromptAgentPanel } from "@/components/prompt-agent-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { messageFromError } from "@/lib/api-client";
import {
  useConfigQuery,
  useSaveWorkflowStageArtifactMutation,
  useValidateWorkflowStageMutation,
  useWorkflowStageArtifactQuery,
  useWorkflowStagePlanQuery,
} from "@/lib/app-queries";
import { fieldError, formSubmitHandler } from "@/lib/form-utils";
import type {
  WizardStage,
  WizardStageArtifactContent,
  WizardStageId,
} from "@/lib/pipeline-wizard";

export const Route = createFileRoute("/workflows/$runId")({
  component: WorkflowWizardPage,
});

const EMPTY_GALLERY_CONTEXT = { examples: [], components: [] };
const artifactFormSchema = z.object({
  artifact: z.object({
    content: z.string().max(2 * 1024 * 1024, "Artifact is too large."),
  }),
});

function WorkflowWizardPage() {
  const { runId } = Route.useParams();
  const configQuery = useConfigQuery();
  const stagePlanQuery = useWorkflowStagePlanQuery(runId);
  const [selectedStageId, setSelectedStageId] = useState<WizardStageId | null>(null);
  const [selectedArtifactPath, setSelectedArtifactPath] = useState("");
  const [agentDraft, setAgentDraft] = useState("");
  const toast = useToast();

  const stagePlan = stagePlanQuery.data ?? null;
  const activeStageId = selectedStageId ?? stagePlan?.activeStageId ?? "capture";
  const activeStage = stagePlan?.stages.find((stage) => stage.id === activeStageId) ?? null;
  const selectedArtifact =
    activeStage?.artifacts.find((artifact) => artifact.path === selectedArtifactPath) ??
    activeStage?.artifacts.find((artifact) => artifact.editable) ??
    activeStage?.artifacts[0] ??
    null;
  const artifactQuery = useWorkflowStageArtifactQuery(
    {
      runId,
      stageId: activeStage?.id,
      path: selectedArtifact?.editable ? selectedArtifact.path : null,
    },
    Boolean(selectedArtifact?.editable),
  );

  useEffect(() => {
    if (!activeStage) return;
    const nextPath =
      activeStage.artifacts.find((artifact) => artifact.editable)?.path ??
      activeStage.artifacts[0]?.path ??
      "";
    setSelectedArtifactPath((current) =>
      current && activeStage.artifacts.some((artifact) => artifact.path === current)
        ? current
        : nextPath,
    );
  }, [activeStage]);

  const agentPrompt = artifactQuery.data?.content ?? agentDraft;
  const aiEnabled = configQuery.data?.aiGenEnabled ?? false;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <AppHeader active="workspace" />
      <main className="grid min-h-0 flex-1 gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:px-6">
        <section className="min-w-0 rounded-lg border border-hairline bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
            <div>
              <p className="text-sm text-muted-foreground">Pipeline wizard</p>
              <h1 className="text-2xl font-semibold">Workflow stages</h1>
            </div>
            <div className="flex items-center gap-2">
              {stagePlan ? <Badge variant="secondary">{stagePlan.status}</Badge> : null}
              {stagePlan?.studioUrl ? (
                <Button asChild size="sm" variant="outline">
                  <a href={stagePlan.studioUrl}>Open Studio</a>
                </Button>
              ) : null}
              <Button asChild size="sm" variant="secondary">
                <Link to="/projects">
                  Projects
                </Link>
              </Button>
            </div>
          </div>

          {stagePlanQuery.isPending ? (
            <div className="grid min-h-[30rem] place-items-center text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading workflow
              </span>
            </div>
          ) : stagePlanQuery.isError ? (
            <div className="grid min-h-[30rem] place-items-center px-6 text-center">
              <div>
                <AlertCircle className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {messageFromError(stagePlanQuery.error)}
                </p>
              </div>
            </div>
          ) : stagePlan && activeStage ? (
            <div className="grid min-h-[calc(100dvh-10rem)] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
              <StageRail
                stages={stagePlan.stages}
                selectedStageId={activeStage.id}
                onSelect={(stageId) => {
                  setSelectedStageId(stageId);
                  setSelectedArtifactPath("");
                }}
              />
              <div className="min-w-0 space-y-4 border-t border-hairline p-4 lg:border-l lg:border-t-0">
                <StageHeader stage={activeStage} />
                {activeStage.artifacts.length ? (
                  <ArtifactChooser
                    stage={activeStage}
                    selectedPath={selectedArtifact?.path ?? ""}
                    onSelect={setSelectedArtifactPath}
                  />
                ) : null}
                {selectedArtifact?.editable && artifactQuery.data ? (
                  <StageArtifactEditor
                    artifact={artifactQuery.data}
                    stageId={activeStage.id}
                    runId={runId}
                  />
                ) : selectedArtifact ? (
                  <div className="rounded-md border border-hairline bg-surface-card p-4 text-sm text-muted-foreground">
                    {selectedArtifact.path} is available as a workflow artifact but is not editable in the wizard.
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-hairline bg-surface-card p-4 text-sm text-muted-foreground">
                    This stage has no editable artifacts yet.
                  </div>
                )}
                {artifactQuery.isError ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                    {messageFromError(artifactQuery.error)}
                  </div>
                ) : null}
                <StageValidationAction runId={runId} stageId={activeStage.id} />
              </div>
            </div>
          ) : null}
        </section>

        <aside className="min-w-0 rounded-lg border border-hairline bg-card p-4">
          <PromptAgentPanel
            prompt={agentPrompt}
            onPromptChange={setAgentDraft}
            durationSec={6}
            onDurationChange={() => undefined}
            aiEnabled={aiEnabled}
            isConfigReady={!configQuery.isPending}
            modelLabel={configQuery.data?.modelLabel ?? "OpenRouter"}
            voiceInputEnabled={configQuery.data?.voiceInputEnabled ?? false}
            transcriptionProviderLabel={configQuery.data?.transcriptionProviderLabel ?? null}
            activeProjectId={stagePlan?.projectId ?? ""}
            activeProjectTitle={stagePlan?.workflowId ?? "Workflow"}
            workflowRunId={runId}
            activeWizardStageId={activeStage?.id}
            selectedGalleryContext={EMPTY_GALLERY_CONTEXT}
            isGenerating={false}
            isRendering={false}
            onGenerated={() => toast.success("Generated output is available.")}
          />
        </aside>
      </main>
    </div>
  );
}

function StageRail({
  stages,
  selectedStageId,
  onSelect,
}: {
  stages: Array<WizardStage>;
  selectedStageId: WizardStageId;
  onSelect: (stageId: WizardStageId) => void;
}) {
  return (
    <nav className="space-y-2 p-3" aria-label="Pipeline stages">
      {stages.map((stage, index) => (
        <button
          key={stage.id}
          type="button"
          onClick={() => onSelect(stage.id)}
          className={`flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors ${
            selectedStageId === stage.id
              ? "border-foreground bg-background"
              : "border-hairline bg-surface-card hover:border-foreground/40"
          }`}
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-background text-xs font-semibold">
            {index + 1}
          </span>
          <span className="min-w-0">
            <span className="block font-medium">{stage.label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{stage.status}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}

function StageHeader({ stage }: { stage: WizardStage }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">{stage.description}</p>
        <h2 className="mt-1 text-2xl font-semibold">{stage.label}</h2>
      </div>
      <Badge variant={stage.status === "ready" ? "default" : "secondary"}>{stage.status}</Badge>
      {stage.skippedReason ? (
        <p className="basis-full rounded-md bg-surface-card px-3 py-2 text-sm text-muted-foreground">
          {stage.skippedReason}
        </p>
      ) : null}
    </header>
  );
}

function ArtifactChooser({
  stage,
  selectedPath,
  onSelect,
}: {
  stage: WizardStage;
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {stage.artifacts.map((artifact) => (
        <Button
          key={artifact.path}
          type="button"
          size="sm"
          variant={artifact.path === selectedPath ? "default" : "outline"}
          onClick={() => onSelect(artifact.path)}
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          {artifact.label}
        </Button>
      ))}
    </div>
  );
}

function StageArtifactEditor({
  artifact,
  stageId,
  runId,
}: {
  artifact: WizardStageArtifactContent;
  stageId: WizardStageId;
  runId: string;
}) {
  const saveMutation = useSaveWorkflowStageArtifactMutation();
  const toast = useToast();
  const form = useForm({
    defaultValues: {
      artifact: {
        content: artifact.content,
      },
    },
    validators: {
      onSubmit: artifactFormSchema,
    },
    onSubmit: async ({ value }) => {
      const input = artifactFormSchema.parse(value);
      try {
        const saved = await saveMutation.mutateAsync({
          runId,
          stageId,
          path: artifact.path,
          content: input.artifact.content,
          revision: artifact.revision,
        });
        form.reset({ artifact: { content: saved.content } });
        toast.success("Stage artifact saved.");
      } catch (err) {
        toast.error(messageFromError(err));
      }
    },
  });

  useEffect(() => {
    form.reset({ artifact: { content: artifact.content } });
  }, [artifact.content, artifact.revision, form]);

  return (
    <form className="space-y-3" onSubmit={formSubmitHandler(() => form.handleSubmit())}>
      <form.FormGroup name="artifact">
        {() => (
          <form.Field name="artifact.content">
            {(field) => {
              const error = fieldError(field.state.meta);
              return (
                <div className="space-y-2">
                  <Label htmlFor={`artifact-${stageId}`}>{artifact.path}</Label>
                  <Textarea
                    id={`artifact-${stageId}`}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    rows={18}
                    className="min-h-[28rem] font-mono text-sm"
                    aria-invalid={Boolean(error)}
                  />
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                </div>
              );
            }}
          </form.Field>
        )}
      </form.FormGroup>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty] as const}>
        {([canSubmit, isSubmitting, isDirty]) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!canSubmit || !isDirty || isSubmitting || saveMutation.isPending}>
              {isSubmitting || saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              Save artifact
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || saveMutation.isPending}
              onClick={() => form.reset()}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Discard
            </Button>
            {isDirty ? (
              <span className="text-sm text-muted-foreground">Unsaved changes</span>
            ) : null}
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

function StageValidationAction({ runId, stageId }: { runId: string; stageId: WizardStageId }) {
  const validationMutation = useValidateWorkflowStageMutation();
  return (
    <div className="rounded-md border border-hairline bg-surface-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Validation checks the latest saved stage artifacts.
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={validationMutation.isPending}
          onClick={() => validationMutation.mutate({ runId, stageId })}
        >
          {validationMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          Validate
        </Button>
      </div>
      {validationMutation.data ? (
        <div className="mt-3 text-sm">
          <span className="font-medium">{validationMutation.data.status}</span>
          {validationMutation.data.warnings.length ? (
            <ul className="mt-2 list-inside list-disc text-muted-foreground">
              {validationMutation.data.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {validationMutation.isError ? (
        <p className="mt-3 text-sm text-destructive">
          {messageFromError(validationMutation.error)}
        </p>
      ) : null}
    </div>
  );
}
