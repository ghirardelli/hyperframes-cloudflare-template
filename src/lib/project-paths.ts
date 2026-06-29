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
