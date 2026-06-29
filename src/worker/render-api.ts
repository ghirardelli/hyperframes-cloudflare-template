import { getContainer } from "@cloudflare/containers";
import { and, desc, eq, isNull } from "drizzle-orm";

import { createAuth } from "../auth";
import manifest from "../composition-manifest.json";
import { RenderContainer } from "../container";
import { createDb } from "../db";
import {
  organizationMemberships,
  organizations,
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
  requireAuthContext,
  requireProjectAccess,
  requirePublishedProjectAccess,
  type AppAuthContext,
  type TenantAuthEnv,
} from "../lib/auth-context";
import { DEFAULT_MODEL, generateComposition, GenerateError } from "../lib/generate";
import { handleStudioFilesApi, renderProjectPreview, upsertProjectFile } from "./studio-files-api";
import { handlePromptAgentChat } from "./prompt-agent-api";

export interface WorkerEnv extends TenantAuthEnv {
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
    const project = await requireProjectAccess(context, body.projectId, env);
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

  const key = `renders/${context.organization.id}/${Date.now()}-${crypto.randomUUID()}.${renderFormat}`;
  await env.RENDERS.put(key, containerRes.body, {
    httpMetadata: { contentType: RENDER_CONTENT_TYPES[renderFormat] ?? "video/mp4" },
  });

  await createDb(env).insert(renders).values({
    id: crypto.randomUUID(),
    projectId: body?.projectId ?? null,
    organizationId: context.organization.id,
    userId: context.user.id,
    r2Key: key,
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
  } catch (err) {
    if (err instanceof AuthRequiredError || err instanceof ForbiddenError) {
      return jsonError(err.message, err.status);
    }
    return jsonError(msg(err), 500);
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
  const rows = await createDb(env)
    .select()
    .from(projects)
    .where(eq(projects.organizationId, context.organization.id))
    .orderBy(desc(projects.updatedAt));
  return Response.json({ projects: rows });
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
  await requireProjectAccess(context, projectId, env);
  const rows = await createDb(env)
    .select()
    .from(renders)
    .where(
      and(eq(renders.projectId, projectId), eq(renders.organizationId, context.organization.id)),
    )
    .orderBy(desc(renders.createdAt));
  const items = rows.map((r) => ({
    id: r.id,
    url: `/r/${r.r2Key}`,
    format: r.sourceType,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
  return Response.json({ renders: items });
}

async function handleUpdateProject(
  env: WorkerEnv,
  req: Request,
  context: AppAuthContext,
  projectId: string,
): Promise<Response> {
  await requireProjectAccess(context, projectId, env);
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
  }

  return Response.json({ project: rows[0] });
}

async function handlePublishProject(
  env: WorkerEnv,
  req: Request,
  context: AppAuthContext,
  projectId: string,
): Promise<Response> {
  const project = await requireProjectAccess(context, projectId, env);
  const body = await readJson<{
    title?: string;
    description?: string;
    posterKey?: string;
  }>(req);
  if (!project.currentHtml) return jsonError("project has no composition HTML", 400);
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
    await requireProjectAccess(context, body.projectId, env);
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
    })
    .returning();

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
