import { normalizeProjectPath } from "./project-paths";
import type { StorageProvider } from "./project-storage";
import type { WorkflowPhase } from "./workflow-runs";

export const WEBSITE_TO_VIDEO_SKILL_ID = "website-to-video";

export const HYPERFRAMES_WORKFLOW_COMMANDS = {
  capture: ["hyperframes", "capture", "--json"] as const,
  lint: ["hyperframes", "lint", "--json"] as const,
  validate: ["hyperframes", "validate", "--json"] as const,
  snapshot: ["hyperframes", "snapshot"] as const,
};

export const WEBSITE_TO_VIDEO_STAGE_PLAN = [
  "preflight",
  "capture",
  "compose",
  "validate",
  "persist",
  "complete",
] as const satisfies ReadonlyArray<WorkflowPhase>;

export const DEFAULT_WORKFLOW_LIMITS = {
  maxDurationMs: 4 * 60 * 1000,
  maxRedirects: 4,
  maxScreenshots: 8,
  maxFiles: 32,
  maxArtifactBytes: 8 * 1024 * 1024,
  maxLogBytes: 12 * 1024,
  maxConcurrentRunsPerOrg: 2,
  captureTimeoutMs: 90 * 1000,
  validateTimeoutMs: 15 * 1000,
} as const;

export const WEBSITE_TO_VIDEO_OUTPUT_PLAN = {
  projectWorkspace: [
    "DESIGN.md",
    "SCRIPT.md",
    "STORYBOARD.md",
    "index.html",
    "snapshots/",
  ],
  bunnyStorage: ["project-files", "pipeline-artifacts", "snapshots"],
  bunnyStream: ["stage-video", "final-render"],
  transientCache: ["capture"],
} as const;

export interface WorkflowSkippedStep {
  id: "voice" | "timing" | "final-render" | string;
  label: string;
  reason: string;
}

export const WEBSITE_TO_VIDEO_SKIPPED_STEPS: Array<WorkflowSkippedStep> = [
  {
    id: "voice",
    label: "Voiceover generation",
    reason: "Voice/TTS is not configured for the first workflow-runner pass.",
  },
  {
    id: "timing",
    label: "Precise VO timing",
    reason: "Voice timing is skipped until a voice provider and timing workflow are configured.",
  },
  {
    id: "final-render",
    label: "Final MP4 render",
    reason: "Final rendering remains an explicit Studio action after artifact review.",
  },
];

export interface WorkflowStoragePointer {
  provider: StorageProvider;
  key: string | null;
  sha256?: string | null;
  streamLibraryId?: string | null;
  streamVideoId?: string | null;
  streamStatus?: string | null;
  streamPlaybackUrl?: string | null;
  streamEmbedUrl?: string | null;
}

export interface WorkflowArtifactRecord {
  path: string;
  role: string;
  contentType: string;
  size: number;
  storage: WorkflowStoragePointer;
}

export interface WorkflowArtifactManifest {
  runId: string;
  skillId: string;
  artifacts: Array<WorkflowArtifactRecord>;
  skippedSteps: Array<WorkflowSkippedStep>;
  warnings?: Array<string>;
  studioUrl?: string | null;
}

export interface WorkflowErrorSummary {
  phase: WorkflowPhase | string;
  message: string;
  retryable: boolean;
}

export interface WorkflowEnvFlag {
  ENABLE_WEBSITE_TO_VIDEO_WORKFLOW?: string;
}

export function isWebsiteToVideoWorkflowEnabled(env: WorkflowEnvFlag): boolean {
  return env.ENABLE_WEBSITE_TO_VIDEO_WORKFLOW === "true";
}

export type WorkflowUrlValidation =
  | { ok: true; url: string }
  | { ok: false; reason: string };

const METADATA_HOSTS = new Set([
  "metadata.google.internal",
  "metadata",
]);

export function validateWorkflowUrl(input: string): WorkflowUrlValidation {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "url must be absolute" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "url must use http or https" };
  }

  const host = stripHostnameBrackets(url.hostname.toLowerCase());
  if (!host) return { ok: false, reason: "url host is required" };
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return { ok: false, reason: "localhost and local network hosts are not allowed" };
  }
  if (METADATA_HOSTS.has(host)) {
    return { ok: false, reason: "metadata service hosts are not allowed" };
  }
  if (isUnsafeIpLiteral(host)) {
    return { ok: false, reason: "private, loopback, link-local, and metadata IPs are not allowed" };
  }

  return { ok: true, url: url.href };
}

export async function validateWorkflowRedirects(
  input: string,
  options: {
    fetcher?: typeof fetch;
    maxRedirects?: number;
  } = {},
): Promise<WorkflowUrlValidation> {
  const fetcher = options.fetcher ?? fetch;
  const maxRedirects = options.maxRedirects ?? DEFAULT_WORKFLOW_LIMITS.maxRedirects;
  let current = validateWorkflowUrl(input);
  if (!current.ok) return current;

  for (let redirect = 0; redirect < maxRedirects; redirect += 1) {
    const res = await fetcher(current.url, { method: "HEAD", redirect: "manual" });
    if (res.status < 300 || res.status >= 400) return current;
    const location = res.headers.get("location");
    if (!location) return { ok: false, reason: "redirect response missing location" };
    const nextUrl = new URL(location, current.url).href;
    const next = validateWorkflowUrl(nextUrl);
    if (!next.ok) return { ok: false, reason: `unsafe redirect: ${next.reason}` };
    current = next;
  }
  return { ok: false, reason: `too many redirects; maximum is ${maxRedirects}` };
}

export function workflowProjectPath(runId: string, path: string): string {
  let normalized: string;
  try {
    normalized = normalizeProjectPath(path);
  } catch (err) {
    throw new Error(`invalid workflow path: ${messageFromError(err)}`);
  }
  return normalizeProjectPath(`pipeline/website-to-video/${runId}/${normalized}`);
}

export function workflowSnapshotPath(runId: string, path: string): string {
  let normalized: string;
  try {
    normalized = normalizeProjectPath(path);
  } catch (err) {
    throw new Error(`invalid workflow path: ${messageFromError(err)}`);
  }
  return normalizeProjectPath(`snapshots/website-to-video/${runId}/${normalized}`);
}

export function createWorkflowArtifactManifest(input: {
  runId: string;
  skillId?: string;
  artifacts?: Array<WorkflowArtifactRecord>;
  skippedSteps?: Array<WorkflowSkippedStep>;
  warnings?: Array<string>;
  studioUrl?: string | null;
}): WorkflowArtifactManifest {
  return {
    runId: input.runId,
    skillId: input.skillId ?? WEBSITE_TO_VIDEO_SKILL_ID,
    artifacts: input.artifacts ?? [],
    skippedSteps: input.skippedSteps ?? [],
    warnings: input.warnings?.slice(0, 20),
    studioUrl: input.studioUrl ?? null,
  };
}

export function toBoundedWorkflowError(
  err: unknown,
  phase: WorkflowPhase | string,
  maxChars = 700,
): WorkflowErrorSummary {
  const message = messageFromError(err).replace(/\s+/g, " ").trim();
  return {
    phase,
    message: message.length > maxChars ? `${message.slice(0, Math.max(0, maxChars - 1))}…` : message,
    retryable: phase !== "preflight",
  };
}

function stripHostnameBrackets(host: string): string {
  return host.replace(/^\[/, "").replace(/\]$/, "");
}

function isUnsafeIpLiteral(host: string): boolean {
  if (host.includes(":")) return isUnsafeIpv6(host);
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return false;
  const nums = parts.map((part) => Number(part));
  if (nums.some((num) => num < 0 || num > 255)) return false;
  const [a, b] = nums;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 ||
    a === 192 && b === 168 ||
    a === 100 && b >= 64 && b <= 127
  );
}

function isUnsafeIpv6(host: string): boolean {
  const normalized = host.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  );
}

function messageFromError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
