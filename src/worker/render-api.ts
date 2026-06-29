import { getContainer } from "@cloudflare/containers";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";

import { createAuth } from "../auth";
import manifest from "../composition-manifest.json";
import { RenderContainer } from "../container";
import { createDb } from "../db";
import {
  organizationMemberships,
  organizations,
  projectEntries,
  projectEntryVersions,
  projectMembers,
  projectPermissionAudits,
  projectSnapshots,
  projectVersions,
  projects,
  publishedProjects,
  renders,
  sessions,
  users,
} from "../db/schema";
import {
  AuthRequiredError,
  ForbiddenError,
  assertAdmin,
  isOrganizationAdmin,
  requireAuthContext,
  requireProjectAccess,
  requirePublishedProjectAccess,
  type AppAuthContext,
  type TenantAuthEnv,
} from "../lib/auth-context";
import {
  BunnyApiError,
  BunnyStreamClient,
  getBunnyStreamConfig,
  isBunnyStreamConfigured,
  type BunnyEnv,
} from "../lib/bunny";
import { DEFAULT_MODEL, generateComposition, GenerateError } from "../lib/generate";
import { normalizeProjectPath } from "../lib/project-paths";
import { projectRenderArchiveKey, writeProjectObject } from "../lib/project-storage";
import { handleStudioFilesApi, renderProjectPreview, upsertProjectFile } from "./studio-files-api";
import { handlePromptAgentChat } from "./prompt-agent-api";

export interface WorkerEnv extends TenantAuthEnv, BunnyEnv {
  ASSETS: Fetcher;
  RENDER_CONTAINER: DurableObjectNamespace<RenderContainer>;
  RENDERS: R2Bucket;
  HYPERDRIVE?: Hyperdrive;
  /** "true" enables AI generation. Configure in wrangler.jsonc vars. */
  ENABLE_AI_GEN?: string;
  /** Server-side OpenRouter API key. Set with `wrangler secret put OPENROUTER_API_KEY`. */
  OPENROUTER_API_KEY?: string;
  /** Optional OpenRouter model override. */
  OPENROUTER_MODEL?: string;
}

const PREVIEW_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "content-security-policy": "frame-ancestors 'self'; object-src 'none'",
};

const MAX_GENERATE_PROMPT_BYTES = 8 * 1024;
const MAX_RENDER_HTML_BYTES = 2 * 1024 * 1024;
const DASH_ORIGIN = "https://dash.better-auth.com";

const ENCODER = new TextEncoder();

export async function handleWorkerApi(
  req: Request,
  env: WorkerEnv,
): Promise<Response | null> {
  const url = new URL(req.url);
  const { pathname } = url;

  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    if (isDashAuthPath(pathname) && req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: dashCorsHeaders(req) });
    }

    try {
      const response = await createAuth(env).handler(req);
      if (isDashAuthPath(pathname)) addDashCorsHeaders(req, response.headers);
      return response;
    } catch (err) {
      return jsonError(`auth unavailable: ${msg(err)}`, 500);
    }
  }

  if (req.method === "GET" && pathname === "/api/config") {
    return Response.json(
      {
        aiGenEnabled: env.ENABLE_AI_GEN === "true",
        modelLabel: env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL,
      },
      { headers: { "cache-control": "public, max-age=300" } },
    );
  }

  if (req.method === "POST" && pathname === "/api/agent/chat") {
    const auth = await protectedContext(req, env);
    if (auth instanceof Response) return auth;
    const tenant = requireTenantOrganization(auth);
    if (tenant) return tenant;
    return handlePromptAgentChat({
      env,
      req,
      auth,
      generateHyperframe: (body) => generateAndPersistComposition(env, req, auth, body),
    });
  }

  const appApiResponse = await handleAppApi(env, req, pathname);
  if (appApiResponse) return appApiResponse;

  if (req.method === "POST" && pathname === "/api/render") {
    const auth = await protectedContext(req, env);
    if (auth instanceof Response) return auth;
    const tenant = requireTenantOrganization(auth);
    if (tenant) return tenant;
    return handleRender(env, req, auth);
  }

  if (req.method === "POST" && pathname === "/api/generate") {
    const auth = await protectedContext(req, env);
    if (auth instanceof Response) return auth;
    const tenant = requireTenantOrganization(auth);
    if (tenant) return tenant;
    return handleGenerate(env, req, auth);
  }

  if (req.method === "GET" && pathname === "/api/preview") {
    const auth = await protectedContext(req, env);
    if (auth instanceof Response) return auth;
    return handlePreview(env, req);
  }

  if (req.method === "GET" && pathname.startsWith("/r/")) {
    const auth = await protectedContext(req, env);
    if (auth instanceof Response) return auth;
    const key = pathname.slice("/r/".length);
    return handleR2Get(env, key, auth);
  }

  return null;
}

function isJsonRequest(req: Request): boolean {
  return req.headers.get("content-type")?.includes("application/json") ?? false;
}

function utf8ByteLength(s: string): number {
  return ENCODER.encode(s).byteLength;
}

function fetchAsset(env: WorkerEnv, requestUrl: string, path: string): Promise<Response> {
  const url = new URL(`/${path}`, requestUrl);
  return env.ASSETS.fetch(new Request(url));
}

async function handlePreview(env: WorkerEnv, req: Request): Promise<Response> {
  const res = await fetchAsset(env, req.url, "_bundled/preview.html");
  if (!res.ok) {
    return new Response("preview bundle missing - run build", { status: 500 });
  }
  return new Response(res.body, { headers: PREVIEW_HEADERS });
}

async function loadBundledCompositionFiles(
  env: WorkerEnv,
  requestUrl: string,
): Promise<Array<{ path: string; content: string }>> {
  return Promise.all(
    manifest.files.map(async (rel) => {
      const res = await fetchAsset(env, requestUrl, `${manifest.dir}/${rel}`);
      if (!res.ok) throw new Error(`asset missing: ${rel} (${res.status})`);
      const buf = new Uint8Array(await res.arrayBuffer());
      return { path: rel, content: bufferToBase64(buf) };
    }),
  );
}

function bufferToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function htmlToFiles(html: string): Array<{ path: string; content: string }> {
  return [
    {
      path: "index.html",
      content: bufferToBase64(ENCODER.encode(html)),
    },
  ];
}

interface RenderRequestBody {
  html?: string;
  projectId?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  format?: string;
}

interface RenderSettings {
  width?: number;
  height?: number;
  durationSec?: number;
  format?: string;
}

const RENDER_FORMATS = new Set(["mp4", "webm", "mov"]);
const RENDER_CONTENT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

/**
 * Validate optional render settings from the request body. Returns a settings
 * object (possibly empty, preserving default render behavior) or a Response on
 * invalid input.
 */
function parseRenderSettings(body: RenderRequestBody | null): RenderSettings | Response {
  const settings: RenderSettings = {};
  if (body?.width !== undefined) {
    if (typeof body.width !== "number" || !Number.isFinite(body.width) || body.width < 16 || body.width > 4096) {
      return jsonError("width must be between 16 and 4096", 400);
    }
    settings.width = Math.round(body.width);
  }
  if (body?.height !== undefined) {
    if (typeof body.height !== "number" || !Number.isFinite(body.height) || body.height < 16 || body.height > 4096) {
      return jsonError("height must be between 16 and 4096", 400);
    }
    settings.height = Math.round(body.height);
  }
  if (body?.durationSec !== undefined) {
    const d = normalizedDuration(body.durationSec);
    if (d === undefined) return jsonError("durationSec must be a number", 400);
    settings.durationSec = d;
  }
  if (body?.format !== undefined) {
    if (typeof body.format !== "string" || !RENDER_FORMATS.has(body.format)) {
      return jsonError("format must be one of mp4, webm, mov", 400);
    }
    settings.format = body.format;
  }
  return settings;
}

async function handleRender(
  env: WorkerEnv,
  req: Request,
  context: AppAuthContext,
): Promise<Response> {
  const t0 = Date.now();

  let files: Array<{ path: string; content: string }>;
  let source: "bundled" | "html" = "bundled";
  let project: typeof projects.$inferSelect | null = null;

  let body: RenderRequestBody | null = null;
  if (isJsonRequest(req)) {
    try {
      body = (await req.json()) as RenderRequestBody;
    } catch {
      return jsonError("invalid JSON body", 400);
    }
  }

  if (body?.html) {
    if (typeof body.html !== "string") {
      return jsonError("html must be a string", 400);
    }
    if (utf8ByteLength(body.html) > MAX_RENDER_HTML_BYTES) {
      return jsonError(`html exceeds ${MAX_RENDER_HTML_BYTES} bytes`, 413);
    }
    files = htmlToFiles(body.html);
    source = "html";
  } else if (body?.projectId) {
    project = await requireProjectAccess(context, body.projectId, env, "render");
    if (!project.currentHtml) return jsonError("project has no composition HTML", 400);
    files = htmlToFiles(project.currentHtml);
    source = "html";
  } else {
    try {
      files = await loadBundledCompositionFiles(env, req.url);
    } catch (err) {
      return jsonError(`failed to load composition: ${msg(err)}`, 500);
    }
  }

  const settings = parseRenderSettings(body);
  if (settings instanceof Response) return settings;
  const renderFormat = settings.format ?? "mp4";

  const container = getContainer(env.RENDER_CONTAINER, "renderer");
  let containerRes;
  try {
    containerRes = await container.fetch(
      new Request("http://container/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files, ...settings }),
      }),
    );
  } catch (err) {
    return jsonError(`container unavailable: ${msg(err)}`, 502);
  }

  if (!containerRes.ok) {
    const errBody = await containerRes.text().catch(() => "");
    return jsonError(`render failed (${containerRes.status}): ${errBody}`, 502);
  }

  const renderId = crypto.randomUUID();
  const bytes = new Uint8Array(await containerRes.arrayBuffer());
  const contentType = RENDER_CONTENT_TYPES[renderFormat] ?? "video/mp4";
  const snapshotId = project ? await createProjectSnapshot(env, context, project.id, "render") : null;

  if (isBunnyStreamConfigured(env)) {
    const streamConfig = getBunnyStreamConfig(env);
    if (!streamConfig) return jsonError("Bunny Stream is not fully configured", 500);
    const stream = new BunnyStreamClient(streamConfig);
    try {
      const video = await stream.createVideo({
        title: project?.title || `Render ${renderId}`,
        collectionId: streamConfig.collectionId,
      });
      await stream.uploadVideo(video.guid, bytes, contentType);

      let archiveKey: string | null = null;
      if (project) {
        const archive = await writeProjectObject(env, {
          key: projectRenderArchiveKey({
            organizationId: context.organization.id,
            ownerId: project.ownerId,
            projectId: project.id,
            renderId,
            filename: `output.${renderFormat}`,
          }),
          bytes,
          contentType,
        });
        archiveKey = archive.provider === "bunny-storage" ? archive.key : null;
      }

      const embedUrl = stream.embedUrl(video.guid);
      const playbackUrl = stream.playbackUrl(video.guid);
      await createDb(env).insert(renders).values({
        id: renderId,
        projectId: body?.projectId ?? null,
        organizationId: context.organization.id,
        userId: context.user.id,
        r2Key: null,
        storageProvider: "bunny-stream",
        storageKey: video.guid,
        contentType,
        format: renderFormat,
        streamLibraryId: streamConfig.libraryId,
        streamVideoId: video.guid,
        streamStatus: video.status == null ? "uploaded" : String(video.status),
        streamPlaybackUrl: playbackUrl,
        streamEmbedUrl: embedUrl,
        bunnyStorageKey: archiveKey,
        snapshotId,
        sourceType: source,
        durationMs: Date.now() - t0,
      });
      if (project) {
        await recordRenderEntry(env, context, project, {
          renderId,
          format: renderFormat,
          contentType,
          streamLibraryId: streamConfig.libraryId,
          streamVideoId: video.guid,
          streamEmbedUrl: embedUrl,
          streamPlaybackUrl: playbackUrl,
          storageKey: archiveKey,
        });
      }
      return Response.json({
        id: renderId,
        url: `/api/renders/${renderId}`,
        key: video.guid,
        source,
        format: renderFormat,
        streamStatus: video.status == null ? "uploaded" : String(video.status),
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      console.error("Bunny Stream render upload failed", msg(err));
      await createDb(env).insert(renders).values({
        id: renderId,
        projectId: body?.projectId ?? null,
        organizationId: context.organization.id,
        userId: context.user.id,
        r2Key: null,
        storageProvider: "bunny-stream",
        storageKey: null,
        contentType,
        format: renderFormat,
        streamStatus: "failed",
        snapshotId,
        sourceType: source,
        durationMs: Date.now() - t0,
      });
      const status = err instanceof BunnyApiError ? 502 : 500;
      return jsonError(`stream upload failed: ${msg(err)}`, status);
    }
  }

  const key = `renders/${context.organization.id}/${Date.now()}-${renderId}.${renderFormat}`;
  await env.RENDERS.put(key, bytes, { httpMetadata: { contentType } });

  await createDb(env).insert(renders).values({
    id: renderId,
    projectId: body?.projectId ?? null,
    organizationId: context.organization.id,
    userId: context.user.id,
    r2Key: key,
    storageProvider: "r2",
    storageKey: key,
    contentType,
    format: renderFormat,
    snapshotId,
    sourceType: source,
    durationMs: Date.now() - t0,
  });

  const url = new URL(req.url);
  url.pathname = `/r/${key}`;

  return Response.json({
    url: url.toString(),
    key,
    source,
    format: renderFormat,
    durationMs: Date.now() - t0,
  });
}

interface GenerateRequestBody {
  prompt?: string;
  durationSec?: number;
  projectId?: string;
  title?: string;
}

async function handleGenerate(
  env: WorkerEnv,
  req: Request,
  context: AppAuthContext,
): Promise<Response> {
  if (env.ENABLE_AI_GEN !== "true") {
    return jsonError(
      'AI generation is disabled on this deployment. Set ENABLE_AI_GEN="true" in wrangler.jsonc vars to enable generation.',
      403,
    );
  }

  if (!isJsonRequest(req)) {
    return jsonError("expected application/json", 415);
  }

  let body: GenerateRequestBody;
  try {
    body = (await req.json()) as GenerateRequestBody;
  } catch {
    return jsonError("invalid JSON body", 400);
  }

  try {
    return Response.json(await generateAndPersistComposition(env, req, context, body));
  } catch (err) {
    if (err instanceof GenerateError) {
      return jsonError(err.message, err.status);
    }
    return jsonError(`generation failed: ${msg(err)}`, 500);
  }
}

async function generateAndPersistComposition(
  env: WorkerEnv,
  req: Request,
  context: AppAuthContext,
  body: GenerateRequestBody,
) {
  assertValidGenerateBody(body);

  const openRouterKey = env.OPENROUTER_API_KEY?.trim();
  if (!openRouterKey) {
    throw new GenerateError(
      "OpenRouter API key is not configured. Set OPENROUTER_API_KEY as a Cloudflare secret.",
      500,
    );
  }

  const referer = req.headers.get("origin") ?? new URL(req.url).origin;
  const configuredModel = env.OPENROUTER_MODEL?.trim() || undefined;

  const result = await generateComposition({
    apiKey: openRouterKey,
    prompt: body.prompt,
    model: configuredModel,
    durationSec: normalizedDuration(body.durationSec),
    referer,
    appTitle: "Motion Frames",
  });

  const project = await upsertGeneratedProject(env, context, body, result.html);

  return {
    html: result.html,
    project: project
      ? {
          id: project.id,
          title: project.title,
        }
      : null,
    model: result.model,
    attempts: result.attempts,
    durationMs: result.durationMs,
    lintErrors: result.lintErrors,
    lintOk: result.lintErrors.length === 0,
  };
}

function assertValidGenerateBody(
  body: GenerateRequestBody,
): asserts body is GenerateRequestBody & { prompt: string } {
  if (!body.prompt || typeof body.prompt !== "string") {
    throw new GenerateError("missing prompt", 400);
  }
  if (utf8ByteLength(body.prompt) > MAX_GENERATE_PROMPT_BYTES) {
    throw new GenerateError(`prompt exceeds ${MAX_GENERATE_PROMPT_BYTES} bytes`, 413);
  }
}

async function handleR2Get(
  env: WorkerEnv,
  key: string,
  context: AppAuthContext,
): Promise<Response> {
  const renderRows = await createDb(env)
    .select({ organizationId: renders.organizationId })
    .from(renders)
    .where(eq(renders.r2Key, key))
    .limit(1);

  if (!renderRows[0] || renderRows[0].organizationId !== context.organization.id) {
    return new Response("not found", { status: 404 });
  }

  const obj = await env.RENDERS.get(key);
  if (!obj) return new Response("not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
}

async function handleRenderPlayback(
  env: WorkerEnv,
  context: AppAuthContext,
  renderId: string,
): Promise<Response> {
  const rows = await createDb(env)
    .select()
    .from(renders)
    .where(eq(renders.id, renderId))
    .limit(1);
  const render = rows[0];
  if (!render || render.organizationId !== context.organization.id) {
    return new Response("not found", { status: 404 });
  }
  if (render.projectId) {
    await requireProjectAccess(context, render.projectId, env, "render");
  }
  if (render.storageProvider === "bunny-stream") {
    const target = render.streamEmbedUrl || render.streamPlaybackUrl;
    if (!target) return jsonError("render is not ready", 409);
    return Response.redirect(target, 302);
  }
  if (render.r2Key) {
    return new Response(null, { status: 302, headers: { location: `/r/${render.r2Key}` } });
  }
  return jsonError("render is not ready", 409);
}

async function createProjectSnapshot(
  env: WorkerEnv,
  context: AppAuthContext,
  projectId: string,
  reason: string,
): Promise<string> {
  const versions = await createDb(env)
    .select({
      id: projectEntryVersions.id,
      path: projectEntryVersions.path,
      createdAt: projectEntryVersions.createdAt,
    })
    .from(projectEntryVersions)
    .where(and(eq(projectEntryVersions.projectId, projectId), eq(projectEntryVersions.organizationId, context.organization.id)))
    .orderBy(desc(projectEntryVersions.createdAt));

  const seen = new Set<string>();
  const manifest = [];
  for (const version of versions) {
    if (seen.has(version.path)) continue;
    seen.add(version.path);
    manifest.push({ path: version.path, versionId: version.id });
  }

  const snapshotId = crypto.randomUUID();
  await createDb(env).insert(projectSnapshots).values({
    id: snapshotId,
    projectId,
    organizationId: context.organization.id,
    createdById: context.user.id,
    reason,
    manifest,
  });
  return snapshotId;
}

async function recordProjectTextEntry(
  env: WorkerEnv,
  context: AppAuthContext,
  project: typeof projects.$inferSelect,
  path: string,
  content: string,
  changeKind: string,
): Promise<string> {
  const normalized = normalizeProjectPath(path);
  const entryId = projectEntryId(project.id, normalized);
  const size = ENCODER.encode(content).byteLength;
  const ownerId = project.ownerId || context.user.id;
  await createDb(env)
    .insert(projectEntries)
    .values({
      id: entryId,
      projectId: project.id,
      organizationId: context.organization.id,
      ownerId,
      createdById: context.user.id,
      updatedById: context.user.id,
      path: normalized,
      kind: "text",
      artifactRole: artifactRoleForPath(normalized),
      storageProvider: "postgres",
      contentType: mimeForPath(normalized),
      size,
      textContent: content,
      searchText: `${normalized}\n${content}`,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [projectEntries.projectId, projectEntries.path],
      set: {
        kind: "text",
        artifactRole: artifactRoleForPath(normalized),
        storageProvider: "postgres",
        contentType: mimeForPath(normalized),
        size,
        textContent: content,
        searchText: `${normalized}\n${content}`,
        deletedAt: null,
        updatedById: context.user.id,
        updatedAt: new Date(),
      },
    });
  const versionId = crypto.randomUUID();
  await createDb(env).insert(projectEntryVersions).values({
    id: versionId,
    entryId,
    projectId: project.id,
    organizationId: context.organization.id,
    createdById: context.user.id,
    path: normalized,
    kind: "text",
    artifactRole: artifactRoleForPath(normalized),
    storageProvider: "postgres",
    contentType: mimeForPath(normalized),
    size,
    textContent: content,
    changeKind,
  });
  return versionId;
}

async function recordRenderEntry(
  env: WorkerEnv,
  context: AppAuthContext,
  project: typeof projects.$inferSelect,
  input: {
    renderId: string;
    format: string;
    contentType: string;
    streamLibraryId: string;
    streamVideoId: string;
    streamEmbedUrl: string;
    streamPlaybackUrl: string | null;
    storageKey: string | null;
  },
): Promise<void> {
  const path = `renders/${input.renderId}.${input.format}`;
  const entryId = projectEntryId(project.id, path);
  const ownerId = project.ownerId || context.user.id;
  await createDb(env)
    .insert(projectEntries)
    .values({
      id: entryId,
      projectId: project.id,
      organizationId: context.organization.id,
      ownerId,
      createdById: context.user.id,
      updatedById: context.user.id,
      path,
      kind: "render",
      artifactRole: "render",
      storageProvider: "bunny-stream",
      storageKey: input.storageKey,
      streamLibraryId: input.streamLibraryId,
      streamVideoId: input.streamVideoId,
      contentType: input.contentType,
      searchText: `${path}\n${project.title}`,
      metadata: {
        embedUrl: input.streamEmbedUrl,
        playbackUrl: input.streamPlaybackUrl,
      },
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [projectEntries.projectId, projectEntries.path],
      set: {
        kind: "render",
        artifactRole: "render",
        storageProvider: "bunny-stream",
        storageKey: input.storageKey,
        streamLibraryId: input.streamLibraryId,
        streamVideoId: input.streamVideoId,
        contentType: input.contentType,
        deletedAt: null,
        updatedById: context.user.id,
        updatedAt: new Date(),
      },
    });
  await createDb(env).insert(projectEntryVersions).values({
    id: crypto.randomUUID(),
    entryId,
    projectId: project.id,
    organizationId: context.organization.id,
    createdById: context.user.id,
    path,
    kind: "render",
    artifactRole: "render",
    storageProvider: "bunny-stream",
    storageKey: input.storageKey,
    contentType: input.contentType,
    changeKind: "render",
    metadata: {
      streamLibraryId: input.streamLibraryId,
      streamVideoId: input.streamVideoId,
      embedUrl: input.streamEmbedUrl,
      playbackUrl: input.streamPlaybackUrl,
    },
  });
}

async function restoreEntryVersion(
  env: WorkerEnv,
  context: AppAuthContext,
  project: typeof projects.$inferSelect,
  version: typeof projectEntryVersions.$inferSelect,
  changeKind: string,
): Promise<void> {
  if (version.kind !== "text" || version.textContent == null) return;
  await upsertProjectFile(createDb(env), context.organization.id, project.id, version.path, version.textContent);
  await recordProjectTextEntry(env, context, project, version.path, version.textContent, changeKind);
  if (version.path === "index.html") {
    await createDb(env)
      .update(projects)
      .set({ currentHtml: version.textContent, updatedAt: new Date() })
      .where(eq(projects.id, project.id));
  }
}

async function handleAppApi(
  env: WorkerEnv,
  req: Request,
  pathname: string,
): Promise<Response | null> {
  if (!pathname.startsWith("/api/")) return null;
  if (pathname === "/api/config" || pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    return null;
  }
  if (pathname === "/api/render" || pathname === "/api/generate" || pathname === "/api/preview") {
    return null;
  }

  const auth = await protectedContext(req, env);
  if (auth instanceof Response) return auth;

  try {
    if (pathname === "/api/me" && req.method === "GET") {
      return Response.json(auth);
    }

    if (pathname === "/api/profile" && req.method === "GET") {
      return Response.json(auth);
    }
    if (pathname === "/api/profile" && req.method === "PATCH") {
      return await handleProfileUpdate(env, req, auth);
    }
    if (pathname === "/api/profile/password" && req.method === "POST") {
      return await handlePasswordChange(env, req);
    }

    if (pathname === "/api/admin/organizations") {
      assertAdmin(auth);
      if (req.method === "GET") return await handleListOrganizations(env);
      if (req.method === "POST") return await handleCreateOrganization(env, req);
    }

    if (pathname === "/api/admin/users") {
      assertAdmin(auth);
      if (req.method === "GET") return await handleListUsers(env);
      if (req.method === "POST") return await handleCreateUser(env, req);
    }

    const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (adminUserMatch && req.method === "PATCH") {
      assertAdmin(auth);
      return await handleUpdateUserLock(env, req, adminUserMatch[1]);
    }

    if (pathname === "/api/projects") {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      if (req.method === "GET") return await handleListProjects(env, auth);
      if (req.method === "POST") return await handleCreateProject(env, req, auth);
    }

    if (pathname === "/api/projects/search" && req.method === "GET") {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      return await handleProjectSearch(env, req, auth);
    }

    const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch) {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      if (req.method === "GET") return await handleGetProject(env, auth, projectMatch[1]);
      if (req.method === "PATCH") return await handleUpdateProject(env, req, auth, projectMatch[1]);
    }

    const projectPreviewMatch = pathname.match(/^\/api\/projects\/([^/]+)\/preview$/);
    if (projectPreviewMatch && req.method === "GET") {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      return await handleProjectPreview(env, auth, projectPreviewMatch[1]);
    }

    const projectRendersMatch = pathname.match(/^\/api\/projects\/([^/]+)\/renders$/);
    if (projectRendersMatch && req.method === "GET") {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      return await handleListProjectRenders(env, auth, projectRendersMatch[1]);
    }

    const projectShareMatch = pathname.match(/^\/api\/projects\/([^/]+)\/share$/);
    if (projectShareMatch) {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      if (req.method === "GET") return await handleGetProjectShare(env, auth, projectShareMatch[1]);
      if (req.method === "PATCH") return await handleUpdateProjectShare(env, req, auth, projectShareMatch[1]);
    }

    const projectMembersMatch = pathname.match(/^\/api\/projects\/([^/]+)\/members(?:\/([^/]+))?$/);
    if (projectMembersMatch) {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      if (req.method === "GET" && !projectMembersMatch[2]) {
        return await handleListProjectMembers(env, auth, projectMembersMatch[1]);
      }
      if (req.method === "POST" && !projectMembersMatch[2]) {
        return await handleAddProjectMember(env, req, auth, projectMembersMatch[1]);
      }
      if (req.method === "DELETE" && projectMembersMatch[2]) {
        return await handleRemoveProjectMember(env, auth, projectMembersMatch[1], projectMembersMatch[2]);
      }
    }

    const projectVersionsMatch = pathname.match(/^\/api\/projects\/([^/]+)\/versions$/);
    if (projectVersionsMatch && req.method === "GET") {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      return await handleListProjectVersions(env, req, auth, projectVersionsMatch[1]);
    }

    const projectVersionRestoreMatch = pathname.match(/^\/api\/projects\/([^/]+)\/versions\/([^/]+)\/restore$/);
    if (projectVersionRestoreMatch && req.method === "POST") {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      return await handleRestoreProjectVersion(env, auth, projectVersionRestoreMatch[1], projectVersionRestoreMatch[2]);
    }

    const projectSnapshotsMatch = pathname.match(/^\/api\/projects\/([^/]+)\/snapshots$/);
    if (projectSnapshotsMatch && req.method === "GET") {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      return await handleListProjectSnapshots(env, auth, projectSnapshotsMatch[1]);
    }

    const projectSnapshotRestoreMatch = pathname.match(/^\/api\/projects\/([^/]+)\/snapshots\/([^/]+)\/restore$/);
    if (projectSnapshotRestoreMatch && req.method === "POST") {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      return await handleRestoreProjectSnapshot(env, auth, projectSnapshotRestoreMatch[1], projectSnapshotRestoreMatch[2]);
    }

    // Multi-file Studio file/asset/preview-subpath routes (D1 + R2).
    if (/^\/api\/projects\/[^/]+\/(files|assets|duplicate-file|preview\/)/.test(pathname)) {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      const studioResp = await handleStudioFilesApi(env, req, pathname, auth);
      if (studioResp) return studioResp;
    }

    const projectPublishMatch = pathname.match(/^\/api\/projects\/([^/]+)\/publish$/);
    if (projectPublishMatch && req.method === "POST") {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      return await handlePublishProject(env, req, auth, projectPublishMatch[1]);
    }

    if (pathname === "/api/catalog" && req.method === "GET") {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      return await handleCatalog(env, auth);
    }

    const publishedMatch = pathname.match(/^\/api\/published\/([^/]+)$/);
    if (publishedMatch && req.method === "DELETE") {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      return await handleUnpublish(env, auth, publishedMatch[1]);
    }

    const remixMatch = pathname.match(/^\/api\/published\/([^/]+)\/remix$/);
    if (remixMatch && req.method === "POST") {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      return await handleRemix(env, auth, remixMatch[1]);
    }

    const renderPlaybackMatch = pathname.match(/^\/api\/renders\/([^/]+)$/);
    if (renderPlaybackMatch && req.method === "GET") {
      const tenant = requireTenantOrganization(auth);
      if (tenant) return tenant;
      return await handleRenderPlayback(env, auth, renderPlaybackMatch[1]);
    }
  } catch (err) {
    if (err instanceof AuthRequiredError || err instanceof ForbiddenError) {
      return jsonError(err.message, err.status);
    }
    const status = typeof (err as { status?: unknown }).status === "number" ? (err as { status: number }).status : 500;
    return jsonError(msg(err), status);
  }

  return null;
}

async function handleProfileUpdate(
  env: WorkerEnv,
  req: Request,
  context: AppAuthContext,
): Promise<Response> {
  const body = await readJson<{ name?: string }>(req);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1) return jsonError("name is required", 400);

  const updated = await createDb(env)
    .update(users)
    .set({ name, updatedAt: new Date() })
    .where(eq(users.id, context.user.id))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    });

  return Response.json({ user: updated[0], organization: context.organization });
}

async function handlePasswordChange(env: WorkerEnv, req: Request): Promise<Response> {
  const body = await readJson<{ currentPassword?: string; newPassword?: string }>(req);
  if (!body.currentPassword || !body.newPassword) {
    return jsonError("currentPassword and newPassword are required", 400);
  }
  await createAuth(env).api.changePassword({
    headers: req.headers,
    body: {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      revokeOtherSessions: true,
    },
  });
  return Response.json({ ok: true });
}

async function handleListOrganizations(env: WorkerEnv): Promise<Response> {
  const rows = await createDb(env)
    .select()
    .from(organizations)
    .orderBy(organizations.name);
  return Response.json({ organizations: rows });
}

async function handleCreateOrganization(env: WorkerEnv, req: Request): Promise<Response> {
  const body = await readJson<{ name?: string }>(req);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return jsonError("organization name is required", 400);
  const org = await createOrganization(env, name);
  return Response.json({ organization: org }, { status: 201 });
}

async function handleListUsers(env: WorkerEnv): Promise<Response> {
  const rows = await createDb(env)
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      banned: users.banned,
      organizationId: organizations.id,
      organizationName: organizations.name,
    })
    .from(users)
    .leftJoin(organizationMemberships, eq(users.id, organizationMemberships.userId))
    .leftJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
    .orderBy(users.email);
  return Response.json({ users: rows });
}

async function handleCreateUser(env: WorkerEnv, req: Request): Promise<Response> {
  const body = await readJson<{
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    organizationId?: string;
    organizationName?: string;
  }>(req);

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!name || !email || !password) return jsonError("name, email, and password are required", 400);

  const organization = body.organizationId
    ? await getOrganization(env, body.organizationId)
    : await createOrganization(env, body.organizationName?.trim() || "");
  if (!organization) return jsonError("organization is required", 400);

  const created = (await createAuth(env).api.createUser({
    body: {
      email,
      password,
      name,
      role: body.role === "admin" ? "admin" : "user",
    },
  } as never)) as unknown as { user: { id: string } };

  await createDb(env).insert(organizationMemberships).values({
    id: crypto.randomUUID(),
    organizationId: organization.id,
    userId: created.user.id,
    organizationRole: "member",
  });

  return Response.json({ user: created.user, organization }, { status: 201 });
}

async function handleUpdateUserLock(
  env: WorkerEnv,
  req: Request,
  userId: string,
): Promise<Response> {
  const body = await readJson<{ locked?: boolean }>(req);
  const locked = body.locked === true;
  const db = createDb(env);
  const updated = await db
    .update(users)
    .set({
      banned: locked,
      banReason: locked ? "Locked by administrator" : null,
      banExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      banned: users.banned,
    });
  if (!updated[0]) return jsonError("user not found", 404);
  if (locked) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }
  return Response.json({ user: updated[0] });
}

async function handleListProjects(
  env: WorkerEnv,
  context: AppAuthContext,
): Promise<Response> {
  const db = createDb(env);
  if (isOrganizationAdmin(context)) {
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, context.organization.id))
      .orderBy(desc(projects.updatedAt));
    return Response.json({ projects: rows });
  }
  const rows = await db
    .select({ project: projects })
    .from(projects)
    .leftJoin(
      projectMembers,
      and(eq(projectMembers.projectId, projects.id), eq(projectMembers.userId, context.user.id)),
    )
    .where(
      and(
        eq(projects.organizationId, context.organization.id),
        or(
          eq(projects.ownerId, context.user.id),
          eq(projects.visibility, "organization"),
          eq(projectMembers.userId, context.user.id),
        ),
      ),
    )
    .orderBy(desc(projects.updatedAt));
  return Response.json({ projects: rows.map((row) => row.project) });
}

async function handleCreateProject(
  env: WorkerEnv,
  req: Request,
  context: AppAuthContext,
): Promise<Response> {
  const body = await readJson<{
    title?: string;
    prompt?: string;
    html?: string;
    durationSec?: number;
  }>(req);
  const project = await createProject(env, context, {
    title: body.title || titleFromPrompt(body.prompt || "Untitled project"),
    prompt: body.prompt,
    html: body.html,
    durationSec: normalizedDuration(body.durationSec) ?? 6,
  });
  return Response.json({ project }, { status: 201 });
}

async function handleGetProject(
  env: WorkerEnv,
  context: AppAuthContext,
  projectId: string,
): Promise<Response> {
  const project = await requireProjectAccess(context, projectId, env);
  return Response.json({ project });
}

async function handleProjectSearch(
  env: WorkerEnv,
  req: Request,
  context: AppAuthContext,
): Promise<Response> {
  const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ projects: [], entries: [] });
  const like = `%${query}%`;
  const db = createDb(env);
  const projectRows = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.organizationId, context.organization.id),
        or(ilike(projects.title, like), ilike(projects.prompt, like)),
      ),
    )
    .orderBy(desc(projects.updatedAt));
  const entryRows = await db
    .select()
    .from(projectEntries)
    .where(
      and(
        eq(projectEntries.organizationId, context.organization.id),
        isNull(projectEntries.deletedAt),
        or(ilike(projectEntries.path, like), ilike(projectEntries.searchText, like), ilike(projectEntries.artifactRole, like)),
      ),
    )
    .orderBy(desc(projectEntries.updatedAt));

  const projectsOut = [];
  for (const project of projectRows) {
    try {
      await requireProjectAccess(context, project.id, env);
      projectsOut.push(project);
    } catch {
      // Omit inaccessible matches.
    }
  }

  const entriesOut = [];
  const checkedProjects = new Map<string, boolean>();
  for (const entry of entryRows) {
    let allowed = checkedProjects.get(entry.projectId);
    if (allowed == null) {
      try {
        await requireProjectAccess(context, entry.projectId, env);
        allowed = true;
      } catch {
        allowed = false;
      }
      checkedProjects.set(entry.projectId, allowed);
    }
    if (allowed) entriesOut.push(entry);
  }
  return Response.json({ projects: projectsOut, entries: entriesOut });
}

/**
 * Serve a project's composition as a standalone document for the Studio
 * preview iframe (`Player` directUrl). Generated compositions already embed
 * the GSAP + HyperFrames runtime, so no injection is needed. Organization
 * access is enforced by requireProjectAccess.
 */
async function handleProjectPreview(
  env: WorkerEnv,
  context: AppAuthContext,
  projectId: string,
): Promise<Response> {
  await requireProjectAccess(context, projectId, env);
  return renderProjectPreview(env, createDb(env), context.organization.id, projectId);
}

/**
 * List a project's renders for the Studio renders panel, scoped to the user's
 * organization (requireProjectAccess enforces ownership).
 */
async function handleListProjectRenders(
  env: WorkerEnv,
  context: AppAuthContext,
  projectId: string,
): Promise<Response> {
  await requireProjectAccess(context, projectId, env, "render");
  const rows = await createDb(env)
    .select()
    .from(renders)
    .where(
      and(eq(renders.projectId, projectId), eq(renders.organizationId, context.organization.id)),
    )
    .orderBy(desc(renders.createdAt));
  const items = rows.map((r) => ({
    id: r.id,
    url: r.storageProvider === "bunny-stream" ? `/api/renders/${r.id}` : `/r/${r.r2Key}`,
    format: r.format || r.sourceType,
    streamStatus: r.streamStatus,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
  return Response.json({ renders: items });
}

async function handleGetProjectShare(
  env: WorkerEnv,
  context: AppAuthContext,
  projectId: string,
): Promise<Response> {
  const project = await requireProjectAccess(context, projectId, env);
  const members = await createDb(env)
    .select({
      id: projectMembers.id,
      userId: projectMembers.userId,
      role: projectMembers.role,
      createdAt: projectMembers.createdAt,
    })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(desc(projectMembers.createdAt));
  return Response.json({
    share: {
      visibility: project.visibility,
      ownerId: project.ownerId,
      canManage: project.ownerId === context.user.id || isOrganizationAdmin(context),
      members,
    },
  });
}

async function handleUpdateProjectShare(
  env: WorkerEnv,
  req: Request,
  context: AppAuthContext,
  projectId: string,
): Promise<Response> {
  const project = await requireProjectAccess(context, projectId, env, "share");
  const body = await readJson<{ visibility?: string }>(req);
  const visibility = body.visibility === "organization" ? "organization" : body.visibility === "private" ? "private" : null;
  if (!visibility) return jsonError("visibility must be private or organization", 400);

  const db = createDb(env);
  const rows = await db
    .update(projects)
    .set({
      visibility,
      sharedById: visibility === "organization" ? context.user.id : null,
      sharedAt: visibility === "organization" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();
  await db.insert(projectPermissionAudits).values({
    id: crypto.randomUUID(),
    projectId,
    organizationId: context.organization.id,
    actorId: context.user.id,
    action: "visibility",
    previousValue: project.visibility,
    newValue: visibility,
  });
  await createProjectSnapshot(env, context, projectId, "share");
  return Response.json({ project: rows[0] });
}

async function handleListProjectMembers(
  env: WorkerEnv,
  context: AppAuthContext,
  projectId: string,
): Promise<Response> {
  await requireProjectAccess(context, projectId, env);
  const members = await createDb(env)
    .select({
      id: projectMembers.id,
      userId: projectMembers.userId,
      role: projectMembers.role,
      createdAt: projectMembers.createdAt,
      updatedAt: projectMembers.updatedAt,
    })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(desc(projectMembers.updatedAt));
  return Response.json({ members });
}

async function handleAddProjectMember(
  env: WorkerEnv,
  req: Request,
  context: AppAuthContext,
  projectId: string,
): Promise<Response> {
  await requireProjectAccess(context, projectId, env, "share");
  const body = await readJson<{ userId?: string; role?: string }>(req);
  if (!body.userId) return jsonError("userId is required", 400);
  const role = body.role === "editor" || body.role === "viewer" || body.role === "owner" ? body.role : null;
  if (!role) return jsonError("role must be owner, editor, or viewer", 400);

  const db = createDb(env);
  const membership = await db
    .select({ organizationId: organizationMemberships.organizationId })
    .from(organizationMemberships)
    .where(and(eq(organizationMemberships.userId, body.userId), eq(organizationMemberships.organizationId, context.organization.id)))
    .limit(1);
  if (!membership[0]) return jsonError("user is not in this organization", 400);

  await db
    .insert(projectMembers)
    .values({
      id: crypto.randomUUID(),
      projectId,
      organizationId: context.organization.id,
      userId: body.userId,
      role,
      invitedById: context.user.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [projectMembers.projectId, projectMembers.userId],
      set: { role, invitedById: context.user.id, updatedAt: new Date() },
    });
  await db.insert(projectPermissionAudits).values({
    id: crypto.randomUUID(),
    projectId,
    organizationId: context.organization.id,
    actorId: context.user.id,
    action: "member-upsert",
    targetUserId: body.userId,
    newValue: role,
  });
  return Response.json({ ok: true });
}

async function handleRemoveProjectMember(
  env: WorkerEnv,
  context: AppAuthContext,
  projectId: string,
  userId: string,
): Promise<Response> {
  await requireProjectAccess(context, projectId, env, "share");
  const db = createDb(env);
  await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  await db.insert(projectPermissionAudits).values({
    id: crypto.randomUUID(),
    projectId,
    organizationId: context.organization.id,
    actorId: context.user.id,
    action: "member-remove",
    targetUserId: userId,
  });
  return Response.json({ ok: true });
}

async function handleListProjectVersions(
  env: WorkerEnv,
  req: Request,
  context: AppAuthContext,
  projectId: string,
): Promise<Response> {
  await requireProjectAccess(context, projectId, env);
  const path = new URL(req.url).searchParams.get("path");
  const where = path
    ? and(
        eq(projectEntryVersions.projectId, projectId),
        eq(projectEntryVersions.organizationId, context.organization.id),
        eq(projectEntryVersions.path, normalizeProjectPath(path)),
      )
    : and(eq(projectEntryVersions.projectId, projectId), eq(projectEntryVersions.organizationId, context.organization.id));
  const versions = await createDb(env)
    .select()
    .from(projectEntryVersions)
    .where(where)
    .orderBy(desc(projectEntryVersions.createdAt));
  return Response.json({ versions });
}

async function handleRestoreProjectVersion(
  env: WorkerEnv,
  context: AppAuthContext,
  projectId: string,
  versionId: string,
): Promise<Response> {
  const project = await requireProjectAccess(context, projectId, env, "restore");
  const version = await createDb(env)
    .select()
    .from(projectEntryVersions)
    .where(and(eq(projectEntryVersions.id, versionId), eq(projectEntryVersions.projectId, projectId)))
    .limit(1);
  if (!version[0]) return jsonError("version not found", 404);
  await restoreEntryVersion(env, context, project, version[0], "restore-version");
  return Response.json({ ok: true });
}

async function handleListProjectSnapshots(
  env: WorkerEnv,
  context: AppAuthContext,
  projectId: string,
): Promise<Response> {
  await requireProjectAccess(context, projectId, env);
  const snapshots = await createDb(env)
    .select()
    .from(projectSnapshots)
    .where(and(eq(projectSnapshots.projectId, projectId), eq(projectSnapshots.organizationId, context.organization.id)))
    .orderBy(desc(projectSnapshots.createdAt));
  return Response.json({ snapshots });
}

async function handleRestoreProjectSnapshot(
  env: WorkerEnv,
  context: AppAuthContext,
  projectId: string,
  snapshotId: string,
): Promise<Response> {
  const project = await requireProjectAccess(context, projectId, env, "restore");
  const snapshots = await createDb(env)
    .select()
    .from(projectSnapshots)
    .where(and(eq(projectSnapshots.id, snapshotId), eq(projectSnapshots.projectId, projectId)))
    .limit(1);
  const snapshot = snapshots[0];
  if (!snapshot) return jsonError("snapshot not found", 404);
  for (const item of snapshot.manifest ?? []) {
    const versions = await createDb(env)
      .select()
      .from(projectEntryVersions)
      .where(and(eq(projectEntryVersions.id, item.versionId), eq(projectEntryVersions.projectId, projectId)))
      .limit(1);
    if (versions[0]) await restoreEntryVersion(env, context, project, versions[0], "restore-snapshot");
  }
  await createProjectSnapshot(env, context, projectId, "restore");
  return Response.json({ ok: true });
}

async function handleUpdateProject(
  env: WorkerEnv,
  req: Request,
  context: AppAuthContext,
  projectId: string,
): Promise<Response> {
  const project = await requireProjectAccess(context, projectId, env, "edit");
  const body = await readJson<{
    title?: string;
    prompt?: string;
    html?: string;
    durationSec?: number;
  }>(req);
  const update: Partial<typeof projects.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (typeof body.title === "string") update.title = body.title.trim() || "Untitled project";
  if (typeof body.prompt === "string") update.prompt = body.prompt;
  if (typeof body.html === "string") update.currentHtml = body.html;
  if (typeof body.durationSec === "number") update.durationSec = normalizedDuration(body.durationSec) ?? 6;

  const rows = await createDb(env)
    .update(projects)
    .set(update)
    .where(eq(projects.id, projectId))
    .returning();

  if (typeof body.html === "string") {
    await createDb(env).insert(projectVersions).values({
      id: crypto.randomUUID(),
      projectId,
      organizationId: context.organization.id,
      createdById: context.user.id,
      sourceKind: "studio-edit",
      prompt: body.prompt,
      html: body.html,
    });
    // Keep the multi-file index.html in sync with the currentHtml mirror.
    await upsertProjectFile(createDb(env), context.organization.id, projectId, "index.html", body.html);
    await recordProjectTextEntry(env, context, project, "index.html", body.html, "studio-edit");
  }

  return Response.json({ project: rows[0] });
}

async function handlePublishProject(
  env: WorkerEnv,
  req: Request,
  context: AppAuthContext,
  projectId: string,
): Promise<Response> {
  const project = await requireProjectAccess(context, projectId, env, "publish");
  const body = await readJson<{
    title?: string;
    description?: string;
    posterKey?: string;
  }>(req);
  if (!project.currentHtml) return jsonError("project has no composition HTML", 400);
  await createProjectSnapshot(env, context, projectId, "publish");
  const row = await createDb(env)
    .insert(publishedProjects)
    .values({
      id: crypto.randomUUID(),
      organizationId: context.organization.id,
      projectId,
      title: body.title?.trim() || project.title,
      description: body.description?.trim() || null,
      posterKey: body.posterKey || null,
      durationSec: project.durationSec,
      sourceHtml: project.currentHtml,
      publishedById: context.user.id,
    })
    .returning();
  return Response.json({ publishedProject: row[0] }, { status: 201 });
}

async function handleCatalog(env: WorkerEnv, context: AppAuthContext): Promise<Response> {
  const published = await createDb(env)
    .select()
    .from(publishedProjects)
    .where(
      and(
        eq(publishedProjects.organizationId, context.organization.id),
        isNull(publishedProjects.unpublishedAt),
      ),
    )
    .orderBy(desc(publishedProjects.publishedAt));
  const examples = seededExamples();
  return Response.json({
    catalogCount: examples.length + published.length,
    examples,
    publishedProjects: published,
  });
}

async function handleRemix(
  env: WorkerEnv,
  context: AppAuthContext,
  publishedProjectId: string,
): Promise<Response> {
  const published = await requirePublishedProjectAccess(context, publishedProjectId, env);
  if (published.unpublishedAt) throw new ForbiddenError("published project access denied");
  const project = await createProject(env, context, {
    title: `${published.title} Remix`,
    html: published.sourceHtml,
    durationSec: published.durationSec,
  });
  return Response.json({ project }, { status: 201 });
}

async function handleUnpublish(
  env: WorkerEnv,
  context: AppAuthContext,
  publishedProjectId: string,
): Promise<Response> {
  await requirePublishedProjectAccess(context, publishedProjectId, env);
  const rows = await createDb(env)
    .update(publishedProjects)
    .set({ unpublishedAt: new Date() })
    .where(eq(publishedProjects.id, publishedProjectId))
    .returning();
  return Response.json({ publishedProject: rows[0] });
}

async function upsertGeneratedProject(
  env: WorkerEnv,
  context: AppAuthContext,
  body: GenerateRequestBody,
  html: string,
) {
  const durationSec = normalizedDuration(body.durationSec) ?? 6;
  if (body.projectId) {
    const project = await requireProjectAccess(context, body.projectId, env, "edit");
    const rows = await createDb(env)
      .update(projects)
      .set({
        prompt: body.prompt,
        currentHtml: html,
        durationSec,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, body.projectId))
      .returning();
    await createDb(env).insert(projectVersions).values({
      id: crypto.randomUUID(),
      projectId: body.projectId,
      organizationId: context.organization.id,
      createdById: context.user.id,
      sourceKind: "generated-html",
      prompt: body.prompt,
      html,
    });
    await upsertProjectFile(createDb(env), context.organization.id, body.projectId, "index.html", html);
    await recordProjectTextEntry(env, context, project, "index.html", html, "generated-html");
    await createProjectSnapshot(env, context, body.projectId, "generate");
    return rows[0];
  }
  return createProject(env, context, {
    title: body.title || titleFromPrompt(body.prompt || "Generated project"),
    prompt: body.prompt,
    html,
    durationSec,
  });
}

async function createProject(
  env: WorkerEnv,
  context: AppAuthContext,
  input: {
    title: string;
    prompt?: string;
    html?: string;
    durationSec: number;
  },
) {
  const db = createDb(env);
  const projectId = crypto.randomUUID();
  const rows = await db
    .insert(projects)
    .values({
      id: projectId,
      organizationId: context.organization.id,
      ownerId: context.user.id,
      title: input.title.trim() || "Untitled project",
      prompt: input.prompt || null,
      currentHtml: input.html || null,
      durationSec: input.durationSec,
      visibility: "private",
    })
    .returning();
  await db.insert(projectMembers).values({
    id: crypto.randomUUID(),
    projectId,
    organizationId: context.organization.id,
    userId: context.user.id,
    role: "owner",
    invitedById: context.user.id,
  });

  if (input.html) {
    await db.insert(projectVersions).values({
      id: crypto.randomUUID(),
      projectId,
      organizationId: context.organization.id,
      createdById: context.user.id,
      sourceKind: "generated-html",
      prompt: input.prompt || null,
      html: input.html,
    });
    await upsertProjectFile(db, context.organization.id, projectId, "index.html", input.html);
    await recordProjectTextEntry(env, context, rows[0], "index.html", input.html, "generated-html");
    await createProjectSnapshot(env, context, projectId, "generate");
  }

  return rows[0];
}

async function getOrganization(env: WorkerEnv, organizationId: string) {
  const rows = await createDb(env)
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return rows[0] ?? null;
}

async function createOrganization(env: WorkerEnv, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const rows = await createDb(env)
    .insert(organizations)
    .values({
      id: crypto.randomUUID(),
      name: trimmed,
      slug: `${slugify(trimmed)}-${crypto.randomUUID().slice(0, 8)}`,
    })
    .returning();
  return rows[0];
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function isDashAuthPath(pathname: string) {
  return pathname === "/api/auth/dash" || pathname.startsWith("/api/auth/dash/");
}

function dashCorsHeaders(req: Request) {
  const headers = new Headers();
  addDashCorsHeaders(req, headers);
  return headers;
}

function addDashCorsHeaders(req: Request, headers: Headers) {
  if (req.headers.get("origin") !== DASH_ORIGIN) return;
  headers.set("access-control-allow-origin", DASH_ORIGIN);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "authorization, content-type");
  headers.set("access-control-max-age", "86400");
  headers.set("vary", appendVary(headers.get("vary"), "Origin"));
}

function appendVary(existing: string | null, value: string) {
  if (!existing) return value;
  const parts = existing.split(",").map((part) => part.trim().toLowerCase());
  return parts.includes(value.toLowerCase()) ? existing : `${existing}, ${value}`;
}

async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("invalid JSON body");
  }
}

async function protectedContext(
  req: Request,
  env: WorkerEnv,
): Promise<AppAuthContext | Response> {
  try {
    return await requireAuthContext(req, env);
  } catch (err) {
    if (err instanceof AuthRequiredError || err instanceof ForbiddenError) {
      return jsonError(err.message, err.status);
    }
    return jsonError(`auth unavailable: ${msg(err)}`, 500);
  }
}

function requireTenantOrganization(context: AppAuthContext): Response | null {
  if (!context.organization.isBootstrap) return null;
  return jsonError(
    "Create a real organization and assign your admin user before using tenant workspace data.",
    403,
  );
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function normalizedDuration(durationSec: unknown): number | undefined {
  if (typeof durationSec !== "number" || Number.isNaN(durationSec)) return undefined;
  return Math.max(1, Math.min(120, Math.round(durationSec)));
}

function titleFromPrompt(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 7).join(" ");
  return words || "Untitled project";
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "organization"
  );
}

function projectEntryId(projectId: string, path: string): string {
  return `${projectId}:${path}`;
}

function artifactRoleForPath(path: string): string {
  if (/^compositions\//.test(path)) return "composition";
  if (/^assets\//.test(path)) return "asset";
  if (/^transcripts?\//.test(path)) return "transcript";
  if (/^snapshots?\//.test(path)) return "snapshot";
  if (/^renders?\//.test(path)) return "render";
  if (/storyboard/i.test(path)) return "storyboard";
  if (/script/i.test(path)) return "script";
  return "source";
}

function mimeForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html" || ext === "htm") return "text/html; charset=utf-8";
  if (ext === "css") return "text/css; charset=utf-8";
  if (ext === "js" || ext === "mjs") return "text/javascript; charset=utf-8";
  if (ext === "json") return "application/json; charset=utf-8";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  return "application/octet-stream";
}

function seededExamples() {
  return [
    {
      id: "bundled-cloudflare-intro",
      title: "Cloudflare Render Intro",
      description: "Bundled starter composition for the Motion Frames render pipeline.",
      durationSec: 6,
      width: 1920,
      height: 1080,
      source: "bundled",
    },
  ];
}
