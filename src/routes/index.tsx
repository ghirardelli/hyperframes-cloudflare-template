import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Download,
  Film,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";

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

const DEFAULT_PROMPT =
  "A 9 second kinetic product teaser for Motion Frames: crisp editorial typography, a Cloudflare orange accent, a teal render timeline, and one clean camera move.";

function MotionFramesHome() {
  const playerRef = useRef<HTMLElement | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [modelLabel, setModelLabel] = useState("");
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
    return "border-stone-200 bg-white text-stone-700";
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
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = (await response.json()) as GenerateResponse;
      if (!response.ok || !data.html) {
        throw new Error(data.error ?? "Generation failed");
      }

      setGeneratedHtml(data.html);
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
        headers: generatedHtml ? { "content-type": "application/json" } : undefined,
        body: generatedHtml ? JSON.stringify({ html: generatedHtml }) : undefined,
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
    setStatus({ tone: "idle", message: "Bundled composition loaded." });
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-950">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="flex min-h-[calc(100vh-2rem)] flex-col gap-4">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-orange-700">
                <Film className="h-4 w-4" aria-hidden="true" />
                Cloudflare render studio
              </div>
              <h1 className="mt-2 text-4xl font-semibold text-stone-950 sm:text-5xl">
                Motion Frames
              </h1>
            </div>
            <Badge variant="secondary" className="h-8 rounded-md border-stone-300 bg-white px-3">
              {activeSource}
            </Badge>
          </header>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-neutral-950 p-3 shadow-sm">
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

        <aside className="flex min-h-[calc(100vh-2rem)] flex-col gap-4">
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
    </main>
  );
}

function formatDuration(durationMs: number | undefined): string {
  if (typeof durationMs !== "number") return "a moment";
  return `${Math.max(1, Math.round(durationMs / 1000))}s`;
}

function messageFromError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
