import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Download,
  Film,
  FolderKanban,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
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
  "A 9 second kinetic product teaser for Motion Frames: crisp editorial typography, a Cloudflare orange accent, a teal render timeline, and one clean camera move.";

function MotionFramesHome() {
  const playerRef = useRef<HTMLElement | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
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
    message: "Bundled composition loaded.",
  });

  const activeSource = generatedHtml ? "Generated HTML" : "Bundled intro";
  const canGenerate = aiEnabled && prompt.trim().length > 0;
  const canRender = !isRendering && !isGenerating;

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

  async function render() {
    if (!canRender) return;
    setIsRendering(true);
    setRenderUrl("");
    setStatus({ tone: "idle", message: "Rendering MP4..." });

    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: generatedHtml || activeProjectId ? { "content-type": "application/json" } : undefined,
        body:
          generatedHtml || activeProjectId
            ? JSON.stringify({
                html: generatedHtml || undefined,
                projectId: activeProjectId || undefined,
              })
            : undefined,
      });
      const data = (await response.json()) as RenderResponse;
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Render failed");
      }

      setRenderUrl(data.url);
      setStatus({
        tone: "success",
        message: `Rendered ${data.source ?? "composition"} in ${formatDuration(data.durationMs)}.`,
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
    setStatus({ tone: "idle", message: "Bundled composition loaded." });
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
      <section className="grid w-full flex-1 grid-cols-1 gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-8">
        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-foreground">
              {activeProjectTitle || "Workspace"}
            </h1>
            <div className="flex items-center gap-2">
              {activeProjectId ? (
                <Button asChild variant="secondary" size="sm">
                  <a href={`/projects/${activeProjectId}/studio`}>
                    <FolderKanban className="h-4 w-4" aria-hidden="true" />
                    Open in Studio
                  </a>
                </Button>
              ) : null}
              <Badge variant="secondary" className="h-8 rounded-full px-3">
                {activeProjectTitle || activeSource}
              </Badge>
            </div>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-hairline bg-neutral-950 p-3 shadow-sm">
            <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-md border border-white/15 bg-black/45 px-2 py-1 text-xs text-white">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              1920 x 1080
            </div>
            <hyperframes-player
              ref={playerRef}
              class="aspect-video w-full max-w-[1180px] overflow-hidden rounded-md bg-black"
              src="/api/preview"
              width="1920"
              height="1080"
              controls
            />
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate</CardTitle>
              <CardDescription>{modelLabel || "OpenRouter"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Prompt</Label>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={9}
                  disabled={!isConfigReady || !aiEnabled}
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
                Generate
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Render</CardTitle>
              <CardDescription>Container to R2</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
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
                Render MP4
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
              {renderUrl ? (
                <Button asChild className="w-full" variant="secondary">
                  <a href={renderUrl} target="_blank" rel="noreferrer">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Download
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <div className={`rounded-lg border p-3 text-sm ${statusClassName}`}>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{status.message}</span>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function formatDuration(durationMs: number | undefined): string {
  if (typeof durationMs !== "number") return "a moment";
  return `${Math.max(1, Math.round(durationMs / 1000))}s`;
}

function messageFromError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
