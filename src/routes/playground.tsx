import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Play } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/playground")({
  component: PlaygroundPage,
});

interface CatalogItem {
  id: string;
  title: string;
  description?: string | null;
  durationSec?: number;
  width?: number;
  height?: number;
  projectId?: string;
}

function PlaygroundPage() {
  const [catalogCount, setCatalogCount] = useState(0);
  const [examples, setExamples] = useState<Array<CatalogItem>>([]);
  const [publishedProjects, setPublishedProjects] = useState<Array<CatalogItem>>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchJson<{
      catalogCount: number;
      examples: Array<CatalogItem>;
      publishedProjects: Array<CatalogItem>;
    }>("/api/catalog")
      .then((data) => {
        setCatalogCount(data.catalogCount);
        setExamples(data.examples);
        setPublishedProjects(data.publishedProjects);
      })
      .catch((err) => setStatus(messageFromError(err)));
  }, []);

  async function remix(id: string) {
    try {
      const data = await fetchJson<{ project: { id: string } }>(`/api/published/${id}/remix`, {
        method: "POST",
      });
      window.location.assign(`/projects/${data.project.id}/studio`);
    } catch (err) {
      setStatus(messageFromError(err));
    }
  }

  const items = [...examples, ...publishedProjects];

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-[#1d1d1f]">
      <div className="mx-auto max-w-6xl space-y-10">
        <nav className="flex flex-wrap gap-2 text-sm">
          <Button asChild variant="secondary" size="sm">
            <a href="/">Workspace</a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href="/profile">Profile</a>
          </Button>
        </nav>

        <header className="border-b border-stone-200 pb-8">
          <p className="text-sm text-[#0066cc]">Organization Playground</p>
          <h1 className="mt-2 text-5xl font-semibold">Examples Catalog {catalogCount}</h1>
          <p className="mt-4 max-w-2xl text-[21px] leading-[1.47] text-stone-600">
            Published projects and starter examples stay inside your organization.
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-[18px] border border-stone-200 bg-[#f5f5f7] p-5">
              <div className="mb-5 aspect-video rounded-[12px] bg-[#252527]" />
              <p className="text-sm text-stone-500">
                {item.durationSec ?? 6}s · {item.width ?? 1920}×{item.height ?? 1080}
              </p>
              <h2 className="mt-2 text-2xl font-semibold">{item.title}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-stone-600">
                {item.description || "Organization-visible Motion Frames project."}
              </p>
              <div className="mt-5 flex gap-2">
                {item.projectId ? (
                  <Button asChild size="sm">
                    <a href={`/projects/${item.projectId}/studio`}>
                      <Play className="h-4 w-4" />
                      Open
                    </a>
                  </Button>
                ) : null}
                {item.projectId ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => void remix(item.id)}>
                    <Copy className="h-4 w-4" />
                    Remix
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
        {status ? <p className="text-sm text-stone-600">{status}</p> : null}
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
