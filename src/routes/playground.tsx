import { createFileRoute } from "@tanstack/react-router";
import { Copy, Play } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { messageFromError } from "@/lib/api-client";
import { useCatalogQuery, useRemixPublishedProjectMutation } from "@/lib/app-queries";

export const Route = createFileRoute("/playground")({
  component: PlaygroundPage,
});

function PlaygroundPage() {
  const catalogQuery = useCatalogQuery();
  const remixMutation = useRemixPublishedProjectMutation();
  const catalogCount = catalogQuery.data?.catalogCount ?? 0;
  const examples = catalogQuery.data?.examples ?? [];
  const publishedProjects = catalogQuery.data?.publishedProjects ?? [];
  const toast = useToast();

  async function remix(id: string) {
    try {
      const data = await remixMutation.mutateAsync(id);
      window.location.assign(`/projects/${data.project.id}/studio`);
    } catch (err) {
      toast.error(messageFromError(err));
    }
  }

  const items = [...examples, ...publishedProjects];

  return (
    <div className="flex min-h-dvh flex-col bg-white text-foreground">
      <AppHeader active="playground" />
      <main className="w-full space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <header className="border-b border-hairline pb-8">
          <p className="text-sm text-muted-foreground">Organization Playground</p>
          <h1 className="mt-2 text-5xl font-semibold">Examples Catalog {catalogCount}</h1>
          <p className="mt-4 max-w-2xl text-[21px] leading-[1.47] text-muted-foreground">
            Published projects and starter examples stay inside your organization.
          </p>
        </header>

        {catalogQuery.isError ? (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
            {messageFromError(catalogQuery.error)}
          </div>
        ) : null}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((item) => (
            <article key={item.id} className="rounded-[18px] border border-hairline bg-background p-5">
              <div className="mb-5 aspect-video rounded-lg bg-surface-card" />
              <p className="text-sm text-muted-foreground">
                {item.durationSec ?? 6}s · {item.width ?? 1920}×{item.height ?? 1080}
              </p>
              <h2 className="mt-2 text-2xl font-semibold">{item.title}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void remix(item.id)}
                    disabled={remixMutation.isPending}
                  >
                    <Copy className="h-4 w-4" />
                    Remix
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
