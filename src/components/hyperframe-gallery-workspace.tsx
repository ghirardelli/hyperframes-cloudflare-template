import type { RefObject } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Film,
  Info,
  Layers3,
  Plus,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  createSelectedComponentItem,
  createSelectedExampleItem,
  filterGalleryComponents,
  listGalleryComponentCategories,
  listGalleryComponents,
  listGalleryExamples,
  summarizeSelectedGalleryContext,
  type GalleryComponent,
  type GalleryExample,
  type SelectedGalleryPromptContext,
} from "@/lib/hyperframe-gallery-catalog";
import {
  COMPONENT_FILTER_BUTTON_CLASS,
  COMPONENT_FILTER_ROW_CLASS,
} from "@/lib/main-page-layout";
import { cn } from "@/lib/utils";

export type GalleryTab = "examples" | "components";
export type WorkspaceSurface = "gallery" | "preview";

interface HyperframeGalleryWorkspaceProps {
  surface: WorkspaceSurface;
  onSurfaceChange: (surface: WorkspaceSurface) => void;
  activeGalleryTab: GalleryTab;
  onGalleryTabChange: (tab: GalleryTab) => void;
  activeComponentCategory: string;
  onComponentCategoryChange: (category: string) => void;
  selectedExampleIds: ReadonlyArray<string>;
  selectedComponentIds: ReadonlyArray<string>;
  onToggleExample: (example: GalleryExample) => void;
  onToggleComponent: (component: GalleryComponent) => void;
  promptContext: SelectedGalleryPromptContext;
  hasGeneratedOutput: boolean;
  activeProjectId: string;
  activeProjectTitle: string;
  activeSource: string;
  durationLabel: string;
  playerRef: RefObject<HTMLElement | null>;
}

export function HyperframeGalleryWorkspace({
  surface,
  onSurfaceChange,
  activeGalleryTab,
  onGalleryTabChange,
  activeComponentCategory,
  onComponentCategoryChange,
  selectedExampleIds,
  selectedComponentIds,
  onToggleExample,
  onToggleComponent,
  promptContext,
  hasGeneratedOutput,
  activeProjectId,
  activeProjectTitle,
  activeSource,
  durationLabel,
  playerRef,
}: HyperframeGalleryWorkspaceProps) {
  const examples = useMemo(() => listGalleryExamples(), []);
  const components = useMemo(() => listGalleryComponents(), []);
  const categories = useMemo(() => listGalleryComponentCategories(), []);
  const [detailComponent, setDetailComponent] = useState<GalleryComponent | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const visibleComponents = useMemo(
    () => filterGalleryComponents(components, activeComponentCategory),
    [activeComponentCategory, components],
  );
  const contextSummary = summarizeSelectedGalleryContext(promptContext);

  useEffect(() => {
    setCopyState("idle");
  }, [detailComponent?.id]);

  useEffect(() => {
    if (!detailComponent) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDetailComponent(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailComponent]);

  async function copyComponentText(component: GalleryComponent) {
    try {
      await navigator.clipboard.writeText(component.promptText);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  if (surface === "preview" && hasGeneratedOutput) {
    return (
      <section className="min-w-0 space-y-4 lg:sticky lg:top-24">
        <WorkspaceHeader
          activeProjectId={activeProjectId}
          activeProjectTitle={activeProjectTitle}
          activeSource={activeSource}
          durationLabel={durationLabel}
          mode="preview"
          onSurfaceChange={onSurfaceChange}
          hasGeneratedOutput={hasGeneratedOutput}
        />
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Film className="h-4 w-4" aria-hidden="true" />
              Generated preview
            </div>
            <Badge variant="outline" className="rounded-full px-3">
              1920 x 1080 canvas
            </Badge>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-hairline bg-black shadow-sm">
            <hyperframes-player
              ref={playerRef}
              class="aspect-video w-full overflow-hidden rounded-lg bg-black"
              width="1920"
              height="1080"
              controls
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="secondary" onClick={() => onSurfaceChange("gallery")}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to gallery
            </Button>
            {activeProjectId ? (
              <Button asChild variant="outline">
                <a href={`/projects/${activeProjectId}/studio`}>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open in Studio
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-w-0 space-y-4 lg:sticky lg:top-24">
      <WorkspaceHeader
        activeProjectId={activeProjectId}
        activeProjectTitle={activeProjectTitle}
        activeSource={activeSource}
        durationLabel={durationLabel}
        mode="gallery"
        onSurfaceChange={onSurfaceChange}
        hasGeneratedOutput={hasGeneratedOutput}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Gallery"
            className="grid w-full max-w-sm grid-cols-2 gap-1 rounded-lg bg-surface-card p-1 sm:w-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeGalleryTab === "examples"}
              onClick={() => onGalleryTabChange("examples")}
              className={tabClassName(activeGalleryTab === "examples")}
            >
              Examples
              <span className="text-xs opacity-60">{examples.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeGalleryTab === "components"}
              onClick={() => onGalleryTabChange("components")}
              className={tabClassName(activeGalleryTab === "components")}
            >
              Components
              <span className="text-xs opacity-60">{components.length}</span>
            </button>
          </div>
          {hasGeneratedOutput ? (
            <Button type="button" variant="secondary" onClick={() => onSurfaceChange("preview")}>
              <Eye className="h-4 w-4" aria-hidden="true" />
              Current preview
            </Button>
          ) : null}
        </div>

        {contextSummary !== "No gallery context selected" ? (
          <div className="rounded-lg border border-hairline bg-surface-card px-3 py-2 text-sm text-muted-foreground">
            {contextSummary} selected
          </div>
        ) : null}

        {activeGalleryTab === "components" ? (
          <div className={COMPONENT_FILTER_ROW_CLASS}>
            <button
              type="button"
              onClick={() => onComponentCategoryChange("All")}
              className={filterClassName(activeComponentCategory === "All")}
            >
              All
            </button>
            {categories.map((item) => (
              <button
                key={item.category}
                type="button"
                onClick={() => onComponentCategoryChange(item.category)}
                className={filterClassName(activeComponentCategory === item.category)}
              >
                {item.category}
                <span className="opacity-60">{item.count}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="max-h-[calc(100dvh-13rem)] overflow-y-auto rounded-lg border border-hairline bg-surface-card p-2 sm:p-3">
          {activeGalleryTab === "examples" ? (
            <div className="grid auto-rows-[minmax(15rem,auto)] grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {examples.map((example, index) => (
                <ExampleCard
                  key={example.id}
                  example={example}
                  selected={selectedExampleIds.includes(example.id)}
                  featured={index === 0}
                  onToggle={() => onToggleExample(example)}
                />
              ))}
            </div>
          ) : (
            <div className="grid auto-rows-[minmax(14rem,auto)] grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleComponents.map((component, index) => (
                <ComponentCard
                  key={component.id}
                  component={component}
                  selected={selectedComponentIds.includes(component.id)}
                  featured={index % 11 === 0}
                  onToggle={() => onToggleComponent(component)}
                  onInfo={() => setDetailComponent(component)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {detailComponent ? (
        <ComponentDetailModal
          component={detailComponent}
          selected={selectedComponentIds.includes(detailComponent.id)}
          copyState={copyState}
          onClose={() => setDetailComponent(null)}
          onCopy={() => copyComponentText(detailComponent)}
          onToggle={() => onToggleComponent(detailComponent)}
        />
      ) : null}
    </section>
  );
}

function WorkspaceHeader({
  activeProjectId,
  activeProjectTitle,
  activeSource,
  durationLabel,
  mode,
  onSurfaceChange,
  hasGeneratedOutput,
}: {
  activeProjectId: string;
  activeProjectTitle: string;
  activeSource: string;
  durationLabel: string;
  mode: WorkspaceSurface;
  onSurfaceChange: (surface: WorkspaceSurface) => void;
  hasGeneratedOutput: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {activeProjectTitle || "Workspace"}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="h-8 rounded-full px-3">
            {activeProjectTitle || activeSource}
          </Badge>
          <Badge variant="outline" className="h-8 rounded-full px-3">
            {durationLabel} timeline
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {mode === "preview" ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => onSurfaceChange("gallery")}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Gallery
          </Button>
        ) : hasGeneratedOutput ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => onSurfaceChange("preview")}>
            <Eye className="h-4 w-4" aria-hidden="true" />
            Preview
          </Button>
        ) : null}
        {activeProjectId ? (
          <Button asChild variant="secondary" size="sm">
            <a href={`/projects/${activeProjectId}/studio`}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Studio
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ExampleCard({
  example,
  selected,
  featured,
  onToggle,
}: {
  example: GalleryExample;
  selected: boolean;
  featured: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden rounded-lg border border-hairline bg-background",
        featured && "md:col-span-2",
        selected && "border-foreground",
      )}
    >
      <GalleryMedia media={example.previewMedia} />
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">{example.title}</h2>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {example.description}
          </p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-1">
          <Badge variant="outline">{formatDuration(example.durationSec)}</Badge>
          <Badge variant="outline">
            {example.width} x {example.height}
          </Badge>
          {example.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button type="button" size="sm" variant={selected ? "default" : "secondary"} onClick={onToggle}>
            {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            {selected ? "Selected" : "Use"}
          </Button>
          <Button asChild size="icon" variant="outline" aria-label={`Open ${example.title} source`}>
            <a href={example.sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
}

function ComponentCard({
  component,
  selected,
  featured,
  onToggle,
  onInfo,
}: {
  component: GalleryComponent;
  selected: boolean;
  featured: boolean;
  onToggle: () => void;
  onInfo: () => void;
}) {
  return (
    <article
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden rounded-lg border border-hairline bg-background",
        featured && "xl:row-span-2",
        selected && "border-foreground",
      )}
    >
      <div className="relative">
        <GalleryMedia media={component.previewMedia} tall={featured} />
        <button
          type="button"
          aria-label={`Show ${component.name} details`}
          onClick={onInfo}
          className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-black/70 text-white shadow-sm transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <h2 className="truncate text-sm font-semibold text-foreground">{component.name}</h2>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {component.description}
          </p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-1">
          <Badge variant="outline">{component.category}</Badge>
          {component.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
        <Button type="button" size="sm" variant={selected ? "default" : "secondary"} onClick={onToggle}>
          {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          {selected ? "Selected" : "Use"}
        </Button>
      </div>
    </article>
  );
}

function GalleryMedia({
  media,
  tall = false,
}: {
  media: GalleryExample["previewMedia"] | GalleryComponent["previewMedia"];
  tall?: boolean;
}) {
  const className = cn(
    "w-full bg-black object-cover",
    tall ? "aspect-[4/5]" : "aspect-video",
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

function ComponentDetailModal({
  component,
  selected,
  copyState,
  onClose,
  onCopy,
  onToggle,
}: {
  component: GalleryComponent;
  selected: boolean;
  copyState: "idle" | "copied" | "error";
  onClose: () => void;
  onCopy: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="component-detail-title"
        className="max-h-[min(90dvh,52rem)] w-full max-w-3xl overflow-hidden rounded-lg border border-hairline bg-background shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-hairline p-4">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
              {component.category}
            </div>
            <h2 id="component-detail-title" className="mt-1 truncate text-xl font-semibold text-foreground">
              {component.name}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close component details"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/15"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[calc(min(90dvh,52rem)-5rem)] overflow-y-auto p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <GalleryMedia media={component.previewMedia} />
            <div className="space-y-3">
              <p className="text-sm text-body">{component.detail}</p>
              <div className="flex flex-wrap gap-1">
                {component.tags.slice(0, 8).map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <Button type="button" onClick={onToggle} variant={selected ? "default" : "secondary"}>
                  {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                  {selected ? "Selected" : "Use component"}
                </Button>
                <Button asChild variant="outline">
                  <a href={component.sourceUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Source
                  </a>
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium text-foreground">Prompt text</div>
              <Button type="button" size="sm" variant="secondary" onClick={onCopy}>
                {copyState === "copied" ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {copyState === "copied" ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="rounded-lg border border-hairline bg-surface-card p-3 text-sm text-body">
              {component.promptText}
            </div>
            {component.usageSnippet ? (
              <pre className="max-h-52 overflow-auto rounded-lg bg-surface-dark p-3 text-xs text-on-dark">
                <code>{component.usageSnippet}</code>
              </pre>
            ) : null}
            {copyState === "error" ? (
              <p className="text-sm text-red-700">
                Clipboard access was blocked. The prompt text is still visible.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function tabClassName(active: boolean): string {
  return cn(
    "inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors",
    active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
  );
}

function filterClassName(active: boolean): string {
  return cn(
    COMPONENT_FILTER_BUTTON_CLASS,
    active
      ? "border-foreground bg-foreground text-primary-foreground"
      : "border-hairline bg-background text-muted-foreground hover:text-foreground",
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Number(seconds.toFixed(1))}s`;
  const minutes = seconds / 60;
  return `${Number(minutes.toFixed(1))}m`;
}

export function buildPromptContextFromIds(input: {
  exampleIds: ReadonlyArray<string>;
  componentIds: ReadonlyArray<string>;
}): SelectedGalleryPromptContext {
  const examples = listGalleryExamples()
    .filter((example) => input.exampleIds.includes(example.id))
    .map(createSelectedExampleItem);
  const components = listGalleryComponents()
    .filter((component) => input.componentIds.includes(component.id))
    .map(createSelectedComponentItem);
  return { examples, components };
}
