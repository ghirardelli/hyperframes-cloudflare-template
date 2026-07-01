const RESERVED_PREFIXES = ["versions/", "renders/", ".system/"];

export class InvalidProjectPathError extends Error {
  status = 400;

  constructor(message = "invalid project path") {
    super(message);
    this.name = "InvalidProjectPathError";
  }
}

export function normalizeProjectPath(input: string): string {
  const raw = input.trim().replace(/\\/g, "/");
  if (!raw) throw new InvalidProjectPathError("path is required");
  if (raw.startsWith("/")) throw new InvalidProjectPathError("absolute paths are not allowed");
  if (/[\u0000-\u001f\u007f]/.test(raw)) {
    throw new InvalidProjectPathError("control characters are not allowed in paths");
  }

  const parts = raw.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new InvalidProjectPathError("path traversal is not allowed");
  }

  const normalized = parts.join("/");
  if (RESERVED_PREFIXES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix))) {
    throw new InvalidProjectPathError("reserved project path prefix");
  }
  return normalized;
}

export function dirname(path: string): string | null {
  const index = path.lastIndexOf("/");
  return index > 0 ? path.slice(0, index) : null;
}

export function basename(path: string): string {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(index + 1) : path;
}

export function sanitizeAssetFilename(input: string): string {
  const rawName = basename(input.trim().replace(/\\/g, "/"));
  const lower = rawName.toLowerCase();
  const extensionMatch = lower.match(/\.([a-z0-9]{1,12})$/);
  const extension = extensionMatch ? `.${extensionMatch[1]}` : "";
  const stemSource = extension ? lower.slice(0, -extension.length) : lower;
  let stem = stemSource
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!stem) stem = "asset";
  const maxStemLength = Math.max(1, 120 - extension.length);
  return `${stem.slice(0, maxStemLength)}${extension}`;
}

export function promptAgentAssetPath(filename: string, existingPaths: Iterable<string>): string {
  const safeName = sanitizeAssetFilename(filename);
  const existing = new Set(existingPaths);
  const extensionIndex = safeName.lastIndexOf(".");
  const stem = extensionIndex > 0 ? safeName.slice(0, extensionIndex) : safeName;
  const extension = extensionIndex > 0 ? safeName.slice(extensionIndex) : "";

  let candidate = `assets/${safeName}`;
  let index = 2;
  while (existing.has(candidate)) {
    candidate = `assets/${stem}-${index}${extension}`;
    index += 1;
  }
  return candidate;
}
