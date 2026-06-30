export interface ProjectLibraryProject {
  id: string;
  title?: string | null;
  description?: string | null;
  durationSec?: number | null;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
}

export interface ProjectLibraryRender {
  id: string;
  url: string;
  format?: string | null;
  streamStatus?: string | null;
  createdAt?: string | Date | null;
}

export interface ProjectLibraryItem {
  id: string;
  title: string;
  description: string | null;
  durationLabel: string;
  updatedLabel: string;
  studioUrl: string;
  latestRender: ProjectLibraryRender | null;
  tileClassName: string;
}

export function buildProjectLibraryItems(
  projects: ReadonlyArray<ProjectLibraryProject>,
  rendersByProject: Record<string, ReadonlyArray<ProjectLibraryRender>> = {},
): Array<ProjectLibraryItem> {
  return projects.map((project, index) => ({
    id: project.id,
    title: project.title?.trim() || "Untitled project",
    description: project.description?.trim() || null,
    durationLabel: formatProjectDuration(project.durationSec),
    updatedLabel: formatProjectDate(project.updatedAt ?? project.createdAt),
    studioUrl: `/projects/${encodeURIComponent(project.id)}/studio`,
    latestRender: rendersByProject[project.id]?.[0] ?? null,
    tileClassName: getProjectTileClassName(index),
  }));
}

export function formatProjectDuration(seconds: number | null | undefined): string {
  const normalized = typeof seconds === "number" && Number.isFinite(seconds) ? seconds : 6;
  if (normalized < 60) return `${Math.max(1, Math.round(normalized))}s`;
  const minutes = normalized / 60;
  return `${Number(minutes.toFixed(1))}m`;
}

export function getProjectTileClassName(index: number): string {
  const featured = index % 7 === 0;
  return [
    "min-h-[22rem] overflow-hidden rounded-lg border border-hairline bg-background",
    "transition-colors hover:border-foreground/30",
    featured ? "md:col-span-2 md:row-span-2" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function formatProjectDate(value: string | Date | null | undefined): string {
  if (!value) return "Not updated yet";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not updated yet";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
