export interface BunnyEnv {
  BUNNY_STORAGE_ZONE_NAME?: string;
  BUNNY_STORAGE_ACCESS_KEY?: string;
  BUNNY_STORAGE_ENDPOINT?: string;
  BUNNY_STORAGE_CDN_HOSTNAME?: string;
  BUNNY_STREAM_LIBRARY_ID?: string;
  BUNNY_STREAM_ACCESS_KEY?: string;
  BUNNY_STREAM_API_BASE?: string;
  BUNNY_STREAM_CDN_HOSTNAME?: string;
  BUNNY_STREAM_EMBED_HOSTNAME?: string;
  BUNNY_STREAM_COLLECTION_ID?: string;
  BUNNY_TOKEN_AUTH_KEY?: string;
  BUNNY_WEBHOOK_SECRET?: string;
}

export interface BunnyStorageConfig {
  zoneName: string;
  accessKey: string;
  endpoint: string;
  cdnHostname?: string;
}

export interface BunnyStreamConfig {
  libraryId: string;
  accessKey: string;
  apiBase: string;
  collectionId?: string;
  cdnHostname?: string;
  embedHostname?: string;
}

export class BunnyConfigError extends Error {
  status = 500;

  constructor(message: string) {
    super(message);
    this.name = "BunnyConfigError";
  }
}

export class BunnyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "BunnyApiError";
  }
}

export function getBunnyStorageConfig(env: BunnyEnv): BunnyStorageConfig | null {
  const zoneName = env.BUNNY_STORAGE_ZONE_NAME?.trim();
  const accessKey = env.BUNNY_STORAGE_ACCESS_KEY?.trim();
  const endpoint = env.BUNNY_STORAGE_ENDPOINT?.trim();
  if (!zoneName && !accessKey && !endpoint) return null;
  if (!zoneName || !accessKey || !endpoint) {
    throw new BunnyConfigError(
      "Bunny Storage requires BUNNY_STORAGE_ZONE_NAME, BUNNY_STORAGE_ACCESS_KEY, and BUNNY_STORAGE_ENDPOINT.",
    );
  }
  return {
    zoneName,
    accessKey,
    endpoint: stripTrailingSlash(endpoint),
    cdnHostname: normalizeHostname(env.BUNNY_STORAGE_CDN_HOSTNAME),
  };
}

export function getBunnyStreamConfig(env: BunnyEnv): BunnyStreamConfig | null {
  const libraryId = env.BUNNY_STREAM_LIBRARY_ID?.trim();
  const accessKey = env.BUNNY_STREAM_ACCESS_KEY?.trim();
  if (!libraryId && !accessKey) return null;
  if (!libraryId || !accessKey) {
    throw new BunnyConfigError(
      "Bunny Stream requires BUNNY_STREAM_LIBRARY_ID and BUNNY_STREAM_ACCESS_KEY.",
    );
  }
  return {
    libraryId,
    accessKey,
    apiBase: stripTrailingSlash(env.BUNNY_STREAM_API_BASE?.trim() || "https://video.bunnycdn.com"),
    collectionId: env.BUNNY_STREAM_COLLECTION_ID?.trim() || undefined,
    cdnHostname: normalizeHostname(env.BUNNY_STREAM_CDN_HOSTNAME),
    embedHostname: normalizeHostname(env.BUNNY_STREAM_EMBED_HOSTNAME),
  };
}

export function requireBunnyStorageConfig(env: BunnyEnv): BunnyStorageConfig {
  const config = getBunnyStorageConfig(env);
  if (!config) {
    throw new BunnyConfigError(
      "Bunny Storage is not configured. Set BUNNY_STORAGE_ZONE_NAME, BUNNY_STORAGE_ACCESS_KEY, and BUNNY_STORAGE_ENDPOINT.",
    );
  }
  return config;
}

export function requireBunnyStreamConfig(env: BunnyEnv): BunnyStreamConfig {
  const config = getBunnyStreamConfig(env);
  if (!config) {
    throw new BunnyConfigError(
      "Bunny Stream is not configured. Set BUNNY_STREAM_LIBRARY_ID and BUNNY_STREAM_ACCESS_KEY.",
    );
  }
  return config;
}

export function isBunnyStorageConfigured(env: BunnyEnv): boolean {
  return Boolean(env.BUNNY_STORAGE_ZONE_NAME && env.BUNNY_STORAGE_ACCESS_KEY && env.BUNNY_STORAGE_ENDPOINT);
}

export function isBunnyStreamConfigured(env: BunnyEnv): boolean {
  return Boolean(env.BUNNY_STREAM_LIBRARY_ID && env.BUNNY_STREAM_ACCESS_KEY);
}

export class BunnyStorageClient {
  constructor(
    private readonly config: BunnyStorageConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async uploadFile(input: {
    path: string;
    body: BodyInit;
    contentType?: string;
    sha256?: string;
  }): Promise<void> {
    const headers = new Headers({ AccessKey: this.config.accessKey });
    if (input.contentType) headers.set("content-type", input.contentType);
    if (input.sha256) headers.set("Checksum", input.sha256.toUpperCase());
    await this.request(this.storageUrl(input.path), {
      method: "PUT",
      headers,
      body: input.body,
    });
  }

  async getFile(path: string): Promise<Response> {
    return this.request(this.storageUrl(path), {
      headers: { AccessKey: this.config.accessKey },
    });
  }

  async deleteFile(path: string): Promise<void> {
    await this.request(this.storageUrl(path), {
      method: "DELETE",
      headers: { AccessKey: this.config.accessKey },
    });
  }

  storageUrl(path: string): string {
    return `${this.config.endpoint}/${encodePathSegment(this.config.zoneName)}/${encodePath(path)}`;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const res = await this.fetcher(url, init);
    if (!res.ok) throw await apiError("Bunny Storage request failed", res);
    return res;
  }
}

export interface BunnyStreamVideo {
  guid: string;
  videoLibraryId?: number;
  status?: number;
  title?: string;
  collectionId?: string | null;
  width?: number;
  height?: number;
  length?: number;
  storageSize?: number;
}

export class BunnyStreamClient {
  constructor(
    private readonly config: BunnyStreamConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async createVideo(input: { title: string; collectionId?: string; thumbnailTime?: number }): Promise<BunnyStreamVideo> {
    const res = await this.request(`${this.config.apiBase}/library/${encodeURIComponent(this.config.libraryId)}/videos`, {
      method: "POST",
      headers: {
        AccessKey: this.config.accessKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: input.title,
        collectionId: input.collectionId ?? this.config.collectionId,
        thumbnailTime: input.thumbnailTime,
      }),
    });
    return (await res.json()) as BunnyStreamVideo;
  }

  async uploadVideo(videoId: string, body: BodyInit, contentType = "application/octet-stream"): Promise<void> {
    await this.request(
      `${this.config.apiBase}/library/${encodeURIComponent(this.config.libraryId)}/videos/${encodeURIComponent(videoId)}`,
      {
        method: "PUT",
        headers: {
          AccessKey: this.config.accessKey,
          "content-type": contentType,
        },
        body,
      },
    );
  }

  async getVideo(videoId: string): Promise<BunnyStreamVideo> {
    const res = await this.request(
      `${this.config.apiBase}/library/${encodeURIComponent(this.config.libraryId)}/videos/${encodeURIComponent(videoId)}`,
      {
        headers: { AccessKey: this.config.accessKey },
      },
    );
    return (await res.json()) as BunnyStreamVideo;
  }

  async deleteVideo(videoId: string): Promise<void> {
    await this.request(
      `${this.config.apiBase}/library/${encodeURIComponent(this.config.libraryId)}/videos/${encodeURIComponent(videoId)}`,
      {
        method: "DELETE",
        headers: { AccessKey: this.config.accessKey },
      },
    );
  }

  embedUrl(videoId: string): string {
    const host = this.config.embedHostname || "iframe.mediadelivery.net";
    return `https://${host}/embed/${encodeURIComponent(this.config.libraryId)}/${encodeURIComponent(videoId)}`;
  }

  playbackUrl(videoId: string): string | null {
    if (!this.config.cdnHostname) return null;
    return `https://${this.config.cdnHostname}/${encodeURIComponent(videoId)}/playlist.m3u8`;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const res = await this.fetcher(url, init);
    if (!res.ok) throw await apiError("Bunny Stream request failed", res);
    return res;
  }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeHostname(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function encodePath(path: string): string {
  return path.split("/").map(encodePathSegment).join("/");
}

function encodePathSegment(segment: string): string {
  return encodeURIComponent(segment);
}

async function apiError(message: string, res: Response): Promise<BunnyApiError> {
  const body = await res.text().catch(() => "");
  return new BunnyApiError(`${message} (${res.status})${body ? `: ${body}` : ""}`, res.status, body);
}
