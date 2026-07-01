import type {
  WorkflowArtifactManifest,
  WorkflowErrorSummary,
} from "./website-to-video-workflow";

export type WorkflowStatus =
  | "intake"
  | "queued"
  | "running"
  | "awaiting_approval"
  | "succeeded"
  | "failed"
  | "cancelled";

export type WorkflowPhase =
  | "preflight"
  | "capture"
  | "compose"
  | "validate"
  | "persist"
  | "complete";

export interface WorkflowProgress {
  current: number;
  total: number;
  label: string;
}

export interface WorkflowRunLike {
  id: string;
  organizationId: string;
  userId: string;
  projectId: string | null;
  skillId: string;
  status: WorkflowStatus;
  phase: WorkflowPhase;
  inputUrl: string;
  options: Record<string, unknown> | null;
  progress: WorkflowProgress | null;
  artifactManifest: WorkflowArtifactManifest | null;
  error: WorkflowErrorSummary | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
}

export interface WorkflowRunClient {
  id: string;
  projectId: string | null;
  skillId: string;
  status: WorkflowStatus;
  phase: WorkflowPhase;
  inputUrl: string;
  options: Record<string, unknown> | null;
  progress: WorkflowProgress | null;
  artifactManifest: WorkflowArtifactManifest | null;
  artifacts: WorkflowArtifactManifest["artifacts"];
  skippedSteps: WorkflowArtifactManifest["skippedSteps"];
  error: WorkflowErrorSummary | null;
  studioUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

const ACTIVE_STATUSES = new Set<WorkflowStatus>([
  "intake",
  "queued",
  "running",
  "awaiting_approval",
]);

const VALID_TRANSITIONS: Record<WorkflowStatus, ReadonlyArray<WorkflowStatus>> = {
  intake: ["queued", "cancelled", "failed"],
  queued: ["running", "cancelled", "failed"],
  running: ["awaiting_approval", "succeeded", "failed", "cancelled"],
  awaiting_approval: ["running", "succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function isActiveWorkflowStatus(status: WorkflowStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function assertWorkflowTransition(from: WorkflowStatus, to: WorkflowStatus): void {
  if (from === to) return;
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`invalid workflow transition: ${from} -> ${to}`);
  }
}

export function workflowRunToClient(run: WorkflowRunLike): WorkflowRunClient {
  const manifest = run.artifactManifest ?? null;
  return {
    id: run.id,
    projectId: run.projectId,
    skillId: run.skillId,
    status: run.status,
    phase: run.phase,
    inputUrl: run.inputUrl,
    options: run.options ?? null,
    progress: run.progress ?? null,
    artifactManifest: manifest,
    artifacts: manifest?.artifacts ?? [],
    skippedSteps: manifest?.skippedSteps ?? [],
    error: run.error ?? null,
    studioUrl: manifest?.studioUrl ?? (run.projectId ? `/projects/${encodeURIComponent(run.projectId)}/studio` : null),
    createdAt: isoOrNull(run.createdAt),
    updatedAt: isoOrNull(run.updatedAt),
    startedAt: isoOrNull(run.startedAt),
    completedAt: isoOrNull(run.completedAt),
  };
}

function isoOrNull(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
