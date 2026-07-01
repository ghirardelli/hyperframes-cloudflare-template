import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Play,
  RotateCcw,
  Save,
} from "lucide-react";
import { z } from "zod";

import { AppHeader } from "@/components/app-header";
import { PromptAgentPanel } from "@/components/prompt-agent-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { messageFromError } from "@/lib/api-client";
import {
  useConfigQuery,
  useContinueWorkflowMutation,
  useSaveWorkflowIntakeMutation,
  useSaveWorkflowStageArtifactMutation,
  useValidateWorkflowStageMutation,
  useWorkflowStageArtifactQuery,
  useWorkflowStagePlanQuery,
} from "@/lib/app-queries";
import { fieldError, formSubmitHandler } from "@/lib/form-utils";
import {
  DURATION_PRESETS,
  normalizeDurationSec,
} from "@/lib/main-page-creation-flow";
import type {
  WizardStage,
  WizardStageArtifactContent,
  WizardStageId,
} from "@/lib/pipeline-wizard";
import {
  WORKFLOW_INTAKE_SOURCE,
  getWorkflowIntakePayload,
  type WorkflowIntakePayload,
} from "@/lib/workflow-intake";
import type { SelectedGalleryPromptContext } from "@/lib/hyperframe-gallery-catalog";

export const Route = createFileRoute("/workflows/$runId")({
  component: WorkflowWizardPage,
});

const EMPTY_GALLERY_CONTEXT: SelectedGalleryPromptContext = { examples: [], components: [] };
const artifactFormSchema = z.object({
  artifact: z.object({
    content: z.string().max(2 * 1024 * 1024, "Artifact is too large."),
  }),
});
const creativeBriefFormSchema = z
  .object({
    prompt: z.string().trim().min(1, "Enter a prompt.").max(8_000, "Prompt is too long."),
    sourceUrl: z.string().trim().max(2_000, "URL is too long."),
    durationSec: z.number().min(1).max(300).transform((value) => normalizeDurationSec(value)),
  })
  .superRefine((value, ctx) => {
    const sourceUrl = value.sourceUrl.trim();
    if (!sourceUrl) return;
    try {
      const url = new URL(sourceUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        ctx.addIssue({
          code: "custom",
          path: ["sourceUrl"],
          message: "Enter an http or https URL.",
        });
      }
    } catch {
      ctx.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "Enter a valid URL.",
      });
    }
  });

type CreativeBriefFormValues = z.input<typeof creativeBriefFormSchema>;

function WorkflowWizardPage() {
  const { runId } = Route.useParams();
  const configQuery = useConfigQuery();
  const stagePlanQuery = useWorkflowStagePlanQuery(runId);
  const [selectedStageId, setSelectedStageId] = useState<WizardStageId | null>(null);
  const [selectedArtifactPath, setSelectedArtifactPath] = useState("");
  const [agentDraft, setAgentDraft] = useState("");
  const toast = useToast();

  const stagePlan = stagePlanQuery.data ?? null;
  const intakePayload = useMemo(
    () => getWorkflowIntakePayload(stagePlan?.options),
    [stagePlan?.options],
  );
  const intakeGalleryContext = intakePayload?.selectedGalleryContext ?? EMPTY_GALLERY_CONTEXT;
  const activeStageId = selectedStageId ?? stagePlan?.activeStageId ?? "capture";
  const activeStage = stagePlan?.stages.find((stage) => stage.id === activeStageId) ?? null;
  const isIntakeBriefStage =
    stagePlan?.status === "intake" && activeStage?.id === "capture" && Boolean(intakePayload);
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

  const agentPrompt = intakePayload?.prompt ?? artifactQuery.data?.content ?? agentDraft;
  const aiEnabled = configQuery.data?.aiGenEnabled ?? false;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <AppHeader active="workspace" />
      <main className="grid min-h-0 flex-1 gap-3 px-3 py-3 lg:grid-cols-[220px_minmax(0,1fr)_360px] lg:px-4">
        <aside className="min-w-0 rounded-lg border border-hairline bg-card">
          <div className="border-b border-hairline px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
              Pipeline wizard
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <h1 className="truncate text-lg font-semibold">Workflow</h1>
              {stagePlan ? <Badge variant="secondary">{stagePlan.status}</Badge> : null}
            </div>
          </div>
          {stagePlanQuery.isPending ? (
            <div className="grid min-h-52 place-items-center text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading
              </span>
            </div>
          ) : stagePlanQuery.isError ? (
            <div className="grid min-h-52 place-items-center px-3 text-center">
              <div>
                <AlertCircle className="mx-auto h-6 w-6 text-destructive" aria-hidden="true" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {messageFromError(stagePlanQuery.error)}
                </p>
              </div>
            </div>
          ) : stagePlan && activeStage ? (
            <StageRail
              stages={stagePlan.stages}
              selectedStageId={activeStage.id}
              onSelect={(stageId) => {
                setSelectedStageId(stageId);
                setSelectedArtifactPath("");
              }}
            />
          ) : null}
          <div className="flex flex-wrap gap-2 border-t border-hairline p-3">
            {stagePlan?.studioUrl ? (
              <Button asChild size="sm" variant="outline" className="h-8 px-2 text-xs">
                <a href={stagePlan.studioUrl}>Open Studio</a>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="secondary" className="h-8 px-2 text-xs">
              <Link to="/projects">Projects</Link>
            </Button>
          </div>
        </aside>

        <section className="min-w-0 rounded-lg border border-hairline bg-card">
          {stagePlanQuery.isPending ? (
            <div className="grid min-h-[32rem] place-items-center text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading workflow
              </span>
            </div>
          ) : stagePlanQuery.isError ? (
            <div className="grid min-h-[32rem] place-items-center px-6 text-center">
              <div>
                <AlertCircle className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {messageFromError(stagePlanQuery.error)}
                </p>
              </div>
            </div>
          ) : stagePlan && activeStage ? (
            <div className="grid gap-3 p-3">
              <StageHeader stage={activeStage} />
              {isIntakeBriefStage && intakePayload ? (
                <CreativeBriefForm
                  runId={runId}
                  intake={intakePayload}
                  projectId={stagePlan.projectId}
                />
              ) : (
                <>
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
                    <div className="rounded-md border border-hairline bg-surface-card p-3 text-sm text-muted-foreground">
                      {selectedArtifact.path} is available as a workflow artifact but is not editable in the wizard.
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-hairline bg-surface-card p-3 text-sm text-muted-foreground">
                      This stage has no editable artifacts yet.
                    </div>
                  )}
                  {artifactQuery.isError ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                      {messageFromError(artifactQuery.error)}
                    </div>
                  ) : null}
                  <StageValidationAction runId={runId} stageId={activeStage.id} />
                </>
              )}
            </div>
          ) : null}
        </section>

        <aside className="min-w-0 rounded-lg border border-hairline bg-card p-3">
          <PromptAgentPanel
            prompt={agentPrompt}
            onPromptChange={setAgentDraft}
            durationSec={intakePayload?.durationSec ?? 6}
            onDurationChange={() => undefined}
            aiEnabled={aiEnabled}
            isConfigReady={!configQuery.isPending}
            modelLabel={configQuery.data?.modelLabel ?? "OpenRouter"}
            voiceInputEnabled={configQuery.data?.voiceInputEnabled ?? false}
            transcriptionProviderLabel={configQuery.data?.transcriptionProviderLabel ?? null}
            activeProjectId={stagePlan?.projectId ?? intakePayload?.projectId ?? ""}
            activeProjectTitle={stagePlan?.workflowId ?? "Workflow"}
            workflowRunId={runId}
            activeWizardStageId={activeStage?.id}
            selectedGalleryContext={intakeGalleryContext}
            isGenerating={false}
            isRendering={false}
            onGenerated={() => toast.success("Generated output is available.")}
          />
        </aside>
      </main>
    </div>
  );
}

function CreativeBriefForm({
  runId,
  intake,
  projectId,
}: {
  runId: string;
  intake: WorkflowIntakePayload;
  projectId: string | null;
}) {
  const saveMutation = useSaveWorkflowIntakeMutation();
  const continueMutation = useContinueWorkflowMutation();
  const toast = useToast();
  const submitIntentRef = useRef<"save" | "start">("save");
  const form = useForm({
    defaultValues: valuesFromIntake(intake),
    validators: {
      onChange: creativeBriefFormSchema,
      onSubmit: creativeBriefFormSchema,
    },
    onSubmit: async ({ value }) => {
      const input = creativeBriefFormSchema.parse(value);
      try {
        const saved = await saveMutation.mutateAsync({
          runId,
          intake: buildUpdatedIntakePayload(intake, input, projectId),
        });
        toast.success("Brief saved.");
        if (submitIntentRef.current === "start") {
          await continueMutation.mutateAsync(runId);
          toast.success("Workflow started.");
        }
        const nextIntake = getWorkflowIntakePayload(saved.options) ?? intake;
        form.reset(valuesFromIntake(nextIntake));
      } catch (err) {
        toast.error(messageFromError(err));
      } finally {
        submitIntentRef.current = "save";
      }
    },
  });

  useEffect(() => {
    form.reset(valuesFromIntake(intake));
  }, [form, intake.durationSec, intake.prompt, intake.sourceUrl]);

  const isBusy = saveMutation.isPending || continueMutation.isPending;
  const selectedContext = intake.selectedGalleryContext ?? EMPTY_GALLERY_CONTEXT;
  const selectedContextCount =
    selectedContext.examples.length + selectedContext.components.length;

  return (
    <form className="grid gap-3" onSubmit={formSubmitHandler(() => form.handleSubmit())}>
      <div className="grid gap-1.5">
        <form.Field name="prompt">
          {(field) => {
            const error = fieldError(field.state.meta);
            return (
              <>
                <Label htmlFor="creative-brief-prompt">Brief</Label>
                <Textarea
                  id="creative-brief-prompt"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  rows={5}
                  className="min-h-32 text-sm"
                  aria-invalid={Boolean(error)}
                  disabled={isBusy}
                />
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </>
            );
          }}
        </form.Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
        <form.Field name="sourceUrl">
          {(field) => {
            const error = fieldError(field.state.meta);
            return (
              <div className="grid gap-1.5">
                <Label htmlFor="creative-brief-url">Source URL</Label>
                <Input
                  id="creative-brief-url"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="https://example.com"
                  aria-invalid={Boolean(error)}
                  disabled={isBusy}
                />
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
            );
          }}
        </form.Field>

        <form.Field name="durationSec">
          {(field) => (
            <div className="grid gap-1.5">
              <Label htmlFor="creative-brief-duration">Duration</Label>
              <select
                id="creative-brief-duration"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(normalizeDurationSec(event.target.value))}
                disabled={isBusy}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15 disabled:opacity-50"
              >
                {DURATION_PRESETS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {formatDuration(seconds)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form.Field>
      </div>

      <IntakeContextSummary context={selectedContext} projectId={projectId ?? intake.projectId} />

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty] as const}>
        {([canSubmit, isSubmitting, isDirty]) => (
          <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit || isSubmitting || isBusy}
              onClick={() => {
                submitIntentRef.current = "save";
              }}
            >
              {isSubmitting || saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isSubmitting || isBusy || !isDirty}
              onClick={() => form.reset()}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Discard
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={!canSubmit || isSubmitting || isBusy}
              onClick={() => {
                submitIntentRef.current = "start";
              }}
            >
              {continueMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
              Start workflow
            </Button>
            <span className="text-xs text-muted-foreground">
              {selectedContextCount
                ? `${selectedContextCount} context item${selectedContextCount === 1 ? "" : "s"} attached`
                : "No selected templates or components"}
            </span>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

function IntakeContextSummary({
  context,
  projectId,
}: {
  context: SelectedGalleryPromptContext;
  projectId?: string | null;
}) {
  return (
    <div className="rounded-md border border-hairline bg-surface-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Selected context</h3>
        {projectId ? <Badge variant="outline">Project target</Badge> : null}
      </div>
      {projectId ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">{projectId}</p>
      ) : null}
      {context.examples.length || context.components.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {context.examples.map((template) => (
            <ContextPill key={`template-${template.id}`} label="Template" name={template.name} />
          ))}
          {context.components.map((component) => (
            <ContextPill
              key={`component-${component.id}`}
              label={component.materialization.state === "materializable" ? "Installable" : "Component"}
              name={component.name}
            />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Add templates and components from the main page, or ask the agent to help refine the brief here.
        </p>
      )}
    </div>
  );
}

function ContextPill({ label, name }: { label: string; name: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-hairline bg-background px-3 py-1 text-xs">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className="max-w-52 truncate text-foreground">{name}</span>
    </span>
  );
}

function valuesFromIntake(intake: WorkflowIntakePayload): CreativeBriefFormValues {
  return {
    prompt: intake.prompt,
    sourceUrl: intake.sourceUrl ?? "",
    durationSec: intake.durationSec ?? 6,
  };
}

function buildUpdatedIntakePayload(
  intake: WorkflowIntakePayload,
  input: z.output<typeof creativeBriefFormSchema>,
  projectId: string | null,
): WorkflowIntakePayload {
  return {
    ...intake,
    source: WORKFLOW_INTAKE_SOURCE,
    prompt: input.prompt,
    sourceUrl: input.sourceUrl.trim() || undefined,
    durationSec: input.durationSec,
    projectId: intake.projectId ?? projectId ?? undefined,
    selectedGalleryContext: intake.selectedGalleryContext,
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${seconds / 60}m`;
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
    <nav className="space-y-1.5 p-2" aria-label="Pipeline stages">
      {stages.map((stage, index) => (
        <button
          key={stage.id}
          type="button"
          onClick={() => onSelect(stage.id)}
          className={`flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${
            selectedStageId === stage.id
              ? "border-foreground bg-background"
              : "border-hairline bg-surface-card hover:border-foreground/40"
          }`}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-background text-xs font-semibold">
            {index + 1}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{stage.label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{stage.status}</span>
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
        <p className="text-xs text-muted-foreground">{stage.description}</p>
        <h2 className="mt-1 text-xl font-semibold">{stage.label}</h2>
      </div>
      <Badge variant={stage.status === "ready" ? "default" : "secondary"}>{stage.status}</Badge>
      {stage.skippedReason ? (
        <p className="basis-full rounded-md bg-surface-card px-3 py-2 text-xs text-muted-foreground">
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
