import { and, asc, eq } from "drizzle-orm";

import { createDb } from "../db";
import { projectAssets, projectFiles, projects } from "../db/schema";
import { requireProjectAccess, type AppAuthContext } from "../lib/auth-context";
import type { WorkerEnv } from "./render-api";

const PREVIEW_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "content-security-policy": "frame-ancestors 'self'; object-src 'none'",
};

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ASSET_BYTES = 25 * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
};

function mimeForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

function isTextPath(path: string): boolean {
  return /\.(html?|css|js|mjs|json|txt|md|svg|xml)$/i.test(path);
}

function assetKey(orgId: string, projectId: string, path: string): string {
  return `assets/${orgId}/${projectId}/${path}`;
}

/**
 * Multi-file Studio API reimplemented on the Worker against D1 (project_files)
 * and R2 (project_assets). Uses our own simple JSON contract — the client uses
 * the studio package's presentational components, not its built-in fetching.
 *
 * Returns a Response for matched routes, or null if the path is not a
 * studio-files route (so the caller can continue dispatching). The caller has
 * already authenticated `context`; organization ownership is enforced here via
 * requireProjectAccess. Throws ForbiddenError/AuthRequiredError, which the
 * caller's try/catch converts to JSON errors.
 */
export async function handleStudioFilesApi(
  env: WorkerEnv,
  req: Request,
  pathname: string,
  context: AppAuthContext,
): Promise<Response | null> {
  const base = pathname.match(/^\/api\/projects\/([^/]+)\/(files|assets|duplicate-file|preview)(?:\/(.*))?$/);
  if (!base) return null;
  const projectId = decodeURIComponent(base[1]);
  const kind = base[2];
  const rest = base[3] ? decodeURIComponent(base[3]) : "";
  const { method } = req;

  // Enforce organization ownership (throws on cross-org).
  await requireProjectAccess(context, projectId, env);
  const orgId = context.organization.id;
  const db = createDb(env);

  if (kind === "files") {
    if (!rest) {
      if (method === "GET") {
        const rows = await db
          .select({ path: projectFiles.path })
          .from(projectFiles)
          .where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.organizationId, orgId)))
          .orderBy(asc(projectFiles.path));
        return Response.json({ files: rows.map((r) => r.path) });
      }
      if (method === "POST") {
        const body = (await req.json().catch(() => ({}))) as { path?: string; content?: string };
        if (!body.path) return jsonError("missing path", 400);
        return await upsertFile(db, orgId, projectId, body.path, body.content ?? "");
      }
      return jsonError("method not allowed", 405);
    }
    if (method === "GET") {
      const rows = await db
        .select({ path: projectFiles.path, content: projectFiles.content })
        .from(projectFiles)
        .where(
          and(
            eq(projectFiles.projectId, projectId),
            eq(projectFiles.organizationId, orgId),
            eq(projectFiles.path, rest),
          ),
        )
        .limit(1);
      if (!rows[0]) return jsonError("file not found", 404);
      return Response.json(rows[0]);
    }
    if (method === "PUT" || method === "PATCH") {
      const body = (await req.json().catch(() => ({}))) as { content?: string };
      return await upsertFile(db, orgId, projectId, rest, body.content ?? "");
    }
    if (method === "DELETE") {
      await db
        .delete(projectFiles)
        .where(
          and(
            eq(projectFiles.projectId, projectId),
            eq(projectFiles.organizationId, orgId),
            eq(projectFiles.path, rest),
          ),
        );
      return Response.json({ ok: true });
    }
    return jsonError("method not allowed", 405);
  }

  if (kind === "duplicate-file" && method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { from?: string; to?: string };
    if (!body.from || !body.to) return jsonError("missing from/to", 400);
    const rows = await db
      .select({ content: projectFiles.content })
      .from(projectFiles)
      .where(
        and(
          eq(projectFiles.projectId, projectId),
          eq(projectFiles.organizationId, orgId),
          eq(projectFiles.path, body.from),
        ),
      )
      .limit(1);
    if (!rows[0]) return jsonError("source file not found", 404);
    return await upsertFile(db, orgId, projectId, body.to, rows[0].content);
  }

  if (kind === "assets") {
    if (!rest) {
      if (method === "GET") {
        const rows = await db
          .select()
          .from(projectAssets)
          .where(and(eq(projectAssets.projectId, projectId), eq(projectAssets.organizationId, orgId)))
          .orderBy(asc(projectAssets.path));
        return Response.json({
          assets: rows.map((r) => ({
            path: r.path,
            url: `/api/projects/${encodeURIComponent(projectId)}/assets/${r.path}`,
            contentType: r.contentType,
            size: r.size,
          })),
        });
      }
      if (method === "POST") {
        const url = new URL(req.url);
        const path = url.searchParams.get("path");
        if (!path) return jsonError("missing ?path", 400);
        const bytes = new Uint8Array(await req.arrayBuffer());
        if (bytes.byteLength > MAX_ASSET_BYTES) return jsonError("asset too large", 413);
        const contentType = req.headers.get("content-type") || mimeForPath(path);
        const key = assetKey(orgId, projectId, path);
        await env.RENDERS.put(key, bytes, { httpMetadata: { contentType } });
        await db
          .insert(projectAssets)
          .values({
            id: crypto.randomUUID(),
            projectId,
            organizationId: orgId,
            path,
            r2Key: key,
            contentType,
            size: bytes.byteLength,
            createdById: context.user.id,
          })
          .onConflictDoNothing();
        return Response.json({
          path,
          url: `/api/projects/${encodeURIComponent(projectId)}/assets/${path}`,
          contentType,
          size: bytes.byteLength,
        });
      }
      return jsonError("method not allowed", 405);
    }
    if (method === "GET") {
      return await serveAsset(env, db, orgId, projectId, rest);
    }
    return jsonError("method not allowed", 405);
  }

  if (kind === "preview") {
    // Bare /preview is handled by render-api (kept for compatibility); here we
    // serve sub-paths so a `<base>`-relative composition can fetch its files and
    // assets: a stored file → its content; otherwise an asset → its bytes.
    if (method !== "GET") return jsonError("method not allowed", 405);
    if (!rest) return await renderProjectPreview(env, db, orgId, projectId);
    const target = rest.startsWith("comp/") ? rest.slice("comp/".length) : rest;
    const fileRows = await db
      .select({ content: projectFiles.content })
      .from(projectFiles)
      .where(
        and(
          eq(projectFiles.projectId, projectId),
          eq(projectFiles.organizationId, orgId),
          eq(projectFiles.path, target),
        ),
      )
      .limit(1);
    if (fileRows[0]) {
      const html = isTextPath(target) ? withBase(fileRows[0].content, projectId) : fileRows[0].content;
      return new Response(html, {
        headers: { ...PREVIEW_HEADERS, "content-type": mimeForPath(target) },
      });
    }
    return await serveAsset(env, db, orgId, projectId, target);
  }

  return null;
}

async function upsertFile(
  db: ReturnType<typeof createDb>,
  orgId: string,
  projectId: string,
  path: string,
  content: string,
): Promise<Response> {
  if (content.length > MAX_FILE_BYTES) return jsonError("file too large", 413);
  await upsertProjectFile(db, orgId, projectId, path, content);
  return Response.json({ path });
}

/**
 * Upsert a single source file (DB only, no HTTP). Used by the file API and by
 * the generate/save paths to keep the index.html file in sync with the
 * project's currentHtml mirror.
 */
export async function upsertProjectFile(
  db: ReturnType<typeof createDb>,
  orgId: string,
  projectId: string,
  path: string,
  content: string,
): Promise<void> {
  await db
    .insert(projectFiles)
    .values({
      id: crypto.randomUUID(),
      projectId,
      organizationId: orgId,
      path,
      content,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [projectFiles.projectId, projectFiles.path],
      set: { content, updatedAt: new Date() },
    });
}

async function serveAsset(
  env: WorkerEnv,
  db: ReturnType<typeof createDb>,
  orgId: string,
  projectId: string,
  path: string,
): Promise<Response> {
  const rows = await db
    .select({ r2Key: projectAssets.r2Key, contentType: projectAssets.contentType })
    .from(projectAssets)
    .where(
      and(
        eq(projectAssets.projectId, projectId),
        eq(projectAssets.organizationId, orgId),
        eq(projectAssets.path, path),
      ),
    )
    .limit(1);
  if (!rows[0]) return jsonError("asset not found", 404);
  const obj = await env.RENDERS.get(rows[0].r2Key);
  if (!obj) return jsonError("asset bytes missing", 404);
  return new Response(obj.body, {
    headers: { "content-type": rows[0].contentType, "cache-control": "private, max-age=300" },
  });
}

/**
 * Build the project's preview HTML from its index.html source file, falling
 * back to the project's currentHtml mirror when no files exist yet. A <base>
 * tag is injected so relative composition/asset references resolve against the
 * project's /preview/ route.
 */
export async function renderProjectPreview(
  env: WorkerEnv,
  db: ReturnType<typeof createDb>,
  orgId: string,
  projectId: string,
): Promise<Response> {
  const fileRows = await db
    .select({ content: projectFiles.content })
    .from(projectFiles)
    .where(
      and(
        eq(projectFiles.projectId, projectId),
        eq(projectFiles.organizationId, orgId),
        eq(projectFiles.path, "index.html"),
      ),
    )
    .limit(1);
  let html = fileRows[0]?.content;
  if (html == null) {
    const projectRows = await db
      .select({ currentHtml: projects.currentHtml })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    html = projectRows[0]?.currentHtml ?? "";
  }
  return new Response(withBase(html, projectId), { headers: PREVIEW_HEADERS });
}

function withBase(html: string, projectId: string): string {
  const base = `<base href="/api/projects/${encodeURIComponent(projectId)}/preview/">`;
  if (/<base\s/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${base}`);
  return base + html;
}
