import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Edit3,
  ExternalLink,
  Film,
  FolderOpen,
  Loader2,
  Play,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  buildProjectLibraryItems,
  type ProjectLibraryProject,
  type ProjectLibraryRender,
} from "@/lib/my-projects-gallery";
import {
  PROJECTS_PAGE_MAIN_CLASS,
  PROJECTS_PAGE_SHELL_CLASS,
  PROJECTS_PRIMARY_ACTION_CLASS,
} from "@/lib/projects-page-layout";

export const Route = createFileRoute("/projects/")({
  component: ProjectsPage,
});

type Project = ProjectLibraryProject & {
  prompt?: string | null;
  visibility?: string | null;
  status?: string | null;
};

interface ProjectRendersResponse {
  renders: Array<ProjectLibraryRender>;
}

function ProjectsPage() {
  const [projects, setProjects] = useState<Array<Project>>([]);
  const [rendersByProject, setRendersByProject] = useState<
    Record<string, Array<ProjectLibraryRender>>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [savingId, setSavingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deletingId, setDeletingId] = useState("");
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setLoadError("");
        const data = await fetchJson<{ projects: Array<Project> }>("/api/projects");
        if (cancelled) return;
        setProjects(data.projects);
        const renderPairs = await Promise.all(
          data.projects.map(async (project) => {
            try {
              const renders = await fetchJson<ProjectRendersResponse>(
                `/api/projects/${encodeURIComponent(project.id)}/renders`,
              );
              return [project.id, renders.renders.slice(0, 1)] as const;
            } catch {
              return [project.id, []] as const;
            }
          }),
        );
        if (!cancelled) setRendersByProject(Object.fromEntries(renderPairs));
      } catch (err) {
        if (!cancelled) setLoadError(messageFromError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(
    () => buildProjectLibraryItems(projects, rendersByProject),
    [projects, rendersByProject],
  );

  function beginEdit(project: Project) {
    setEditingId(project.id);
    setDraftTitle(project.title?.trim() || "Untitled project");
    setDraftDescription(project.description?.trim() || "");
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>, projectId: string) {
    event.preventDefault();
    try {
      setSavingId(projectId);
      const data = await fetchJson<{ project: Project }>(
        `/api/projects/${encodeURIComponent(projectId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: draftTitle,
            description: draftDescription,
          }),
        },
      );
      setProjects((current) =>
        current.map((project) => (project.id === projectId ? data.project : project)),
      );
      setEditingId("");
      toast.success("Project updated.");
    } catch (err) {
      toast.error(messageFromError(err));
    } finally {
      setSavingId("");
    }
  }

  function beginDelete(project: Project) {
    setDeleteTarget(project);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setDeletingId(deleteTarget.id);
      await fetchJson<{ ok: true }>(`/api/projects/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });
      setProjects((current) => current.filter((project) => project.id !== deleteTarget.id));
      setRendersByProject((current) => {
        const next = { ...current };
        delete next[deleteTarget.id];
        return next;
      });
      setEditingId((current) => (current === deleteTarget.id ? "" : current));
      setDeleteTarget(null);
      toast.success("Project deleted.");
    } catch (err) {
      toast.error(messageFromError(err));
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className={PROJECTS_PAGE_SHELL_CLASS}>
      <AppHeader active="projects" />
      <main className={PROJECTS_PAGE_MAIN_CLASS}>
        <div className="flex w-full flex-col gap-6">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Library</p>
              <h1 className="mt-1 text-3xl font-semibold text-foreground">My Projects</h1>
            </div>
            <Button asChild className={PROJECTS_PRIMARY_ACTION_CLASS}>
              <Link to="/">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                New HyperFrame
              </Link>
            </Button>
          </header>

          {loading ? (
            <section className="grid min-h-[28rem] place-items-center rounded-lg border border-hairline bg-surface-card">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading projects
              </div>
            </section>
          ) : loadError ? (
            <section className="grid min-h-[28rem] place-items-center rounded-lg border border-hairline bg-surface-card px-4 text-center">
              <div className="max-w-xl">
                <AlertCircle className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
                <h2 className="mt-4 text-2xl font-semibold">Unable to load projects</h2>
                <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
                  {loadError}
                </p>
                <Button type="button" className="mt-5" onClick={() => window.location.reload()}>
                  Try again
                </Button>
              </div>
            </section>
          ) : items.length ? (
            <section className="grid auto-rows-[minmax(22rem,auto)] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[1800px]:grid-cols-5">
              {items.map((item) => {
                const project = projects.find((current) => current.id === item.id);
                const editing = editingId === item.id;
                return (
                  <article key={item.id} className={item.tileClassName}>
                    <div className="flex h-full min-h-[22rem] flex-col">
                      <div className="relative aspect-video overflow-hidden bg-surface-dark">
                        {item.latestRender?.url ? (
                          <video
                            className="h-full w-full object-cover"
                            src={item.latestRender.url}
                            controls
                            preload="metadata"
                          />
                        ) : (
                          <div className="grid h-full place-items-center text-on-dark">
                            <Film className="h-10 w-10 opacity-70" aria-hidden="true" />
                          </div>
                        )}
                        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="bg-white/90 text-foreground">
                            {item.durationLabel}
                          </Badge>
                          {item.latestRender?.format ? (
                            <Badge variant="secondary" className="bg-white/90 text-foreground">
                              {item.latestRender.format}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col gap-4 p-4">
                        {editing && project ? (
                          <form
                            className="space-y-3"
                            onSubmit={(event) => saveMetadata(event, item.id)}
                          >
                            <div className="space-y-2">
                              <Label htmlFor={`project-title-${item.id}`}>Name</Label>
                              <Input
                                id={`project-title-${item.id}`}
                                value={draftTitle}
                                onChange={(event) => setDraftTitle(event.target.value)}
                                disabled={savingId === item.id}
                                maxLength={120}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`project-description-${item.id}`}>Description</Label>
                              <Textarea
                                id={`project-description-${item.id}`}
                                value={draftDescription}
                                onChange={(event) => setDraftDescription(event.target.value)}
                                disabled={savingId === item.id}
                                maxLength={260}
                                rows={3}
                                className="min-h-24"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Button type="submit" size="sm" disabled={savingId === item.id}>
                                {savingId === item.id ? (
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
                                onClick={() => setEditingId("")}
                                disabled={savingId === item.id}
                              >
                                <X className="h-4 w-4" aria-hidden="true" />
                                Cancel
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <h2 className="line-clamp-2 text-xl font-semibold text-foreground">
                                  {item.title}
                                </h2>
                                {project ? (
                                  <div className="flex shrink-0 items-center gap-1">
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      aria-label={`Edit ${item.title}`}
                                      onClick={() => beginEdit(project)}
                                      disabled={deletingId === item.id}
                                    >
                                      <Edit3 className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      aria-label={`Delete ${item.title}`}
                                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                      onClick={() => beginDelete(project)}
                                      disabled={deletingId === item.id}
                                    >
                                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                              <p className="mt-2 line-clamp-3 min-h-16 text-sm leading-6 text-muted-foreground">
                                {item.description || "No description yet."}
                              </p>
                            </div>
                            <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline">{item.updatedLabel}</Badge>
                              {project?.visibility ? (
                                <Badge variant="outline">{project.visibility}</Badge>
                              ) : null}
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Button asChild size="sm" className={PROJECTS_PRIMARY_ACTION_CLASS}>
                                <Link
                                  to="/projects/$projectId/studio"
                                  params={{ projectId: item.id }}
                                >
                                  <FolderOpen className="h-4 w-4" aria-hidden="true" />
                                  Open Studio
                                </Link>
                              </Button>
                              {item.latestRender?.url ? (
                                <Button asChild size="sm" variant="outline">
                                  <a href={item.latestRender.url} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                    Open Render
                                  </a>
                                </Button>
                              ) : (
                                <Button asChild size="sm" variant="outline">
                                  <Link
                                    to="/projects/$projectId/studio"
                                    params={{ projectId: item.id }}
                                  >
                                    <Play className="h-4 w-4" aria-hidden="true" />
                                    Render
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <section className="grid min-h-[28rem] place-items-center rounded-lg border border-dashed border-hairline bg-surface-card px-4 text-center">
              <div className="max-w-sm">
                <Film className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
                <h2 className="mt-4 text-2xl font-semibold">No projects yet</h2>
                <Button asChild className={`mt-5 ${PROJECTS_PRIMARY_ACTION_CLASS}`}>
                  <Link to="/">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Create HyperFrame
                  </Link>
                </Button>
              </div>
            </section>
          )}
        </div>
      </main>

      {deleteTarget ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 px-4 py-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            className="w-full max-w-lg rounded-lg border border-hairline bg-background p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 id="delete-project-title" className="text-xl font-semibold">
                  Delete {deleteTarget.title?.trim() || "Untitled project"}?
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  This action is irreversible and permanent. It will delete all information about this
                  project in the database and any stored files or folders in R2 storage, Bunny.net
                  Storage, and Bunny Stream.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingId === deleteTarget.id}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => void confirmDelete()}
                disabled={deletingId === deleteTarget.id}
              >
                {deletingId === deleteTarget.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                Delete permanently
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
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
