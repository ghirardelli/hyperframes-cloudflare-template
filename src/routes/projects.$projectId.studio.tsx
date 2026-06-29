import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import type {
  StudioRenderItem,
  StudioRenderOptions,
} from "@/components/studio/StudioEditor";

const StudioEditor = lazy(() => import("@/components/studio/StudioEditor"));

export const Route = createFileRoute("/projects/$projectId/studio")({
  head: () => ({
    links: [{ rel: "stylesheet", href: "/_studio/studio.css" }],
  }),
  component: StudioPage,
});

interface Project {
  id: string;
  title: string;
  prompt?: string | null;
  currentHtml?: string | null;
  durationSec: number;
}

function Loading({ message }: { message: string }) {
  return (
    <div className="grid h-dvh place-items-center bg-neutral-950 text-sm text-neutral-400">
      {message}
    </div>
  );
}

function StudioPage() {
  const { projectId } = Route.useParams();
  const [mounted, setMounted] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [renders, setRenders] = useState<StudioRenderItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    fetchJson<{ project: Project }>(`/api/projects/${projectId}`)
      .then((data) => setProject(data.project))
      .catch((err) => setError(messageFromError(err)));
    fetchJson<{ renders: StudioRenderItem[] }>(`/api/projects/${projectId}/renders`)
      .then((data) => setRenders(data.renders))
      .catch(() => {});
  }, [projectId]);

  if (!mounted) return <Loading message="Loading Studio…" />;
  if (error) return <Loading message={error} />;
  if (!project) return <Loading message="Loading project…" />;

  async function save(html: string) {
    await fetchJson(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ html }),
    });
  }

  async function render(opts: StudioRenderOptions): Promise<StudioRenderItem> {
    const data = await fetchJson<{ url: string; key: string }>(`/api/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        html: opts.html,
        width: opts.width,
        height: opts.height,
        durationSec: opts.durationSec,
        format: opts.format,
      }),
    });
    return {
      id: data.key,
      url: data.url,
      format: opts.format,
      createdAt: new Date().toISOString(),
    };
  }

  async function publish(html: string) {
    await save(html);
    await fetchJson(`/api/projects/${projectId}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: project?.title || "Published project",
        description: project?.prompt || "Published from Motion Frames Studio.",
      }),
    });
  }

  return (
    <Suspense fallback={<Loading message="Loading Studio…" />}>
      <StudioEditor
        projectId={projectId}
        title={project.title || "Project"}
        initialHtml={project.currentHtml || ""}
        renders={renders}
        onSave={save}
        onRender={render}
        onPublish={publish}
      />
    </Suspense>
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
