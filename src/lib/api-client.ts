export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export async function apiJson<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: requestHeaders(init),
  });
  const data = await readResponseBody(response);

  if (response.status === 401) {
    unauthorizedHandler?.();
    redirectToLogin();
  }

  if (!response.ok) {
    throw new ApiError(errorMessageFromData(data), response.status, data);
  }

  return data as T;
}

export function messageFromError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function requestHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  if (!headers.has("accept")) headers.set("accept", "application/json");
  if (shouldSetJsonContentType(init.body) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return headers;
}

function shouldSetJsonContentType(body: BodyInit | null | undefined): boolean {
  if (body == null) return false;
  if (typeof body === "string") return true;
  if (typeof FormData !== "undefined" && body instanceof FormData) return false;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return false;
  if (typeof Blob !== "undefined" && body instanceof Blob) return false;
  if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) return false;
  if (ArrayBuffer.isView(body)) return false;
  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) return false;
  return true;
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }
  const text = await response.text().catch(() => "");
  return text ? { error: text } : {};
}

function errorMessageFromData(data: unknown): string {
  if (!data || typeof data !== "object") return "Request failed";
  const error = (data as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) return error;
  const message = (data as { message?: unknown }).message;
  if (typeof message === "string" && message.trim()) return message;
  return "Request failed";
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  window.location.assign("/login");
}
