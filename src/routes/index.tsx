import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bot,
  CheckCircle2,
  Clock3,
  Download,
  Film,
  FolderKanban,
  Info,
  Loader2,
  MonitorPlay,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { PromptAgentPanel } from "@/components/prompt-agent-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildRenderRequestBody,
  DEFAULT_CREATION_MODE,
  DEFAULT_DURATION_SEC,
  DEFAULT_RENDER_FORMAT,
  DEFAULT_RENDER_RESOLUTION_ID,
  DURATION_PRESETS,
  EXPORT_RESOLUTION_PRESETS,
  getExportResolutionPreset,
  normalizeDurationSec,
  readStoredCreationMode,
  renderFormatLabel,
  RENDER_FORMATS,
  resolveCreationMode,
  resolveCreationTab,
  writeStoredCreationMode,
  type CreationMode,
  type CreationTab,
  type ExportResolutionId,
  type RenderFormat,
} from "@/lib/main-page-creation-flow";
import type { GenerateHyperframeOutput } from "@/lib/prompt-agent-contract";

export const Route = createFileRoute("/")({
  component: MotionFramesHome,
});

type StatusTone = "idle" | "success" | "error";

interface ConfigResponse {
  aiGenEnabled: boolean;
  modelLabel: string;
}

interface GenerateResponse {
  html?: string;
  project?: { id: string; title: string };
  model?: string;
  attempts?: number;
  durationMs?: number;
  lintOk?: boolean;
  lintErrors?: Array<string>;
  error?: string;
}

interface RenderResponse {
  url?: string;
  durationMs?: number;
  source?: "bundled" | "html";
  error?: string;
}

interface MeResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role?: string | null;
  };
  organization: {
    id: string;
    name: string;
  };
}

const DEFAULT_PROMPT =
  "A 6 second kinetic product teaser for Motion Frames: crisp editorial typography, a Cloudflare orange accent, a teal render timeline, and one clean camera move.";

function MotionFramesHome() {
  const playerRef = useRef<HTMLElement | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [, setCreationModeState] = useState<CreationMode>(
    () => readStoredCreationMode() ?? DEFAULT_CREATION_MODE,
  );
  const [activeCreationTab, setActiveCreationTab] = useState<CreationTab>(
    () => readStoredCreationMode() ?? DEFAULT_CREATION_MODE,
  );
  const [durationSec, setDurationSecState] = useState(DEFAULT_DURATION_SEC);
  const [exportResolutionId, setExportResolutionId] = useState<ExportResolutionId>(
    DEFAULT_RENDER_RESOLUTION_ID,
  );
  const [renderFormat, setRenderFormat] = useState<RenderFormat>(DEFAULT_RENDER_FORMAT);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [modelLabel, setModelLabel] = useState("");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [activeProjectTitle, setActiveProjectTitle] = useState("");
  const [isConfigReady, setIsConfigReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderUrl, setRenderUrl] = useState("");
  const [status, setStatus] = useState<{ tone: StatusTone; message: string }>({
    tone: "idle",
    message: "",
  });

  const activeSource = generatedHtml ? "Generated HTML" : "Bundled intro";
  const canGenerate = aiEnabled && prompt.trim().length > 0;
  const canRender = !isRendering && !isGenerating;
  const canUseAgentTab = isConfigReady && aiEnabled;
  const visibleCreationTab =
    activeCreationTab === "agent" && !canUseAgentTab
      ? "manual"
      : resolveCreationTab(activeCreationTab, canUseAgentTab);
  const exportResolution = getExportResolutionPreset(exportResolutionId);
  const renderFormatName = renderFormatLabel(renderFormat);
  const durationOptions = useMemo(
    () => Array.from(new Set([...DURATION_PRESETS, durationSec])).sort((a, b) => a - b),
    [durationSec],
  );

  useEffect(() => {
    fetch("/api/me")
      .then((res) => {
        if (res.status === 401) {
          window.location.assign("/login");
          return null;
        }
        if (!res.ok) throw new Error("Unable to load profile");
        return res.json() as Promise<MeResponse>;
      })
      .then((data) => {
        if (data) setMe(data);
      })
      .catch(() => {
        window.location.assign("/login");
      });
  }, []);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json() as Promise<ConfigResponse>)
      .then((config) => {
        setAiEnabled(config.aiGenEnabled);
        setModelLabel(config.modelLabel);
      })
      .catch(() => setAiEnabled(false))
      .finally(() => setIsConfigReady(true));
  }, []);

  useEffect(() => {
    if (!isConfigReady) return;
    setCreationModeState((current) => {
      const next = resolveCreationMode(readStoredCreationMode() ?? current, aiEnabled);
      setActiveCreationTab((tab) => (tab === "render" ? tab : next));
      return next;
    });
  }, [aiEnabled, isConfigReady]);

  useEffect(() => {
    if (customElements.get("hyperframes-player")) return;
    const script = document.createElement("script");
    script.src = "/_hyperframes/player.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (generatedHtml) {
      player.removeAttribute("src");
      player.setAttribute("srcdoc", generatedHtml);
      return;
    }

    player.removeAttribute("srcdoc");
    player.setAttribute("src", "/api/preview");
  }, [generatedHtml]);

  const statusClassName = useMemo(() => {
    if (status.tone === "success") return "border-emerald-400/70 bg-emerald-50 text-emerald-900";
    if (status.tone === "error") return "border-red-300 bg-red-50 text-red-900";
    return "border-hairline bg-white text-body";
  }, [status.tone]);

  function selectCreationTab(tab: CreationTab) {
    if (tab === "agent" && !canUseAgentTab) return;
    setActiveCreationTab(tab);
    if (tab === "render") return;
    setCreationModeState(tab);
    writeStoredCreationMode(tab);
  }

  const setDurationSec = useCallback((value: unknown) => {
    setDurationSecState(normalizeDurationSec(value));
  }, []);

  async function generate() {
    if (!canGenerate) return;
    setIsGenerating(true);
    setRenderUrl("");
    setStatus({ tone: "idle", message: "Generating composition..." });

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          durationSec,
          projectId: activeProjectId || undefined,
        }),
      });
      const data = (await response.json()) as GenerateResponse;
      if (!response.ok || !data.html) {
        throw new Error(data.error ?? "Generation failed");
      }

      setGeneratedHtml(data.html);
      if (data.project?.id) {
        setActiveProjectId(data.project.id);
        setActiveProjectTitle(data.project.title);
      }
      setStatus({
        tone: data.lintOk ? "success" : "idle",
        message: `Generated with ${data.model ?? "selected model"} in ${data.attempts ?? 1} attempt(s).`,
      });
    } catch (err) {
      setStatus({ tone: "error", message: messageFromError(err) });
    } finally {
      setIsGenerating(false);
    }
  }

  function applyAgentGeneration(data: GenerateHyperframeOutput) {
    setGeneratedHtml(data.html);
    setRenderUrl("");
    if (data.project?.id) {
      setActiveProjectId(data.project.id);
      setActiveProjectTitle(data.project.title);
    }
    setStatus({
      tone: data.lintOk ? "success" : "idle",
      message: `Generated with ${data.model} in ${data.attempts} attempt(s).`,
    });
  }

  async function render() {
    if (!canRender) return;
    setIsRendering(true);
    setRenderUrl("");
    setStatus({ tone: "idle", message: `Rendering ${renderFormatName}...` });

    try {
      const body = buildRenderRequestBody({
        html: generatedHtml,
        projectId: activeProjectId,
        resolutionId: exportResolutionId,
        format: renderFormat,
      });
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as RenderResponse;
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Render failed");
      }

      setRenderUrl(data.url);
      setStatus({
        tone: "success",
        message: `Rendered ${data.source ?? "composition"} as ${renderFormatName} in ${formatDuration(data.durationMs)}.`,
      });
    } catch (err) {
      setStatus({ tone: "error", message: messageFromError(err) });
    } finally {
      setIsRendering(false);
    }
  }

  function resetComposition() {
    setGeneratedHtml("");
    setRenderUrl("");
    setActiveProjectId("");
    setActiveProjectTitle("");
    setStatus({ tone: "idle", message: "" });
  }

  if (!me) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-6 text-foreground">
        <div className="text-center">
          <Film className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 text-lg font-medium">Opening Motion Frames...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <AppHeader active="workspace" />
      <section className="grid w-full flex-1 grid-cols-1 items-start gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(360px,0.95fr)_minmax(420px,1fr)] lg:px-8 xl:grid-cols-[minmax(420px,0.9fr)_minmax(460px,1fr)]">
        <div className="space-y-4 lg:sticky lg:top-24">
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
                  {formatDurationOption(durationSec)} timeline
                </Badge>
              </div>
            </div>
            {activeProjectId ? (
              <Button asChild variant="secondary" size="sm">
                <a href={`/projects/${activeProjectId}/studio`}>
                  <FolderKanban className="h-4 w-4" aria-hidden="true" />
                  Open in Studio
                </a>
              </Button>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MonitorPlay className="h-4 w-4" aria-hidden="true" />
                Preview
              </div>
              <Badge variant="outline" className="rounded-full px-3">
                1920 x 1080 canvas
              </Badge>
            </div>
            <div className="relative overflow-hidden rounded-md border border-hairline bg-background shadow-sm">
              <hyperframes-player
                ref={playerRef}
                class="aspect-video w-full overflow-hidden rounded-md bg-black"
                src="/api/preview"
                width="1920"
                height="1080"
                controls
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Preview stays fixed to the composition aspect ratio while you refine prompts or render exports.
            </p>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card className="overflow-visible">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Create HyperFrame
                  </CardTitle>
                  <CardDescription>{modelLabel || "OpenRouter"}</CardDescription>
                </div>
                <div className="group relative">
                  <button
                    type="button"
                    aria-describedby="prompting-guidance"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-background text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/15"
                  >
                    <Info className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Prompting guidance</span>
                  </button>
                  <div
                    id="prompting-guidance"
                    role="tooltip"
                    className="pointer-events-none absolute right-0 top-11 z-20 hidden w-[min(22rem,calc(100vw-2rem))] rounded-md border border-hairline bg-white p-3 text-sm text-body shadow-lg group-hover:block group-focus-within:block"
                  >
                    Include the subject, mood, pacing, brand cues, camera movement, duration, and final beat. Strong prompts describe build, breathe, and resolve moments.
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                role="tablist"
                aria-label="Creation mode"
                className="grid grid-cols-3 gap-1 rounded-md bg-surface-card p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={visibleCreationTab === "agent"}
                  disabled={!canUseAgentTab}
                  onClick={() => selectCreationTab("agent")}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    visibleCreationTab === "agent"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Bot className="h-4 w-4" aria-hidden="true" />
                  AI Agent
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={visibleCreationTab === "manual"}
                  onClick={() => selectCreationTab("manual")}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
                    visibleCreationTab === "manual"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Manual Prompt
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={visibleCreationTab === "render"}
                  onClick={() => selectCreationTab("render")}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
                    visibleCreationTab === "render"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Render
                </button>
              </div>

              {visibleCreationTab !== "render" ? (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration</Label>
                    <div className="relative">
                      <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <select
                        id="duration"
                        value={durationSec}
                        onChange={(event) => setDurationSec(event.target.value)}
                        disabled={isGenerating || isRendering}
                        className="h-10 w-full appearance-none rounded-md border border-input bg-background px-9 py-2 text-sm font-medium outline-none transition-colors focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {durationOptions.map((seconds) => (
                          <option key={seconds} value={seconds}>
                            {formatDurationOption(seconds)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="rounded-md border border-hairline bg-surface-card px-3 py-2 text-sm text-muted-foreground">
                    Duration is used before generation so the motion timing and final beat fit the timeline.
                  </div>
                </div>
              ) : null}

              {visibleCreationTab === "agent" ? (
                <PromptAgentPanel
                  prompt={prompt}
                  onPromptChange={setPrompt}
                  durationSec={durationSec}
                  onDurationChange={setDurationSec}
                  aiEnabled={aiEnabled}
                  isConfigReady={isConfigReady}
                  modelLabel={modelLabel}
                  activeProjectId={activeProjectId}
                  activeProjectTitle={activeProjectTitle}
                  isGenerating={isGenerating}
                  isRendering={isRendering}
                  onGenerated={applyAgentGeneration}
                />
              ) : null}

              {visibleCreationTab === "manual" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="prompt">Final generation prompt</Label>
                    <Textarea
                      id="prompt"
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      rows={9}
                      disabled={!isConfigReady || isGenerating || isRendering}
                    />
                  </div>

                  <Button
                    type="button"
                    className="w-full"
                    onClick={generate}
                    disabled={!canGenerate || isGenerating || isRendering}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                    )}
                    Generate Preview
                  </Button>
                </div>
              ) : null}

              {visibleCreationTab === "render" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="export-resolution">Resolution</Label>
                      <select
                        id="export-resolution"
                        value={exportResolutionId}
                        onChange={(event) => setExportResolutionId(event.target.value as ExportResolutionId)}
                        disabled={isRendering}
                        className="h-10 w-full rounded-md border border-input bg-background px-3.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {EXPORT_RESOLUTION_PRESETS.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="export-format">Format</Label>
                      <select
                        id="export-format"
                        value={renderFormat}
                        onChange={(event) => setRenderFormat(event.target.value as RenderFormat)}
                        disabled={isRendering}
                        className="h-10 w-full rounded-md border border-input bg-background px-3.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {RENDER_FORMATS.map((format) => (
                          <option key={format.value} value={format.value}>
                            {format.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="rounded-md bg-surface-card px-3 py-2 text-sm text-muted-foreground">
                    Render exports the current preview at {exportResolution.width} x {exportResolution.height} as {renderFormatName}. The generated timeline remains {formatDurationOption(durationSec)}.
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      className="w-full"
                      variant="default"
                      onClick={render}
                      disabled={!canRender}
                    >
                      {isRendering ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Play className="h-4 w-4" aria-hidden="true" />
                      )}
                      Render {renderFormatName}
                    </Button>
                    <Button
                      type="button"
                      className="w-full"
                      variant="outline"
                      onClick={resetComposition}
                      disabled={!generatedHtml || isRendering}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Reset
                    </Button>
                  </div>
                  {renderUrl ? (
                    <Button asChild className="w-full" variant="secondary">
                      <a href={renderUrl} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Download {renderFormatName}
                      </a>
                    </Button>
                  ) : null}
                  <div className="rounded-md border border-hairline bg-surface-card px-3 py-2 text-xs text-muted-foreground">
                    Selected export: {exportResolution.width} x {exportResolution.height} {renderFormatName}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {status.message ? (
            <div className={`rounded-lg border p-3 text-sm ${statusClassName}`}>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{status.message}</span>
              </div>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}

function formatDuration(durationMs: number | undefined): string {
  if (typeof durationMs !== "number") return "a moment";
  return `${Math.max(1, Math.round(durationMs / 1000))}s`;
}

function formatDurationOption(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = seconds / 60;
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function messageFromError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
