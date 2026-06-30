import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { createDb } from "../db";
import {
  projectEntries,
  projectEntryVersions,
  projectFiles,
  projectMembers,
  projects,
  renders,
  workflowRuns,
} from "../db/schema";
import { requireProjectAccess, type AppAuthContext } from "../lib/auth-context";
import {
  composeWebsiteToVideoArtifacts,
  normalizeCaptureSummary,
  validateWorkspaceFiles,
  type NormalizedCaptureSummary,
  type WorkflowWorkspaceFile,
} from "../lib/website-to-video-artifacts";
import {
  DEFAULT_WORKFLOW_LIMITS,
  WEBSITE_TO_VIDEO_SKILL_ID,
  WEBSITE_TO_VIDEO_SKIPPED_STEPS,
  createWorkflowArtifactManifest,
  isWebsiteToVideoWorkflowEnabled,
  toBoundedWorkflowError,
  validateWorkflowRedirects,
  validateWorkflowUrl,
  workflowProjectPath,
  type WorkflowArtifactRecord,
  type WorkflowArtifactManifest,
  type WorkflowStoragePointer,
} from "../lib/website-to-video-workflow";
import {
  isActiveWorkflowStatus,
  workflowRunToClient,
  type WorkflowPhase,
  type WorkflowProgress,
  type WorkflowRunClient,
  type WorkflowRunLike,
  type WorkflowStatus,
} from "../lib/workflow-runs";
import {
  findHyperframesSkill,
  getHyperframesSkillCatalog,
  loadHyperframesSkill,
} from "../lib/hyperframes-skill-catalog";
import { BunnyStreamClient, getBunnyStreamConfig, isBunnyStreamConfigured } from "../lib/bunny";
import { normalizeProjectPath } from "../lib/project-paths";
import { projectRenderArchiveKey, projectWorkspaceKey, writeProjectObject } from "../lib/project-storage";
import {
  buildWizardStagePlan,
  isEditableWizardArtifactPath,
  stageIdForArtifactPath,
  wizardStageArtifactContentSchema,
  wizardStageArtifactSaveSchema,
  wizardStageIdSchema,
  wizardStageValidationResultSchema,
  type WizardStageArtifactContent,
  type WizardStageId,
  type WizardStagePlan,
  type WizardStageValidationResult,
} from "../lib/pipeline-wizard";
import { upsertProjectFile } from "./studio-files-api";
import type { WorkflowContainer } from "../container";
import type { WorkerEnv } from "./render-api";

export type WorkflowExecutionContext = Pick<ExecutionContext, "waitUntil">;

const startWorkflowSchema = z.object({
  url: z.string().trim().min(1).max(2_000),
  title: z.string().trim().min(1).max(160).optional(),
  projectId: z.string().trim().min(1).max(200).optional(),
  durationSec: z.number().min(1).max(300).optional(),
});

export type StartWebsiteToVideoWorkflowInput = z.infer<typeof startWorkflowSchema>;

export class WorkflowApiError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "WorkflowApiError";
  }
}

export async function handleWorkflowApi(
  env: WorkerEnv,
  req: Request,
  pathname: string,
  auth: AppAuthContext,
  ctx?: WorkflowExecutionContext,
): Promise<Response | null> {
  if (pathname === "/api/workflows/website-to-video" && req.method === "POST") {
    try {
      const input = startWorkflowSchema.parse(await req.json().catch(() => ({})));
      const workflowRun = await startWebsiteToVideoWorkflowRun(env, auth, input, ctx);
      return Response.json({ workflowRun }, { status: 202 });
    } catch (err) {
      return workflowErrorResponse(err);
    }
  }

  const stagesMatch = pathname.match(/^\/api\/workflows\/([^/]+)\/stages$/);
  if (stagesMatch && req.method === "GET") {
    try {
      const stagePlan = await getWorkflowWizardStagePlan(env, auth, decodeURIComponent(stagesMatch[1]));
      return Response.json({ stagePlan });
    } catch (err) {
      return workflowErrorResponse(err);
    }
  }

  const stageValidationMatch = pathname.match(/^\/api\/workflows\/([^/]+)\/stages\/([^/]+)\/validate$/);
  if (stageValidationMatch && req.method === "POST") {
    try {
      const result = await validateWorkflowWizardStage(
        env,
        auth,
        decodeURIComponent(stageValidationMatch[1]),
        decodeURIComponent(stageValidationMatch[2]),
      );
      return Response.json({ validation: result });
    } catch (err) {
      return workflowErrorResponse(err);
    }
  }

  const stageArtifactMatch = pathname.match(/^\/api\/workflows\/([^/]+)\/stages\/([^/]+)\/artifacts\/(.+)$/);
  if (stageArtifactMatch && (req.method === "GET" || req.method === "PATCH")) {
    try {
      const runId = decodeURIComponent(stageArtifactMatch[1]);
      const stageId = decodeURIComponent(stageArtifactMatch[2]);
      const path = decodeURIComponent(stageArtifactMatch[3]);
      if (req.method === "GET") {
        const artifact = await readWorkflowWizardStageArtifact(env, auth, runId, stageId, path);
        return Response.json({ artifact });
      }
      const artifact = await saveWorkflowWizardStageArtifact(
        env,
        auth,
        runId,
        stageId,
        path,
        await req.json().catch(() => ({})),
      );
      return Response.json({ artifact });
    } catch (err) {
      return workflowErrorResponse(err);
    }
  }

  const runMatch = pathname.match(/^\/api\/workflows\/([^/]+)$/);
  if (runMatch && req.method === "GET") {
    try {
      const workflowRun = await getWebsiteToVideoWorkflowRun(env, auth, decodeURIComponent(runMatch[1]));
      return Response.json({ workflowRun });
    } catch (err) {
      return workflowErrorResponse(err);
    }
  }

  const continueMatch = pathname.match(/^\/api\/workflows\/([^/]+)\/continue$/);
  if (continueMatch && req.method === "POST") {
    try {
      const workflowRun = await continueWebsiteToVideoWorkflowRun(env, auth, decodeURIComponent(continueMatch[1]), ctx);
      return Response.json({ workflowRun }, { status: 202 });
    } catch (err) {
      return workflowErrorResponse(err);
    }
  }

  const cancelMatch = pathname.match(/^\/api\/workflows\/([^/]+)\/cancel$/);
  if (cancelMatch && req.method === "POST") {
    try {
      const workflowRun = await cancelWebsiteToVideoWorkflowRun(env, auth, decodeURIComponent(cancelMatch[1]));
      return Response.json({ workflowRun });
    } catch (err) {
      return workflowErrorResponse(err);
    }
  }

  return null;
}

export async function startWebsiteToVideoWorkflowRun(
  env: WorkerEnv,
  auth: AppAuthContext,
  input: StartWebsiteToVideoWorkflowInput,
  ctx?: WorkflowExecutionContext,
): Promise<WorkflowRunClient> {
  if (!isWebsiteToVideoWorkflowEnabled(env)) {
    throw new WorkflowApiError("website-to-video workflow runner is disabled", 403);
  }

  const safeUrl = validateWorkflowUrl(input.url);
  if (!safeUrl.ok) throw new WorkflowApiError(safeUrl.reason, 400);

  const db = createDb(env);
  const activeRows = await db
    .select({ id: workflowRuns.id })
    .from(workflowRuns)
    .where(
      and(
        eq(workflowRuns.organizationId, auth.organization.id),
        inArray(workflowRuns.status, ["queued", "running", "awaiting_approval"]),
      ),
    )
    .limit(DEFAULT_WORKFLOW_LIMITS.maxConcurrentRunsPerOrg);
  if (activeRows.length >= DEFAULT_WORKFLOW_LIMITS.maxConcurrentRunsPerOrg) {
    throw new WorkflowApiError("workflow quota exceeded for this organization", 429);
  }

  const now = new Date();
  const runId = crypto.randomUUID();
  const runValues = {
    id: runId,
    organizationId: auth.organization.id,
    userId: auth.user.id,
    projectId: input.projectId ?? null,
    skillId: WEBSITE_TO_VIDEO_SKILL_ID,
    status: "queued" as const,
    phase: "preflight" as const,
    inputUrl: safeUrl.url,
    options: {
      durationSec: input.durationSec,
      title: input.title,
      projectId: input.projectId,
      limits: DEFAULT_WORKFLOW_LIMITS,
    },
    progress: jsonRecord(progress(0, "Queued")),
    artifactManifest: jsonRecord(createWorkflowArtifactManifest({
      runId,
      skippedSteps: WEBSITE_TO_VIDEO_SKIPPED_STEPS,
    })),
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  const rows = await db.insert(workflowRuns).values(runValues).returning();
  const run = toWorkflowRunLike(rows[0] ?? runValues);

  if (ctx) {
    ctx.waitUntil(runWebsiteToVideoWorkflow(env, auth, run.id).catch((err) => {
      console.error("website-to-video workflow failed", err);
    }));
  }

  return workflowRunToClient(run);
}

export async function getWebsiteToVideoWorkflowRun(
  env: WorkerEnv,
  auth: AppAuthContext,
  runId: string,
): Promise<WorkflowRunClient> {
  const run = await getRunForOrg(env, auth, runId);
  return workflowRunToClient(run);
}

export async function continueWebsiteToVideoWorkflowRun(
  env: WorkerEnv,
  auth: AppAuthContext,
  runId: string,
  ctx?: WorkflowExecutionContext,
): Promise<WorkflowRunClient> {
  const run = await getRunForOrg(env, auth, runId);
  if (run.status !== "awaiting_approval" && run.status !== "queued") {
    throw new WorkflowApiError(`workflow cannot continue from ${run.status}`, 409);
  }
  if (ctx) {
    ctx.waitUntil(runWebsiteToVideoWorkflow(env, auth, run.id).catch((err) => {
      console.error("website-to-video workflow continuation failed", err);
    }));
  }
  return workflowRunToClient(run);
}

export async function cancelWebsiteToVideoWorkflowRun(
  env: WorkerEnv,
  auth: AppAuthContext,
  runId: string,
): Promise<WorkflowRunClient> {
  const run = await getRunForOrg(env, auth, runId);
  if (!isActiveWorkflowStatus(run.status)) return workflowRunToClient(run);
  const now = new Date();
  await createDb(env)
    .update(workflowRuns)
    .set({
      status: "cancelled",
      phase: run.phase,
      progress: jsonRecord(progress(run.progress?.current ?? 0, "Cancelled")),
      updatedAt: now,
      completedAt: now,
    })
    .where(and(eq(workflowRuns.id, run.id), eq(workflowRuns.organizationId, auth.organization.id)));
  return workflowRunToClient({ ...run, status: "cancelled", completedAt: now, updatedAt: now });
}

export async function getWorkflowWizardStagePlan(
  env: WorkerEnv,
  auth: AppAuthContext,
  runId: string,
): Promise<WizardStagePlan> {
  const run = await getRunForOrg(env, auth, runId);
  if (run.projectId) {
    await requireProjectAccess(auth, run.projectId, env, "read");
  }
  return buildWizardStagePlan(workflowRunToClient(run));
}

export async function readWorkflowWizardStageArtifact(
  env: WorkerEnv,
  auth: AppAuthContext,
  runId: string,
  rawStageId: string,
  rawPath: string,
): Promise<WizardStageArtifactContent> {
  const { run, stageId, path } = await resolveStageArtifact(env, auth, runId, rawStageId, rawPath, "read");
  if (!run.projectId) throw new WorkflowApiError("workflow has no project artifacts yet", 409);
  const db = createDb(env);
  const artifact = await loadTextProjectArtifact(db, auth.organization.id, run.projectId, path);
  if (!artifact) throw new WorkflowApiError("stage artifact not found", 404);
  return wizardStageArtifactContentSchema.parse({
    runId,
    projectId: run.projectId,
    stageId,
    path,
    content: artifact.content,
    contentType: artifact.contentType,
    revision: artifact.revision,
    updatedAt: artifact.updatedAt,
  });
}

export async function saveWorkflowWizardStageArtifact(
  env: WorkerEnv,
  auth: AppAuthContext,
  runId: string,
  rawStageId: string,
  rawPath: string,
  rawBody: unknown,
): Promise<WizardStageArtifactContent> {
  const body = wizardStageArtifactSaveSchema.parse(rawBody);
  const { run, stageId, path, project } = await resolveStageArtifact(env, auth, runId, rawStageId, rawPath, "edit");
  if (!run.projectId || !project) throw new WorkflowApiError("workflow has no project artifacts yet", 409);
  if (!isEditableWizardArtifactPath(path)) throw new WorkflowApiError("stage artifact is not editable", 409);

  const db = createDb(env);
  const current = await loadTextProjectArtifact(db, auth.organization.id, run.projectId, path);
  if (!current) throw new WorkflowApiError("stage artifact not found", 404);
  if (body.revision && current.revision && body.revision !== current.revision) {
    throw new WorkflowApiError("stage artifact changed since it was loaded", 409);
  }

  await upsertProjectFile(db, auth.organization.id, run.projectId, path, body.content);
  if (path === "index.html") {
    await db
      .update(projects)
      .set({ currentHtml: body.content, updatedAt: new Date() })
      .where(and(eq(projects.id, run.projectId), eq(projects.organizationId, auth.organization.id)));
  }

  const bytes = new TextEncoder().encode(body.content);
  const pointer = await writeProjectObject(env, {
    key: projectWorkspaceKey({
      organizationId: auth.organization.id,
      ownerId: project.ownerId || auth.user.id,
      projectId: run.projectId,
      path,
    }),
    bytes,
    contentType: mimeForPath(path),
  });
  await recordProjectEntry(env, auth, project, {
    path,
    content: body.content,
    contentType: mimeForPath(path),
    storage: pointer,
  });

  return await readWorkflowWizardStageArtifact(env, auth, runId, stageId, path);
}

export async function validateWorkflowWizardStage(
  env: WorkerEnv,
  auth: AppAuthContext,
  runId: string,
  rawStageId: string,
): Promise<WizardStageValidationResult> {
  const stageId = wizardStageIdSchema.parse(rawStageId);
  const stagePlan = await getWorkflowWizardStagePlan(env, auth, runId);
  const stage = stagePlan.stages.find((item) => item.id === stageId);
  if (!stage) throw new WorkflowApiError("stage not found", 404);
  const warnings = [stage.validationMessage, stage.skippedReason].filter((item): item is string => Boolean(item));
  const status =
    stage.status === "failed"
      ? "failed"
      : stage.status === "skipped" || stage.status === "unavailable"
        ? "unavailable"
        : warnings.length
          ? "warning"
          : stage.required && !stage.artifacts.length
            ? "failed"
            : "passed";
  return wizardStageValidationResultSchema.parse({
    runId,
    stageId,
    status,
    checkedAt: new Date().toISOString(),
    warnings,
  });
}

export async function runWebsiteToVideoWorkflow(
  env: WorkerEnv,
  auth: AppAuthContext,
  runId: string,
): Promise<void> {
  const db = createDb(env);
  const run = await getRunForOrg(env, auth, runId);
  if (run.status === "cancelled" || run.status === "succeeded") return;

  try {
    await updateRun(env, runId, auth.organization.id, {
      status: "running",
      phase: "preflight",
      progress: jsonRecord(progress(1, "Validating website URL")),
      startedAt: new Date(),
      updatedAt: new Date(),
    });

    const redirectCheck = await validateWorkflowRedirects(run.inputUrl, {
      maxRedirects: DEFAULT_WORKFLOW_LIMITS.maxRedirects,
    });
    if (!redirectCheck.ok) throw new WorkflowApiError(redirectCheck.reason, 400);

    await updateRun(env, runId, auth.organization.id, {
      phase: "capture",
      progress: jsonRecord(progress(2, "Capturing website")),
      updatedAt: new Date(),
    });
    const capture = await captureWebsite(env, runId, redirectCheck.url);

    await updateRun(env, runId, auth.organization.id, {
      phase: "compose",
      progress: jsonRecord(progress(3, "Creating workflow artifacts")),
      updatedAt: new Date(),
    });
    const catalog = getHyperframesSkillCatalog();
    const skill = findHyperframesSkill(WEBSITE_TO_VIDEO_SKILL_ID);
    const loadedSkill = loadHyperframesSkill({
      skillId: WEBSITE_TO_VIDEO_SKILL_ID,
      maxChars: 6_000,
    });
    const artifactOutput = composeWebsiteToVideoArtifacts({
      runId,
      sourceUrl: redirectCheck.url,
      durationSec: typeof run.options?.durationSec === "number" ? run.options.durationSec : undefined,
      capture,
      skillRevision: skill?.contentHash ?? catalog.source.commitSha,
      skillContext: loadedSkill.found ? loadedSkill.markdown : undefined,
    });
    const validation = validateWorkspaceFiles(artifactOutput.files, DEFAULT_WORKFLOW_LIMITS);
    if (!validation.ok) throw new WorkflowApiError(validation.reason, 400);

    await updateRun(env, runId, auth.organization.id, {
      phase: "validate",
      progress: jsonRecord(progress(4, "Validating composition workspace")),
      updatedAt: new Date(),
    });
    const validateResult = await validateWorkspaceWithRetry(env, runId, artifactOutput.files);

    await updateRun(env, runId, auth.organization.id, {
      phase: "persist",
      progress: jsonRecord(progress(5, "Saving Studio project")),
      updatedAt: new Date(),
    });
    const project = await ensureWorkflowProject(env, auth, run, artifactOutput.files);
    const artifacts = await persistWorkflowFiles(env, auth, project, runId, artifactOutput.files);
    const stageVideoArtifacts = await persistStageVideos(
      env,
      auth,
      project,
      runId,
      validateResult.stageVideos,
    );
    const manifest = createWorkflowArtifactManifest({
      runId,
      artifacts: [...artifacts, ...stageVideoArtifacts],
      skippedSteps: artifactOutput.skippedSteps,
      warnings: [...artifactOutput.warnings, ...validateResult.warnings],
      studioUrl: `/projects/${encodeURIComponent(project.id)}/studio`,
    });

    await db
      .update(workflowRuns)
      .set({
        projectId: project.id,
        status: "succeeded",
        phase: "complete",
        progress: jsonRecord(progress(6, "Complete")),
        artifactManifest: jsonRecord(manifest),
        error: null,
        updatedAt: new Date(),
        completedAt: new Date(),
      })
      .where(and(eq(workflowRuns.id, runId), eq(workflowRuns.organizationId, auth.organization.id)));
  } catch (err) {
    await updateRun(env, runId, auth.organization.id, {
      status: "failed",
      error: jsonRecord(toBoundedWorkflowError(err, currentPhaseFromError(err))),
      progress: jsonRecord(progress(0, "Failed")),
      updatedAt: new Date(),
      completedAt: new Date(),
    });
  }
}

async function getRunForOrg(
  env: WorkerEnv,
  auth: AppAuthContext,
  runId: string,
): Promise<WorkflowRunLike> {
  const rows = await createDb(env)
    .select()
    .from(workflowRuns)
    .where(and(eq(workflowRuns.id, runId), eq(workflowRuns.organizationId, auth.organization.id)))
    .limit(1);
  if (!rows[0]) throw new WorkflowApiError("workflow run not found", 404);
  return toWorkflowRunLike(rows[0]);
}

async function resolveStageArtifact(
  env: WorkerEnv,
  auth: AppAuthContext,
  runId: string,
  rawStageId: string,
  rawPath: string,
  permission: "read" | "edit",
): Promise<{
  run: WorkflowRunLike;
  stageId: WizardStageId;
  path: string;
  project: typeof projects.$inferSelect | null;
}> {
  const run = await getRunForOrg(env, auth, runId);
  const stageId = wizardStageIdSchema.parse(rawStageId);
  const path = normalizeProjectPath(rawPath);
  if (stageIdForArtifactPath(path) !== stageId) {
    throw new WorkflowApiError("artifact does not belong to the requested stage", 400);
  }
  const plan = buildWizardStagePlan(workflowRunToClient(run));
  const stage = plan.stages.find((item) => item.id === stageId);
  if (!stage?.artifacts.some((artifact) => artifact.path === path)) {
    throw new WorkflowApiError("stage artifact not found", 404);
  }
  const project = run.projectId ? await requireProjectAccess(auth, run.projectId, env, permission) : null;
  return { run, stageId, path, project };
}

async function loadTextProjectArtifact(
  db: ReturnType<typeof createDb>,
  organizationId: string,
  projectId: string,
  path: string,
): Promise<{
  content: string;
  contentType: string;
  revision: string | null;
  updatedAt: string | null;
} | null> {
  const entryRows = await db
    .select({
      textContent: projectEntries.textContent,
      contentType: projectEntries.contentType,
      updatedAt: projectEntries.updatedAt,
    })
    .from(projectEntries)
    .where(
      and(
        eq(projectEntries.projectId, projectId),
        eq(projectEntries.organizationId, organizationId),
        eq(projectEntries.path, path),
        isNull(projectEntries.deletedAt),
      ),
    )
    .limit(1);
  const entry = entryRows[0];
  if (entry?.textContent != null) {
    const updatedAt = isoOrNull(entry.updatedAt);
    return {
      content: entry.textContent,
      contentType: entry.contentType ?? mimeForPath(path),
      revision: updatedAt,
      updatedAt,
    };
  }

  const fileRows = await db
    .select({
      content: projectFiles.content,
      updatedAt: projectFiles.updatedAt,
    })
    .from(projectFiles)
    .where(
      and(
        eq(projectFiles.projectId, projectId),
        eq(projectFiles.organizationId, organizationId),
        eq(projectFiles.path, path),
      ),
    )
    .limit(1);
  const file = fileRows[0];
  if (!file) return null;
  const updatedAt = isoOrNull(file.updatedAt);
  return {
    content: file.content,
    contentType: mimeForPath(path),
    revision: updatedAt,
    updatedAt,
  };
}

function toWorkflowRunLike(row: Record<string, unknown>): WorkflowRunLike {
  return {
    id: String(row.id),
    organizationId: String(row.organizationId),
    userId: String(row.userId),
    projectId: typeof row.projectId === "string" ? row.projectId : null,
    skillId: String(row.skillId),
    status: asStatus(row.status),
    phase: asPhase(row.phase),
    inputUrl: String(row.inputUrl),
    options: asRecord(row.options),
    progress: asProgress(row.progress),
    artifactManifest: asManifest(row.artifactManifest),
    error: asRecord(row.error) as WorkflowRunLike["error"],
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
    startedAt: asDate(row.startedAt),
    completedAt: asDate(row.completedAt),
  };
}

async function captureWebsite(
  env: WorkerEnv,
  runId: string,
  url: string,
): Promise<NormalizedCaptureSummary> {
  if (env.WORKFLOW_CONTAINER) {
    const { getContainer } = await import("@cloudflare/containers");
    const container = getContainer(env.WORKFLOW_CONTAINER, `workflow-${runId}`);
    const res = await container.fetch("http://container/workflow/capture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url,
        maxScreenshots: DEFAULT_WORKFLOW_LIMITS.maxScreenshots,
        timeoutMs: DEFAULT_WORKFLOW_LIMITS.captureTimeoutMs,
      }),
    });
    if (!res.ok) throw new WorkflowApiError(`capture failed: ${await res.text()}`, 502);
    return normalizeCaptureSummary(await res.json());
  }

  return normalizeCaptureSummary({
    url,
    title: new URL(url).hostname.replace(/^www\./, ""),
    description: "Capture container is not bound in this environment; generated from URL metadata only.",
    text: "",
  });
}

async function validateWorkspace(
  env: WorkerEnv,
  runId: string,
  files: Array<WorkflowWorkspaceFile>,
): Promise<{ warnings: Array<string>; stageVideos: Array<WorkflowStageVideo> }> {
  if (!env.WORKFLOW_CONTAINER) {
    return {
      warnings: ["Workflow container is not bound; lint/validate/snapshot execution was skipped."],
      stageVideos: [],
    };
  }
  const { getContainer } = await import("@cloudflare/containers");
  const container = getContainer(env.WORKFLOW_CONTAINER, `workflow-${runId}`);
  const res = await container.fetch("http://container/workflow/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      files: files.map((file) => ({
        path: file.path,
        content: encodeBase64(file.content),
      })),
      timeoutMs: DEFAULT_WORKFLOW_LIMITS.validateTimeoutMs,
    }),
  });
  if (!res.ok) throw new WorkflowApiError(`validation failed: ${await res.text()}`, 502);
  const body = (await res.json().catch(() => ({}))) as {
    warnings?: Array<string>;
    stageVideos?: Array<WorkflowStageVideo>;
  };
  return {
    warnings: body.warnings ?? [],
    stageVideos: Array.isArray(body.stageVideos) ? body.stageVideos : [],
  };
}

async function validateWorkspaceWithRetry(
  env: WorkerEnv,
  runId: string,
  files: Array<WorkflowWorkspaceFile>,
): Promise<{ warnings: Array<string>; stageVideos: Array<WorkflowStageVideo> }> {
  try {
    return await validateWorkspace(env, runId, files);
  } catch (err) {
    const retry = await validateWorkspace(env, runId, files);
    return {
      warnings: [
        `Validation retried after: ${err instanceof Error ? err.message : String(err)}`,
        ...retry.warnings,
      ],
      stageVideos: retry.stageVideos,
    };
  }
}

async function ensureWorkflowProject(
  env: WorkerEnv,
  auth: AppAuthContext,
  run: WorkflowRunLike,
  files: Array<WorkflowWorkspaceFile>,
): Promise<typeof projects.$inferSelect> {
  if (run.projectId) {
    return await requireProjectAccess(auth, run.projectId, env, "edit");
  }

  const html = files.find((file) => file.path === "index.html")?.content ?? "";
  const projectId = crypto.randomUUID();
  const title = typeof run.options?.title === "string" ? run.options.title : "Website to video";
  const durationSec = typeof run.options?.durationSec === "number" ? Math.round(run.options.durationSec) : 8;
  const rows = await createDb(env)
    .insert(projects)
    .values({
      id: projectId,
      organizationId: auth.organization.id,
      ownerId: auth.user.id,
      title,
      prompt: `Website to video workflow from ${run.inputUrl}`,
      currentHtml: html,
      durationSec,
      visibility: "private",
    })
    .returning();
  await createDb(env).insert(projectMembers).values({
    id: crypto.randomUUID(),
    projectId,
    organizationId: auth.organization.id,
    userId: auth.user.id,
    role: "owner",
    invitedById: auth.user.id,
  });
  return rows[0] as typeof projects.$inferSelect;
}

async function persistWorkflowFiles(
  env: WorkerEnv,
  auth: AppAuthContext,
  project: typeof projects.$inferSelect,
  runId: string,
  files: Array<WorkflowWorkspaceFile>,
): Promise<Array<WorkflowArtifactRecord>> {
  const artifacts: Array<WorkflowArtifactRecord> = [];
  for (const file of files) {
    const logicalPath = file.path === "index.html" ? "index.html" : workflowProjectPath(runId, file.path);
    if (file.path === "index.html") {
      await upsertProjectFile(createDb(env), auth.organization.id, project.id, "index.html", file.content);
      await createDb(env)
        .update(projects)
        .set({ currentHtml: file.content, updatedAt: new Date() })
        .where(eq(projects.id, project.id));
    }

    const bytes = new TextEncoder().encode(file.content);
    const pointer = await writeProjectObject(env, {
      key: projectWorkspaceKey({
        organizationId: auth.organization.id,
        ownerId: project.ownerId || auth.user.id,
        projectId: project.id,
        path: logicalPath,
      }),
      bytes,
      contentType: file.contentType,
    });
    await recordProjectEntry(env, auth, project, {
      path: logicalPath,
      content: file.content,
      contentType: file.contentType,
      storage: pointer,
    });
    artifacts.push({
      path: logicalPath,
      role: artifactRoleForPath(logicalPath),
      contentType: file.contentType,
      size: bytes.byteLength,
      storage: pointer,
    });
  }
  return artifacts;
}

interface WorkflowStageVideo {
  title?: string;
  filename?: string;
  contentType?: string;
  bytesBase64: string;
  durationMs?: number;
}

async function persistStageVideos(
  env: WorkerEnv,
  auth: AppAuthContext,
  project: typeof projects.$inferSelect,
  runId: string,
  videos: Array<WorkflowStageVideo>,
): Promise<Array<WorkflowArtifactRecord>> {
  const artifacts: Array<WorkflowArtifactRecord> = [];
  for (let index = 0; index < videos.length; index += 1) {
    const video = videos[index];
    const contentType = video.contentType || "video/mp4";
    const filename = normalizeProjectPath(video.filename || `${runId}-stage-${index + 1}.mp4`);
    const bytes = decodeBase64(video.bytesBase64);
    const renderId = crypto.randomUUID();
    const archive = await writeProjectObject(env, {
      key: projectRenderArchiveKey({
        organizationId: auth.organization.id,
        ownerId: project.ownerId || auth.user.id,
        projectId: project.id,
        renderId,
        filename,
      }),
      bytes,
      contentType,
    });

    if (isBunnyStreamConfigured(env)) {
      const streamConfig = getBunnyStreamConfig(env);
      if (!streamConfig) throw new WorkflowApiError("Bunny Stream is not fully configured", 500);
      const stream = new BunnyStreamClient(streamConfig);
      const streamVideo = await stream.createVideo({
        title: video.title || `${project.title} stage video`,
        collectionId: streamConfig.collectionId,
      });
      await stream.uploadVideo(streamVideo.guid, toArrayBuffer(bytes), contentType);
      const embedUrl = stream.embedUrl(streamVideo.guid);
      const playbackUrl = stream.playbackUrl(streamVideo.guid);
      await createDb(env).insert(renders).values({
        id: renderId,
        projectId: project.id,
        organizationId: auth.organization.id,
        userId: auth.user.id,
        storageProvider: "bunny-stream",
        storageKey: streamVideo.guid,
        contentType,
        format: formatForContentType(contentType),
        streamLibraryId: streamConfig.libraryId,
        streamVideoId: streamVideo.guid,
        streamStatus: streamVideo.status == null ? "uploaded" : String(streamVideo.status),
        streamPlaybackUrl: playbackUrl,
        streamEmbedUrl: embedUrl,
        bunnyStorageKey: archive.provider === "bunny-storage" ? archive.key : null,
        sourceType: "workflow-stage-video",
        durationMs: Math.max(0, Math.round(video.durationMs ?? 0)),
      });
      artifacts.push({
        path: `renders/${filename}`,
        role: "stage-video",
        contentType,
        size: bytes.byteLength,
        storage: {
          provider: "bunny-stream",
          key: streamVideo.guid,
          streamLibraryId: streamConfig.libraryId,
          streamVideoId: streamVideo.guid,
          streamStatus: streamVideo.status == null ? "uploaded" : String(streamVideo.status),
          streamPlaybackUrl: playbackUrl,
          streamEmbedUrl: embedUrl,
        },
      });
    } else {
      artifacts.push({
        path: `renders/${filename}`,
        role: "stage-video",
        contentType,
        size: bytes.byteLength,
        storage: archive,
      });
    }
  }
  return artifacts;
}

async function recordProjectEntry(
  env: WorkerEnv,
  auth: AppAuthContext,
  project: typeof projects.$inferSelect,
  input: {
    path: string;
    content: string;
    contentType: string;
    storage: WorkflowStoragePointer;
  },
): Promise<void> {
  const path = normalizeProjectPath(input.path);
  const entryId = `${project.id}:${path}`;
  const bytes = new TextEncoder().encode(input.content);
  await createDb(env)
    .insert(projectEntries)
    .values({
      id: entryId,
      projectId: project.id,
      organizationId: auth.organization.id,
      ownerId: project.ownerId || auth.user.id,
      createdById: auth.user.id,
      updatedById: auth.user.id,
      path,
      kind: "text",
      artifactRole: artifactRoleForPath(path),
      storageProvider: input.storage.provider,
      storageKey: input.storage.key,
      contentType: input.contentType,
      size: bytes.byteLength,
      sha256: input.storage.sha256 ?? null,
      textContent: input.content,
      searchText: `${path}\n${input.content}`,
      deletedAt: null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [projectEntries.projectId, projectEntries.path],
      set: {
        kind: "text",
        artifactRole: artifactRoleForPath(path),
        storageProvider: input.storage.provider,
        storageKey: input.storage.key,
        contentType: input.contentType,
        size: bytes.byteLength,
        sha256: input.storage.sha256 ?? null,
        textContent: input.content,
        searchText: `${path}\n${input.content}`,
        deletedAt: null,
        updatedById: auth.user.id,
        updatedAt: new Date(),
      },
    });
  await recordParentFolders(env, auth, project, path);
  await createDb(env).insert(projectEntryVersions).values({
    id: crypto.randomUUID(),
    entryId,
    projectId: project.id,
    organizationId: auth.organization.id,
    createdById: auth.user.id,
    path,
    kind: "text",
    artifactRole: artifactRoleForPath(path),
    storageProvider: input.storage.provider,
    storageKey: input.storage.key,
    contentType: input.contentType,
    size: bytes.byteLength,
    sha256: input.storage.sha256 ?? null,
    textContent: input.content,
    changeKind: "workflow",
  });
}

async function recordParentFolders(
  env: WorkerEnv,
  auth: AppAuthContext,
  project: typeof projects.$inferSelect,
  path: string,
): Promise<void> {
  const parts = path.split("/");
  for (let index = 1; index < parts.length; index += 1) {
    const folderPath = parts.slice(0, index).join("/");
    await createDb(env)
      .insert(projectEntries)
      .values({
        id: `${project.id}:${folderPath}`,
        projectId: project.id,
        organizationId: auth.organization.id,
        ownerId: project.ownerId || auth.user.id,
        createdById: auth.user.id,
        updatedById: auth.user.id,
        path: folderPath,
        kind: "folder",
        artifactRole: "folder",
        storageProvider: "postgres",
        searchText: folderPath,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [projectEntries.projectId, projectEntries.path],
        set: { deletedAt: null, updatedById: auth.user.id, updatedAt: new Date() },
      });
  }
}

async function updateRun(
  env: WorkerEnv,
  runId: string,
  organizationId: string,
  values: Partial<typeof workflowRuns.$inferInsert>,
): Promise<void> {
  await createDb(env)
    .update(workflowRuns)
    .set(values)
    .where(and(eq(workflowRuns.id, runId), eq(workflowRuns.organizationId, organizationId)));
}

function progress(current: number, label: string): WorkflowProgress {
  return {
    current,
    total: 6,
    label,
  };
}

function jsonRecord(value: object): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function asStatus(value: unknown): WorkflowStatus {
  const status = String(value) as WorkflowStatus;
  return ["queued", "running", "awaiting_approval", "succeeded", "failed", "cancelled"].includes(status)
    ? status
    : "failed";
}

function asPhase(value: unknown): WorkflowPhase {
  const phase = String(value) as WorkflowPhase;
  return ["preflight", "capture", "compose", "validate", "persist", "complete"].includes(phase)
    ? phase
    : "preflight";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asProgress(value: unknown): WorkflowProgress | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    current: typeof record.current === "number" ? record.current : 0,
    total: typeof record.total === "number" ? record.total : 6,
    label: typeof record.label === "string" ? record.label : "",
  };
}

function asManifest(value: unknown): WorkflowArtifactManifest | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    runId: typeof record.runId === "string" ? record.runId : "",
    skillId: typeof record.skillId === "string" ? record.skillId : WEBSITE_TO_VIDEO_SKILL_ID,
    artifacts: Array.isArray(record.artifacts) ? record.artifacts as WorkflowArtifactManifest["artifacts"] : [],
    skippedSteps: Array.isArray(record.skippedSteps) ? record.skippedSteps as WorkflowArtifactManifest["skippedSteps"] : [],
    warnings: Array.isArray(record.warnings) ? record.warnings as Array<string> : [],
    studioUrl: typeof record.studioUrl === "string" ? record.studioUrl : null,
  };
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return null;
}

function isoOrNull(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function encodeBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decodeBase64(content: string): Uint8Array {
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function artifactRoleForPath(path: string): string {
  if (/design/i.test(path)) return "design";
  if (/script/i.test(path)) return "script";
  if (/storyboard/i.test(path)) return "storyboard";
  if (/snapshots?\//.test(path)) return "snapshot";
  if (/renders?\//.test(path)) return "stage-video";
  if (path === "index.html" || path.endsWith(".html")) return "composition";
  return "workflow-artifact";
}

function mimeForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "html":
    case "htm":
      return "text/html; charset=utf-8";
    case "css":
      return "text/css; charset=utf-8";
    case "js":
    case "mjs":
      return "text/javascript; charset=utf-8";
    case "json":
      return "application/json; charset=utf-8";
    case "md":
    case "txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function formatForContentType(contentType: string): string {
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("quicktime")) return "mov";
  return "mp4";
}

function currentPhaseFromError(err: unknown): WorkflowPhase {
  if (err instanceof WorkflowApiError && err.status < 500) return "preflight";
  return "validate";
}

function workflowErrorResponse(err: unknown): Response {
  if (err instanceof WorkflowApiError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof z.ZodError) {
    return Response.json({ error: "invalid workflow request" }, { status: 400 });
  }
  return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
}
