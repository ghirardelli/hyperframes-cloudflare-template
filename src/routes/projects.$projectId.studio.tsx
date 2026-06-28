import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Play, Save, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/projects/$projectId/studio")({
  component: StudioPage,
});

interface Project {
  id: string;
  title: string;
  prompt?: string | null;
  currentHtml?: string | null;
  durationSec: number;
}

function StudioPage() {
  const { projectId } = Route.useParams();
  const playerRef = useRef<HTMLElement | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [html, setHtml] = useState("");
  const [status, setStatus] = useState("");
  const [renderUrl, setRenderUrl] = useState("");

  useEffect(() => {
    fetchJson<{ project: Project }>(`/api/projects/${projectId}`)
      .then((data) => {
        setProject(data.project);
        setHtml(data.project.currentHtml || "");
      })
      .catch((err) => setStatus(messageFromError(err)));
  }, [projectId]);

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
    if (html) {
      player.removeAttribute("src");
      player.setAttribute("srcdoc", html);
    }
  }, [html]);

  async function save() {
    const data = await fetchJson<{ project: Project }>(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ html }),
    });
    setProject(data.project);
    setStatus("Project saved.");
  }

  async function render() {
    const data = await fetchJson<{ url: string }>(`/api/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId, html }),
    });
    setRenderUrl(data.url);
    setStatus("Render complete.");
  }

  async function publish() {
    await save();
    await fetchJson(`/api/projects/${projectId}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: project?.title || "Published project",
        description: project?.prompt || "Published from Motion Frames Studio.",
      }),
    });
    setStatus("Published to organization playground.");
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-4 py-4 text-[#1d1d1f] sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex flex-col gap-4">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
            <div>
              <p className="text-sm text-[#0066cc]">Studio</p>
              <h1 className="text-3xl font-semibold">{project?.title || "Project"}</h1>
            </div>
            <nav className="flex gap-2">
              <Button asChild variant="secondary" size="sm">
                <a href="/">Workspace</a>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href="/playground">Playground</a>
              </Button>
            </nav>
          </header>

          <div className="relative flex flex-1 items-center justify-center rounded-[18px] bg-[#252527] p-3">
            {html ? (
              <hyperframes-player
                ref={playerRef}
                class="aspect-video w-full max-w-[1100px] overflow-hidden rounded-[12px] bg-black"
                srcdoc={html}
                width="1920"
                height="1080"
                controls
              />
            ) : (
              <p className="text-white/60">Generate or paste composition HTML to preview.</p>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4 rounded-[18px] border border-stone-200 bg-white p-5">
          <div>
            <p className="text-sm text-stone-500">Source</p>
            <h2 className="mt-1 text-xl font-semibold">Composition HTML</h2>
          </div>
          <Textarea
            className="min-h-[420px] flex-1 rounded-[12px] font-mono text-xs"
            value={html}
            onChange={(event) => setHtml(event.target.value)}
            placeholder="Paste or edit generated HyperFrames HTML..."
          />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" onClick={() => void save()}>
              <Save className="h-4 w-4" />
              Save
            </Button>
            <Button type="button" onClick={() => void render()} disabled={!html}>
              <Play className="h-4 w-4" />
              Render
            </Button>
            <Button type="button" variant="outline" onClick={() => void publish()} disabled={!html}>
              <Upload className="h-4 w-4" />
              Publish
            </Button>
            {renderUrl ? (
              <Button asChild variant="secondary">
                <a href={renderUrl} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" />
                  MP4
                </a>
              </Button>
            ) : null}
          </div>
          {status ? <p className="text-sm text-stone-600">{status}</p> : null}
        </aside>
      </div>
    </main>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (response.status === 401) window.location.assign("/login");
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function messageFromError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
