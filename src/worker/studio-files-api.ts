import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createDb } from "../db";
import {
  projectAssets,
  projectEntries,
  projectEntryVersions,
  projectFiles,
  projectSnapshots,
  projects,
} from "../db/schema";
import { requireProjectAccess, type AppAuthContext } from "../lib/auth-context";
import {
  MATERIALIZED_COMPONENT_MANIFEST_PATH,
  materializedComponentManifestSchema,
  type MaterializedComponentManifest,
} from "../lib/hyperframe-component-materializer-schema";
import { normalizeProjectPath, promptAgentAssetPath } from "../lib/project-paths";
import { projectWorkspaceKey, readProjectObject, writeProjectObject } from "../lib/project-storage";
import type { WorkerEnv } from "./render-api";

const PREVIEW_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "content-security-policy": "frame-ancestors 'self'; object-src 'none'",
};

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const PROMPT_AGENT_ATTACHMENT_TYPES = [
  /^image\//i,
  /^video\//i,
  /^audio\//i,
  /^font\//i,
  /^text\//i,
  /^application\/(pdf|json|zip|x-zip-compressed|octet-stream)$/i,
];

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

/**
 * Multi-file Studio API reimplemented on the Worker against D1 (project_files)
 * and provider-backed project entries. Uses our own simple JSON contract — the
 * client uses the studio package's presentational components, not its built-in
 * fetching.
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
  const base = pathname.match(/^\/api\/projects\/([^/]+)\/(files|assets|agent-assets|duplicate-file|preview)(?:\/(.*))?$/);
  if (!base) return null;
  const projectId = decodeURIComponent(base[1]);
  const kind = base[2];
  const rest = base[3] ? decodeURIComponent(base[3]) : "";
  const { method } = req;

  const permission = method === "GET" ? "read" : "edit";
  const project = await requireProjectAccess(context, projectId, env, permission);
  const orgId = context.organization.id;
  const db = createDb(env);

  if (kind === "files") {
    if (!rest) {
      if (method === "GET") {
        const entries = await db
          .select({
            path: projectEntries.path,
            kind: projectEntries.kind,
            artifactRole: projectEntries.artifactRole,
            contentType: projectEntries.contentType,
            size: projectEntries.size,
            updatedAt: projectEntries.updatedAt,
          })
          .from(projectEntries)
          .where(
            and(
              eq(projectEntries.projectId, projectId),
              eq(projectEntries.organizationId, orgId),
              isNull(projectEntries.deletedAt),
            ),
          )
          .orderBy(asc(projectEntries.path));
        if (entries.length) {
          const registryFiles = await loadRegistryManagedFiles(db, orgId, projectId);
          return Response.json({
            files: entries.filter((entry) => entry.kind === "text").map((entry) => entry.path),
            entries: entries.map((entry) => annotateRegistryManagedEntry(entry, registryFiles)),
          });
        }
        const registryFiles = await loadRegistryManagedFiles(db, orgId, projectId);
        const rows = await db
          .select({ path: projectFiles.path })
          .from(projectFiles)
          .where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.organizationId, orgId)))
          .orderBy(asc(projectFiles.path));
        return Response.json({
          files: rows.map((r) => r.path),
          entries: rows.map((r) =>
            annotateRegistryManagedEntry(
              {
                path: r.path,
                kind: "text",
                artifactRole: artifactRoleForPath(r.path),
              },
              registryFiles,
            ),
          ),
        });
      }
      if (method === "POST") {
        const body = (await req.json().catch(() => ({}))) as { path?: string; content?: string };
        if (!body.path) return jsonError("missing path", 400);
        return await upsertFile(db, context, project, body.path, body.content ?? "", "create");
      }
      return jsonError("method not allowed", 405);
    }
    const path = safePath(rest);
    if (method === "GET") {
      const rows = await db
        .select({ path: projectFiles.path, content: projectFiles.content })
        .from(projectFiles)
        .where(
          and(
            eq(projectFiles.projectId, projectId),
            eq(projectFiles.organizationId, orgId),
            eq(projectFiles.path, path),
          ),
        )
        .limit(1);
      if (!rows[0]) return jsonError("file not found", 404);
      return Response.json(rows[0]);
    }
    if (method === "PUT" || method === "PATCH") {
      const body = (await req.json().catch(() => ({}))) as { content?: string; to?: string };
      if (await isRegistryManagedPath(db, orgId, projectId, path)) {
        return jsonError("registry-managed component files are read-only; duplicate the file to customize it", 409);
      }
      if (method === "PATCH" && body.to) {
        const to = safePath(body.to);
        let content = body.content;
        if (content == null) {
          const sourceRows = await db
            .select({ content: projectFiles.content })
            .from(projectFiles)
            .where(
              and(
                eq(projectFiles.projectId, projectId),
                eq(projectFiles.organizationId, orgId),
                eq(projectFiles.path, path),
              ),
            )
            .limit(1);
          content = sourceRows[0]?.content;
        }
        if (content == null) return jsonError("source file not found", 404);
        await upsertFile(db, context, project, to, content, "move");
        await db
          .delete(projectFiles)
          .where(
            and(
              eq(projectFiles.projectId, projectId),
              eq(projectFiles.organizationId, orgId),
              eq(projectFiles.path, path),
            ),
          );
        await softDeleteEntry(db, context, project, path, "move");
        await recordProjectSnapshot(db, context, project, "manual-save");
        return Response.json({ path: to });
      }
      return await upsertFile(db, context, project, path, body.content ?? "", "save");
    }
    if (method === "DELETE") {
      if (await isRegistryManagedPath(db, orgId, projectId, path)) {
        return jsonError("registry-managed component files are read-only; duplicate the file to customize it", 409);
      }
      await db
        .delete(projectFiles)
        .where(
          and(
            eq(projectFiles.projectId, projectId),
            eq(projectFiles.organizationId, orgId),
            eq(projectFiles.path, path),
          ),
        );
      await softDeleteEntry(db, context, project, path, "delete");
      await recordProjectSnapshot(db, context, project, "manual-save");
      return Response.json({ ok: true });
    }
    return jsonError("method not allowed", 405);
  }

  if (kind === "duplicate-file" && method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { from?: string; to?: string };
    if (!body.from || !body.to) return jsonError("missing from/to", 400);
    const from = safePath(body.from);
    const to = safePath(body.to);
    const rows = await db
      .select({ content: projectFiles.content })
      .from(projectFiles)
      .where(
        and(
          eq(projectFiles.projectId, projectId),
          eq(projectFiles.organizationId, orgId),
          eq(projectFiles.path, from),
        ),
      )
      .limit(1);
    if (!rows[0]) return jsonError("source file not found", 404);
    return await upsertFile(db, context, project, to, rows[0].content, "duplicate");
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
        const rawPath = url.searchParams.get("path");
        if (!rawPath) return jsonError("missing ?path", 400);
        const path = safePath(rawPath);
        const bytes = new Uint8Array(await req.arrayBuffer());
        const contentType = req.headers.get("content-type") || mimeForPath(path);
        const item = await uploadProjectAsset(env, db, context, project, {
          path,
          bytes,
          contentType,
        });
        return Response.json(item);
      }
      return jsonError("method not allowed", 405);
    }
    if (method === "GET") {
      return await serveAsset(env, db, orgId, projectId, safePath(rest));
    }
    return jsonError("method not allowed", 405);
  }

  if (kind === "agent-assets") {
    if (method !== "POST") return jsonError("method not allowed", 405);
    const url = new URL(req.url);
    const filename = url.searchParams.get("filename");
    if (!filename) return jsonError("missing ?filename", 400);
    const declaredLength = Number(req.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_ASSET_BYTES) return jsonError("asset too large", 413);
    const contentType = req.headers.get("content-type") || mimeForPath(filename);
    if (!isPromptAgentAttachmentType(contentType)) {
      return jsonError("unsupported attachment type", 415);
    }
    const existingRows = await db
      .select({ path: projectAssets.path })
      .from(projectAssets)
      .where(and(eq(projectAssets.projectId, projectId), eq(projectAssets.organizationId, orgId)))
      .orderBy(asc(projectAssets.path));
    const path = promptAgentAssetPath(filename, existingRows.map((row) => row.path));
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.byteLength > MAX_ASSET_BYTES) return jsonError("asset too large", 413);
    const item = await uploadProjectAsset(env, db, context, project, {
      path,
      bytes,
      contentType,
    });
    return Response.json(item);
  }

  if (kind === "preview") {
    // Bare /preview is handled by render-api (kept for compatibility); here we
    // serve sub-paths so a `<base>`-relative composition can fetch its files and
    // assets: a stored file → its content; otherwise an asset → its bytes.
    if (method !== "GET") return jsonError("method not allowed", 405);
    if (!rest) return await renderProjectPreview(env, db, orgId, projectId);
    const target = safePath(rest.startsWith("comp/") ? rest.slice("comp/".length) : rest);
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

interface RegistryManagedFileInfo {
  componentId: string;
  sourceUrl: string;
  sourceRevision: string;
  contentHash: string;
}

async function loadMaterializedComponentManifest(
  db: ReturnType<typeof createDb>,
  orgId: string,
  projectId: string,
): Promise<MaterializedComponentManifest | null> {
  const rows = await db
    .select({ content: projectFiles.content })
    .from(projectFiles)
    .where(
      and(
        eq(projectFiles.projectId, projectId),
        eq(projectFiles.organizationId, orgId),
        eq(projectFiles.path, MATERIALIZED_COMPONENT_MANIFEST_PATH),
      ),
    )
    .limit(1);
  if (!rows[0]?.content) return null;
  try {
    const parsed = materializedComponentManifestSchema.safeParse(JSON.parse(rows[0].content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function loadRegistryManagedFiles(
  db: ReturnType<typeof createDb>,
  orgId: string,
  projectId: string,
): Promise<Map<string, RegistryManagedFileInfo>> {
  const manifest = await loadMaterializedComponentManifest(db, orgId, projectId);
  const registryFiles = new Map<string, RegistryManagedFileInfo>();
  for (const component of manifest?.components ?? []) {
    for (const file of component.files) {
      registryFiles.set(file.path, {
        componentId: component.componentId,
        sourceUrl: component.source.url,
        sourceRevision: component.source.revision,
        contentHash: file.contentHash,
      });
    }
  }
  return registryFiles;
}

async function isRegistryManagedPath(
  db: ReturnType<typeof createDb>,
  orgId: string,
  projectId: string,
  path: string,
): Promise<boolean> {
  return (await loadRegistryManagedFiles(db, orgId, projectId)).has(path);
}

function annotateRegistryManagedEntry<T extends { path: string; artifactRole?: string }>(
  entry: T,
  registryFiles: Map<string, RegistryManagedFileInfo>,
): T & { registryComponent?: RegistryManagedFileInfo } {
  const registryComponent = registryFiles.get(entry.path);
  if (!registryComponent) return entry;
  return {
    ...entry,
    artifactRole: "registry-component",
    registryComponent,
  };
}

async function upsertFile(
  db: ReturnType<typeof createDb>,
  context: AppAuthContext,
  project: typeof projects.$inferSelect,
  path: string,
  content: string,
  changeKind: "create" | "save" | "duplicate" | "move",
): Promise<Response> {
  if (content.length > MAX_FILE_BYTES) return jsonError("file too large", 413);
  const normalized = safePath(path);
  await upsertProjectFile(db, context.organization.id, project.id, normalized, content);
  const entryId = await upsertProjectEntry(db, context, project, {
    path: normalized,
    kind: "text",
    artifactRole: artifactRoleForPath(normalized),
    storageProvider: "postgres",
    contentType: mimeForPath(normalized),
    size: new TextEncoder().encode(content).byteLength,
    textContent: content,
    searchText: `${normalized}\n${content}`,
  });
  await recordEntryVersion(db, context, project, {
    entryId,
    path: normalized,
    kind: "text",
    artifactRole: artifactRoleForPath(normalized),
    storageProvider: "postgres",
    contentType: mimeForPath(normalized),
    size: new TextEncoder().encode(content).byteLength,
    textContent: content,
    changeKind,
  });
  await recordProjectSnapshot(db, context, project, "manual-save");
  return Response.json({ path: normalized });
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

export async function uploadProjectAsset(
  env: WorkerEnv,
  db: ReturnType<typeof createDb>,
  context: AppAuthContext,
  project: typeof projects.$inferSelect,
  input: {
    path: string;
    bytes: Uint8Array;
    contentType: string;
  },
): Promise<{ path: string; url: string; contentType: string; size: number }> {
  const path = safePath(input.path);
  if (!path.startsWith("assets/")) return Promise.reject(new Error("asset path must be under assets/"));
  if (input.bytes.byteLength > MAX_ASSET_BYTES) {
    throw new Error("asset too large");
  }
  const key = projectWorkspaceKey({
    organizationId: context.organization.id,
    ownerId: project.ownerId,
    projectId: project.id,
    path,
  });
  const stored = await writeProjectObject(env, {
    key,
    bytes: input.bytes,
    contentType: input.contentType,
  });
  const entryId = await upsertProjectEntry(db, context, project, {
    path,
    kind: "binary",
    artifactRole: artifactRoleForPath(path),
    storageProvider: stored.provider,
    storageKey: stored.key,
    contentType: input.contentType,
    size: input.bytes.byteLength,
    sha256: stored.sha256,
    searchText: path,
  });
  await recordEntryVersion(db, context, project, {
    entryId,
    path,
    kind: "binary",
    artifactRole: artifactRoleForPath(path),
    storageProvider: stored.provider,
    storageKey: stored.key,
    contentType: input.contentType,
    size: input.bytes.byteLength,
    sha256: stored.sha256,
    changeKind: "upload",
  });
  await db
    .insert(projectAssets)
    .values({
      id: crypto.randomUUID(),
      projectId: project.id,
      organizationId: context.organization.id,
      path,
      r2Key: stored.provider === "r2" ? stored.key : null,
      entryId,
      storageProvider: stored.provider,
      storageKey: stored.key,
      artifactRole: artifactRoleForPath(path),
      sha256: stored.sha256,
      contentType: input.contentType,
      size: input.bytes.byteLength,
      createdById: context.user.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [projectAssets.projectId, projectAssets.path],
      set: {
        r2Key: stored.provider === "r2" ? stored.key : null,
        entryId,
        storageProvider: stored.provider,
        storageKey: stored.key,
        artifactRole: artifactRoleForPath(path),
        sha256: stored.sha256,
        contentType: input.contentType,
        size: input.bytes.byteLength,
        updatedAt: new Date(),
      },
    });
  return {
    path,
    url: `/api/projects/${encodeURIComponent(project.id)}/assets/${path}`,
    contentType: input.contentType,
    size: input.bytes.byteLength,
  };
}

async function upsertProjectEntry(
  db: ReturnType<typeof createDb>,
  context: AppAuthContext,
  project: typeof projects.$inferSelect,
  input: {
    path: string;
    kind: "folder" | "text" | "binary" | "render";
    artifactRole: string;
    storageProvider: string;
    storageKey?: string | null;
    contentType?: string | null;
    size?: number;
    sha256?: string | null;
    textContent?: string | null;
    searchText?: string | null;
  },
): Promise<string> {
  const entryId = projectEntryId(project.id, input.path);
  await db
    .insert(projectEntries)
    .values({
      id: entryId,
      projectId: project.id,
      organizationId: context.organization.id,
      ownerId: project.ownerId,
      createdById: context.user.id,
      updatedById: context.user.id,
      path: input.path,
      kind: input.kind,
      artifactRole: input.artifactRole,
      storageProvider: input.storageProvider,
      storageKey: input.storageKey ?? null,
      contentType: input.contentType ?? null,
      size: input.size ?? 0,
      sha256: input.sha256 ?? null,
      textContent: input.textContent ?? null,
      searchText: input.searchText ?? input.path,
      deletedAt: null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [projectEntries.projectId, projectEntries.path],
      set: {
        kind: input.kind,
        artifactRole: input.artifactRole,
        storageProvider: input.storageProvider,
        storageKey: input.storageKey ?? null,
        contentType: input.contentType ?? null,
        size: input.size ?? 0,
        sha256: input.sha256 ?? null,
        textContent: input.textContent ?? null,
        searchText: input.searchText ?? input.path,
        deletedAt: null,
        updatedById: context.user.id,
        updatedAt: new Date(),
      },
    });
  await upsertParentFolders(db, context, project, input.path);
  return entryId;
}

async function upsertParentFolders(
  db: ReturnType<typeof createDb>,
  context: AppAuthContext,
  project: typeof projects.$inferSelect,
  path: string,
): Promise<void> {
  const parts = path.split("/");
  for (let index = 1; index < parts.length; index += 1) {
    const folderPath = parts.slice(0, index).join("/");
    await db
      .insert(projectEntries)
      .values({
        id: projectEntryId(project.id, folderPath),
        projectId: project.id,
        organizationId: context.organization.id,
        ownerId: project.ownerId,
        createdById: context.user.id,
        updatedById: context.user.id,
        path: folderPath,
        kind: "folder",
        artifactRole: "folder",
        storageProvider: "postgres",
        searchText: folderPath,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [projectEntries.projectId, projectEntries.path],
        set: { deletedAt: null, updatedById: context.user.id, updatedAt: new Date() },
      });
  }
}

async function recordEntryVersion(
  db: ReturnType<typeof createDb>,
  context: AppAuthContext,
  project: typeof projects.$inferSelect,
  input: {
    entryId?: string;
    path: string;
    kind: string;
    artifactRole: string;
    storageProvider: string;
    storageKey?: string | null;
    contentType?: string | null;
    size?: number;
    sha256?: string | null;
    textContent?: string | null;
    changeKind: string;
  },
): Promise<string> {
  const versionId = crypto.randomUUID();
  await db.insert(projectEntryVersions).values({
    id: versionId,
    entryId: input.entryId ?? projectEntryId(project.id, input.path),
    projectId: project.id,
    organizationId: context.organization.id,
    createdById: context.user.id,
    path: input.path,
    kind: input.kind,
    artifactRole: input.artifactRole,
    storageProvider: input.storageProvider,
    storageKey: input.storageKey ?? null,
    contentType: input.contentType ?? null,
    size: input.size ?? 0,
    sha256: input.sha256 ?? null,
    textContent: input.textContent ?? null,
    changeKind: input.changeKind,
  });
  return versionId;
}

async function softDeleteEntry(
  db: ReturnType<typeof createDb>,
  context: AppAuthContext,
  project: typeof projects.$inferSelect,
  path: string,
  changeKind: string,
): Promise<void> {
  await db
    .update(projectEntries)
    .set({ deletedAt: new Date(), updatedAt: new Date(), updatedById: context.user.id })
    .where(
      and(
        eq(projectEntries.projectId, project.id),
        eq(projectEntries.organizationId, context.organization.id),
        eq(projectEntries.path, path),
      ),
    );
  await recordEntryVersion(db, context, project, {
    path,
    kind: "text",
    artifactRole: artifactRoleForPath(path),
    storageProvider: "postgres",
    textContent: "",
    contentType: mimeForPath(path),
    size: 0,
    changeKind,
  });
}

async function recordProjectSnapshot(
  db: ReturnType<typeof createDb>,
  context: AppAuthContext,
  project: typeof projects.$inferSelect,
  reason: string,
): Promise<void> {
  const versions = await db
    .select({
      id: projectEntryVersions.id,
      path: projectEntryVersions.path,
      createdAt: projectEntryVersions.createdAt,
    })
    .from(projectEntryVersions)
    .where(
      and(
        eq(projectEntryVersions.projectId, project.id),
        eq(projectEntryVersions.organizationId, context.organization.id),
      ),
    )
    .orderBy(asc(projectEntryVersions.path), desc(projectEntryVersions.createdAt));
  const seen = new Set<string>();
  const manifest: Array<{ path: string; versionId: string }> = [];
  for (const version of versions) {
    if (seen.has(version.path)) continue;
    seen.add(version.path);
    manifest.push({ path: version.path, versionId: version.id });
  }
  await db.insert(projectSnapshots).values({
    id: crypto.randomUUID(),
    projectId: project.id,
    organizationId: context.organization.id,
    createdById: context.user.id,
    reason,
    manifest,
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
    .select({
      r2Key: projectAssets.r2Key,
      storageProvider: projectAssets.storageProvider,
      storageKey: projectAssets.storageKey,
      contentType: projectAssets.contentType,
    })
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
  const object = await readProjectObject(env, {
    provider: rows[0].storageProvider === "bunny-storage" ? "bunny-storage" : "r2",
    key: rows[0].storageKey ?? rows[0].r2Key,
  });
  if (!object) return jsonError("asset bytes missing", 404);
  const headers = new Headers(object.headers);
  headers.set("content-type", rows[0].contentType);
  headers.set("cache-control", "private, max-age=300");
  return new Response(object.body, { headers });
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

function safePath(path: string): string {
  return normalizeProjectPath(path);
}

function artifactRoleForPath(path: string): string {
  if (path.endsWith("/")) return "folder";
  if (path === MATERIALIZED_COMPONENT_MANIFEST_PATH) return "registry-manifest";
  if (/^compositions\//.test(path)) return "composition";
  if (/^assets\//.test(path)) return "asset";
  if (/^transcripts?\//.test(path)) return "transcript";
  if (/^snapshots?\//.test(path)) return "snapshot";
  if (/^renders?\//.test(path)) return "render";
  if (/storyboard/i.test(path)) return "storyboard";
  if (/script/i.test(path)) return "script";
  return "source";
}

function isPromptAgentAttachmentType(contentType: string): boolean {
  const normalized = contentType.split(";")[0]?.trim() ?? "";
  return PROMPT_AGENT_ATTACHMENT_TYPES.some((pattern) => pattern.test(normalized));
}

function projectEntryId(projectId: string, path: string): string {
  return `${projectId}:${path}`;
}
