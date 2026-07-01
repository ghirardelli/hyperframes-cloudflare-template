import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  Layers3,
  Loader2,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { buildPromptContextFromIds } from "@/components/hyperframe-gallery-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { messageFromError } from "@/lib/api-client";
import {
  useConfigQuery,
  useMeQuery,
  useStartWebsiteToVideoWorkflowMutation,
} from "@/lib/app-queries";
import { fieldError, formSubmitHandler } from "@/lib/form-utils";
import {
  DEFAULT_DURATION_SEC,
  DURATION_PRESETS,
  normalizeDurationSec,
} from "@/lib/main-page-creation-flow";
import {
  countSelectedGalleryItems,
  filterGalleryComponents,
  listGalleryComponentCategories,
  listGalleryComponents,
  listGalleryExamples,
  removeGallerySelectionId,
  toggleGallerySelectionId,
  GALLERY_COMPONENT_SELECTION_LIMIT,
  GALLERY_EXAMPLE_SELECTION_LIMIT,
  type GalleryComponent,
  type GalleryExample,
  type SelectedGalleryPromptContext,
} from "@/lib/hyperframe-gallery-catalog";
import { workflowIntakeFormSchema, type WorkflowIntakeFormValues } from "@/lib/form-schemas";
import { getComponentMaterializationState } from "@/lib/hyperframe-component-registry";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: MotionFramesHome,
});

function MotionFramesHome() {
  const navigate = useNavigate();
  const meQuery = useMeQuery();
  const configQuery = useConfigQuery();
  const startWorkflowMutation = useStartWebsiteToVideoWorkflowMutation();
  const toast = useToast();
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Array<string>>([]);
  const [selectedComponentIds, setSelectedComponentIds] = useState<Array<string>>([]);
  const [componentPlacementIntents, setComponentPlacementIntents] = useState<Record<string, string>>({});
  const [componentPickerOpen, setComponentPickerOpen] = useState(false);
  const [componentSearch, setComponentSearch] = useState("");
  const [activeComponentCategory, setActiveComponentCategory] = useState("All");
  const templates = useMemo(() => listGalleryExamples(), []);
  const components = useMemo(() => listGalleryComponents(), []);
  const categories = useMemo(() => listGalleryComponentCategories(), []);
  const selectedGalleryContext = useMemo(
    () =>
      buildPromptContextFromIds({
        exampleIds: selectedTemplateIds,
        componentIds: selectedComponentIds,
        componentPlacementIntents,
      }),
    [componentPlacementIntents, selectedComponentIds, selectedTemplateIds],
  );
  const selectedContextCount = countSelectedGalleryItems(selectedGalleryContext);
  const visibleComponents = useMemo(() => {
    const categoryFiltered = filterGalleryComponents(components, activeComponentCategory);
    const query = componentSearch.trim().toLowerCase();
    if (!query) return categoryFiltered;
    return categoryFiltered.filter((component) =>
      [
        component.name,
        component.description,
        component.category,
        ...component.tags,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [activeComponentCategory, componentSearch, components]);
  const workflowEnabled = configQuery.data?.websiteToVideoWorkflowEnabled ?? false;
  const isConfigReady = !configQuery.isPending;

  const intakeForm = useForm({
    defaultValues: {
      prompt: "",
      durationSec: DEFAULT_DURATION_SEC,
    } satisfies WorkflowIntakeFormValues,
    validators: {
      onChange: workflowIntakeFormSchema,
      onSubmit: workflowIntakeFormSchema,
    },
    onSubmit: async ({ value }) => {
      const input = workflowIntakeFormSchema.parse(value);
      try {
        const workflowRun = await startWorkflowMutation.mutateAsync({
          prompt: input.prompt,
          durationSec: input.durationSec,
          title: titleFromPrompt(input.prompt),
          selectedGalleryContext: selectedContextCount ? selectedGalleryContext : undefined,
        });
        await navigate({
          to: "/workflows/$runId",
          params: { runId: workflowRun.id },
        });
      } catch (err) {
        toast.error(messageFromError(err));
      }
    },
  });
  const intakeValues = useStore(intakeForm.store, (state) => state.values);
  const canSubmit =
    workflowEnabled &&
    isConfigReady &&
    intakeValues.prompt.trim().length > 0 &&
    !startWorkflowMutation.isPending;

  useEffect(() => {
    if (meQuery.isError) window.location.assign("/login");
  }, [meQuery.isError]);

  function toggleTemplate(template: GalleryExample) {
    setSelectedTemplateIds((current) =>
      toggleGallerySelectionId(current, template.id, GALLERY_EXAMPLE_SELECTION_LIMIT),
    );
  }

  function toggleComponent(component: GalleryComponent) {
    setSelectedComponentIds((current) => {
      const next = toggleGallerySelectionId(current, component.id, GALLERY_COMPONENT_SELECTION_LIMIT);
      if (current.includes(component.id) && !next.includes(component.id)) {
        setComponentPlacementIntents((intents) => {
          const { [component.id]: _removed, ...rest } = intents;
          return rest;
        });
      }
      return next;
    });
  }

  function updateComponentPlacementIntent(componentId: string, placementIntent: string) {
    setComponentPlacementIntents((current) => ({
      ...current,
      [componentId]: placementIntent,
    }));
  }

  if (!meQuery.data) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-6 text-foreground">
        <div className="text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 text-lg font-medium">Opening Motion Frames...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <AppHeader active="workspace" />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="grid gap-1">
          <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            What do you want to create?
          </h1>
          <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
            Start with a prompt. Add templates or components only when they help the workflow.
          </p>
        </header>

        <section
          aria-label="Workflow intake"
          className="rounded-lg border border-hairline bg-background shadow-sm"
        >
          <form onSubmit={formSubmitHandler(() => intakeForm.handleSubmit())}>
            <div className="grid gap-3 p-3">
              <intakeForm.Field name="prompt">
                {(field) => {
                  const error = fieldError(field.state.meta);
                  return (
                    <div className="grid gap-1.5">
                      <Label htmlFor="workflow-prompt" className="sr-only">
                        Workflow prompt
                      </Label>
                      <Textarea
                        id="workflow-prompt"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Describe the HyperFrame you want to make..."
                        rows={4}
                        className="min-h-28 border-hairline bg-surface-soft text-sm"
                        aria-invalid={Boolean(error)}
                        disabled={startWorkflowMutation.isPending}
                      />
                      {error ? <p className="text-sm text-destructive">{error}</p> : null}
                    </div>
                  );
                }}
              </intakeForm.Field>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setComponentPickerOpen((current) => !current)}
                  aria-expanded={componentPickerOpen}
                  aria-controls="component-picker"
                >
                  <Layers3 className="h-4 w-4" aria-hidden="true" />
                  Components
                  {selectedGalleryContext.components.length ? (
                    <Badge variant="outline" className="h-5 px-2">
                      {selectedGalleryContext.components.length}
                    </Badge>
                  ) : null}
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>

                <intakeForm.Field name="durationSec">
                  {(field) => (
                    <label className="inline-flex h-9 items-center gap-2 rounded-md border border-hairline bg-background px-3 text-xs font-medium text-muted-foreground">
                      Duration
                      <select
                        aria-label="Duration"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(normalizeDurationSec(event.target.value))}
                        className="bg-transparent text-xs font-semibold text-foreground outline-none"
                        disabled={startWorkflowMutation.isPending}
                      >
                        {DURATION_PRESETS.map((seconds) => (
                          <option key={seconds} value={seconds}>
                            {formatDuration(seconds)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </intakeForm.Field>

                {selectedContextCount ? (
                  <Badge variant="secondary" className="h-8 px-3">
                    {selectedContextCount} context item{selectedContextCount === 1 ? "" : "s"}
                  </Badge>
                ) : null}

                <Button
                  type="submit"
                  className="ml-auto h-9 px-4"
                  disabled={!canSubmit}
                  aria-disabled={!canSubmit}
                >
                  {startWorkflowMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden="true" />
                  )}
                  Send
                </Button>
              </div>
            </div>

            {workflowEnabled ? null : (
              <div className="border-t border-hairline bg-surface-card px-3 py-2 text-xs text-muted-foreground">
                Workflow intake is unavailable until the website-to-video workflow is enabled.
              </div>
            )}
          </form>

          {selectedContextCount ? (
            <SelectedContextSummary
              context={selectedGalleryContext}
              disabled={startWorkflowMutation.isPending}
              onRemoveTemplate={(templateId) =>
                setSelectedTemplateIds((current) => removeGallerySelectionId(current, templateId))
              }
              onRemoveComponent={(componentId) => {
                setSelectedComponentIds((current) => removeGallerySelectionId(current, componentId));
                setComponentPlacementIntents((current) => {
                  const { [componentId]: _removed, ...rest } = current;
                  return rest;
                });
              }}
              onUpdateComponentPlacementIntent={updateComponentPlacementIntent}
            />
          ) : null}

          {componentPickerOpen ? (
            <ComponentPicker
              components={visibleComponents}
              categories={categories}
              activeCategory={activeComponentCategory}
              search={componentSearch}
              selectedComponentIds={selectedComponentIds}
              onSearchChange={setComponentSearch}
              onCategoryChange={setActiveComponentCategory}
              onToggleComponent={toggleComponent}
              onClose={() => setComponentPickerOpen(false)}
            />
          ) : null}
        </section>

        <TemplateRail
          templates={templates}
          selectedTemplateIds={selectedTemplateIds}
          onToggleTemplate={toggleTemplate}
        />
      </main>
    </div>
  );
}

function TemplateRail({
  templates,
  selectedTemplateIds,
  onToggleTemplate,
}: {
  templates: Array<GalleryExample>;
  selectedTemplateIds: ReadonlyArray<string>;
  onToggleTemplate: (template: GalleryExample) => void;
}) {
  return (
    <section aria-label="Templates" className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Start with a template</h2>
        <span className="text-xs text-muted-foreground">{templates.length} available</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {templates.map((template) => {
          const selected = selectedTemplateIds.includes(template.id);
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onToggleTemplate(template)}
              aria-pressed={selected}
              className={cn(
                "group grid min-w-52 max-w-52 overflow-hidden rounded-lg border bg-background text-left transition-colors",
                selected ? "border-foreground" : "border-hairline hover:border-foreground/50",
              )}
            >
              <GalleryMedia media={template.previewMedia} />
              <span className="grid gap-1 p-2.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {template.title}
                  </span>
                  {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                </span>
                <span className="line-clamp-2 text-xs leading-4 text-muted-foreground">
                  {template.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ComponentPicker({
  components,
  categories,
  activeCategory,
  search,
  selectedComponentIds,
  onSearchChange,
  onCategoryChange,
  onToggleComponent,
  onClose,
}: {
  components: Array<GalleryComponent>;
  categories: Array<{ category: string; count: number }>;
  activeCategory: string;
  search: string;
  selectedComponentIds: ReadonlyArray<string>;
  onSearchChange: (value: string) => void;
  onCategoryChange: (category: string) => void;
  onToggleComponent: (component: GalleryComponent) => void;
  onClose: () => void;
}) {
  return (
    <div
      id="component-picker"
      className="border-t border-hairline bg-surface-card p-3"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search components"
            className="h-9 w-full rounded-md border border-hairline bg-background pl-9 pr-3 text-sm outline-none focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15"
          />
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Close components" onClick={onClose}>
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
        <FilterButton active={activeCategory === "All"} onClick={() => onCategoryChange("All")}>
          All
        </FilterButton>
        {categories.map((item) => (
          <FilterButton
            key={item.category}
            active={activeCategory === item.category}
            onClick={() => onCategoryChange(item.category)}
          >
            {item.category}
          </FilterButton>
        ))}
      </div>
      <div className="grid max-h-[22rem] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {components.map((component) => {
          const selected = selectedComponentIds.includes(component.id);
          const materialization = getComponentMaterializationState(component);
          return (
            <button
              key={component.id}
              type="button"
              onClick={() => onToggleComponent(component)}
              aria-pressed={selected}
              className={cn(
                "grid overflow-hidden rounded-lg border bg-background text-left transition-colors",
                selected ? "border-foreground" : "border-hairline hover:border-foreground/50",
              )}
            >
              <GalleryMedia media={component.previewMedia} compact />
              <span className="grid gap-1 p-2.5">
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {component.name}
                  </span>
                  {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                </span>
                <span className="line-clamp-2 text-xs leading-4 text-muted-foreground">
                  {component.description}
                </span>
                <span className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="outline">{component.category}</Badge>
                  <Badge variant={materialization.state === "materializable" ? "secondary" : "outline"}>
                    {materialization.state === "materializable" ? "Installable" : "Prompt"}
                  </Badge>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors",
        active
          ? "border-foreground bg-foreground text-primary-foreground"
          : "border-hairline bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function SelectedContextSummary({
  context,
  disabled,
  onRemoveTemplate,
  onRemoveComponent,
  onUpdateComponentPlacementIntent,
}: {
  context: SelectedGalleryPromptContext;
  disabled: boolean;
  onRemoveTemplate: (templateId: string) => void;
  onRemoveComponent: (componentId: string) => void;
  onUpdateComponentPlacementIntent: (componentId: string, placementIntent: string) => void;
}) {
  return (
    <div className="border-t border-hairline bg-background px-3 py-2">
      <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        Selected context
      </div>
      <div className="flex flex-wrap gap-2">
        {context.examples.map((template) => (
          <ContextChip
            key={`template-${template.id}`}
            label="Template"
            name={template.name}
            disabled={disabled}
            onRemove={() => onRemoveTemplate(template.id)}
          />
        ))}
        {context.components.map((component) => (
          <ContextChip
            key={`component-${component.id}`}
            label={component.materialization.state === "materializable" ? "Installable" : "Component"}
            name={component.name}
            disabled={disabled}
            onRemove={() => onRemoveComponent(component.id)}
          />
        ))}
      </div>
      {context.components.some((component) => component.materialization.state === "materializable") ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {context.components.map((component) => {
            if (component.materialization.state !== "materializable") return null;
            return (
              <label key={component.id} className="grid gap-1 text-xs font-medium text-muted-foreground">
                {component.name} placement
                <Textarea
                  value={component.materialization.placementIntent ?? ""}
                  onChange={(event) => onUpdateComponentPlacementIntent(component.id, event.target.value)}
                  rows={2}
                  placeholder="Opening scene, final CTA, product demo beat..."
                  disabled={disabled}
                  className="min-h-16 text-sm"
                />
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ContextChip({
  label,
  name,
  disabled,
  onRemove,
}: {
  label: string;
  name: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-hairline bg-surface-card px-3 py-1 text-xs text-foreground">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className="max-w-52 truncate">{name}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
        aria-label={`Remove ${name}`}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

function GalleryMedia({
  media,
  compact = false,
}: {
  media: GalleryExample["previewMedia"] | GalleryComponent["previewMedia"];
  compact?: boolean;
}) {
  const className = cn(
    "w-full bg-black object-cover",
    compact ? "aspect-[16/7]" : "aspect-video",
  );
  if (media.type === "video") {
    return (
      <video
        className={className}
        src={media.src}
        poster={media.poster}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        aria-label={media.alt}
      />
    );
  }
  return <img className={className} src={media.src} alt={media.alt} loading="lazy" />;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${seconds / 60}m`;
}

function titleFromPrompt(prompt: string): string {
  const words = prompt.trim().replace(/\s+/g, " ").split(" ").slice(0, 8).join(" ");
  return words || "New HyperFrame workflow";
}
