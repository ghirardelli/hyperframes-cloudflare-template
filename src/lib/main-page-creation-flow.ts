export const CREATION_MODE_STORAGE_KEY = "motion-frames.creationMode";

export type CreationMode = "agent" | "manual";
export type RenderFormat = "mp4" | "webm" | "mov";
export type ExportResolutionId = "1080p" | "4k";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ExportResolutionPreset {
  id: ExportResolutionId;
  label: string;
  width: number;
  height: number;
}

export const DEFAULT_CREATION_MODE: CreationMode = "agent";
export const DEFAULT_DURATION_SEC = 6;
export const MIN_DURATION_SEC = 1;
export const MAX_DURATION_SEC = 120;
export const DEFAULT_RENDER_RESOLUTION_ID: ExportResolutionId = "1080p";
export const DEFAULT_RENDER_FORMAT: RenderFormat = "mp4";

export const DURATION_PRESETS = [3, 6, 8, 10, 15] as const;

export const EXPORT_RESOLUTION_PRESETS: ReadonlyArray<ExportResolutionPreset> = [
  { id: "1080p", label: "1080p · 1920 x 1080", width: 1920, height: 1080 },
  { id: "4k", label: "4K · 3840 x 2160", width: 3840, height: 2160 },
];

export const RENDER_FORMATS: ReadonlyArray<{ value: RenderFormat; label: string }> = [
  { value: "mp4", label: "MP4" },
  { value: "webm", label: "WebM" },
  { value: "mov", label: "MOV" },
];

export function isCreationMode(value: unknown): value is CreationMode {
  return value === "agent" || value === "manual";
}

export function readStoredCreationMode(storage = browserStorage()): CreationMode | null {
  try {
    const value = storage?.getItem(CREATION_MODE_STORAGE_KEY);
    return isCreationMode(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredCreationMode(
  mode: CreationMode,
  storage = browserStorage(),
): void {
  try {
    storage?.setItem(CREATION_MODE_STORAGE_KEY, mode);
  } catch {
    // Local storage is a preference convenience only.
  }
}

export function resolveCreationMode(
  stored: CreationMode | null,
  aiEnabled: boolean,
): CreationMode {
  if (stored === "manual") return "manual";
  if (stored === "agent" && aiEnabled) return "agent";
  return aiEnabled ? DEFAULT_CREATION_MODE : "manual";
}

export function normalizeDurationSec(value: unknown, fallback = DEFAULT_DURATION_SEC): number {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) return fallback;
  return Math.max(MIN_DURATION_SEC, Math.min(MAX_DURATION_SEC, Math.round(numeric)));
}

export function isExportResolutionId(value: unknown): value is ExportResolutionId {
  return value === "1080p" || value === "4k";
}

export function getExportResolutionPreset(
  id: ExportResolutionId,
): ExportResolutionPreset {
  return (
    EXPORT_RESOLUTION_PRESETS.find((preset) => preset.id === id) ??
    EXPORT_RESOLUTION_PRESETS[0]
  );
}

export function isRenderFormat(value: unknown): value is RenderFormat {
  return value === "mp4" || value === "webm" || value === "mov";
}

export function renderFormatLabel(format: RenderFormat): string {
  return RENDER_FORMATS.find((item) => item.value === format)?.label ?? "MP4";
}

export function buildRenderRequestBody(input: {
  html?: string;
  projectId?: string;
  resolutionId: ExportResolutionId;
  format: RenderFormat;
}) {
  const resolution = getExportResolutionPreset(input.resolutionId);
  return {
    html: input.html || undefined,
    projectId: input.projectId || undefined,
    width: resolution.width,
    height: resolution.height,
    format: input.format,
  };
}

function browserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}
