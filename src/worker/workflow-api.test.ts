import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthContext: vi.fn(),
  selectRows: [] as Array<Array<Record<string, unknown>>>,
  inserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
}));

function nextSelectRows() {
  return Promise.resolve(mocks.selectRows.shift() ?? []);
}

function selectChain() {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(nextSelectRows),
    limit: vi.fn(nextSelectRows),
  };
  return chain;
}

vi.mock("@cloudflare/containers", () => ({
  Container: class {},
  getContainer: () => ({
    fetch: vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
  }),
}));

vi.mock("../db", () => ({
  createDb: () => ({
    select: vi.fn(selectChain),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        mocks.inserts.push(values);
        return {
          returning: vi.fn(() => Promise.resolve([values])),
          onConflictDoUpdate: vi.fn(() => Promise.resolve()),
          onConflictDoNothing: vi.fn(() => Promise.resolve()),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        mocks.updates.push(values);
        return { where: vi.fn(() => Promise.resolve()) };
      }),
    })),
  }),
}));

vi.mock("../auth", () => ({ createAuth: () => ({ handler: vi.fn() }) }));

vi.mock("../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth-context")>("../lib/auth-context");
  return { ...actual, requireAuthContext: mocks.requireAuthContext };
});

vi.mock("../lib/generate", () => ({
  DEFAULT_MODEL: "google/gemini-3-flash-preview",
  GenerateError: class GenerateError extends Error {
    status = 500;
  },
  generateComposition: () => {
    throw new Error("generation is not used in this unit test");
  },
}));

import { AuthRequiredError } from "../lib/auth-context";
import { handleWorkerApi, type WorkerEnv } from "./render-api";

const member = {
  user: { id: "user-1", name: "Member", email: "member@example.com", role: "user" },
  organization: { id: "org-1", name: "Acme" },
};

const env = {
  ENABLE_AI_GEN: "true",
  ENABLE_WEBSITE_TO_VIDEO_WORKFLOW: "true",
} as WorkerEnv;

describe("website-to-video workflow API", () => {
  beforeEach(() => {
    mocks.requireAuthContext.mockReset();
    mocks.requireAuthContext.mockResolvedValue(member);
    mocks.selectRows = [];
    mocks.inserts = [];
    mocks.updates = [];
  });

  it("reports workflow runner availability in client config", async () => {
    const response = await handleWorkerApi(new Request("https://mf.test/api/config"), env);

    await expect(response?.json()).resolves.toMatchObject({
      websiteToVideoWorkflowEnabled: true,
    });
  });

  it("rejects unauthenticated workflow starts before parsing work", async () => {
    mocks.requireAuthContext.mockRejectedValue(new AuthRequiredError());

    const response = await handleWorkerApi(
      new Request("https://mf.test/api/workflows/website-to-video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
      env,
    );

    expect(response?.status).toBe(401);
    expect(mocks.inserts).toHaveLength(0);
  });

  it("rejects workflow starts when the feature flag is disabled", async () => {
    const response = await handleWorkerApi(
      new Request("https://mf.test/api/workflows/website-to-video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
      { ...env, ENABLE_WEBSITE_TO_VIDEO_WORKFLOW: "false" },
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: "website-to-video workflow runner is disabled",
    });
  });

  it("validates URL safety before creating a workflow run", async () => {
    const response = await handleWorkerApi(
      new Request("https://mf.test/api/workflows/website-to-video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://127.0.0.1/admin" }),
      }),
      env,
    );

    expect(response?.status).toBe(400);
    expect(mocks.inserts).toHaveLength(0);
  });

  it("creates a tenant-scoped queued run and returns compact client state", async () => {
    mocks.selectRows = [[]]; // active quota lookup

    const response = await handleWorkerApi(
      new Request("https://mf.test/api/workflows/website-to-video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", durationSec: 8 }),
      }),
      env,
    );

    expect(response?.status).toBe(202);
    const body = await response?.json();
    expect(body).toMatchObject({
      workflowRun: {
        skillId: "website-to-video",
        status: "queued",
        phase: "preflight",
        inputUrl: "https://example.com/",
      },
    });
    expect(mocks.inserts[0]).toMatchObject({
      organizationId: "org-1",
      userId: "user-1",
      skillId: "website-to-video",
      status: "queued",
      phase: "preflight",
      inputUrl: "https://example.com/",
    });
  });

  it("returns only organization-scoped workflow status", async () => {
    mocks.selectRows = [[{
      id: "run-1",
      organizationId: "org-1",
      userId: "user-1",
      projectId: "project-1",
      skillId: "website-to-video",
      status: "succeeded",
      phase: "complete",
      inputUrl: "https://example.com/",
      options: {},
      progress: { current: 6, total: 6, label: "Complete" },
      artifactManifest: { runId: "run-1", skillId: "website-to-video", artifacts: [], skippedSteps: [] },
      error: null,
      createdAt: new Date("2026-06-29T12:00:00Z"),
      updatedAt: new Date("2026-06-29T12:01:00Z"),
      startedAt: null,
      completedAt: new Date("2026-06-29T12:01:00Z"),
    }]];

    const response = await handleWorkerApi(
      new Request("https://mf.test/api/workflows/run-1"),
      env,
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      workflowRun: {
        id: "run-1",
        status: "succeeded",
        studioUrl: "/projects/project-1/studio",
      },
    });
  });

  it("returns an adaptive wizard stage plan for a workflow run", async () => {
    mocks.selectRows = [[{
      id: "run-1",
      organizationId: "org-1",
      userId: "user-1",
      projectId: null,
      skillId: "website-to-video",
      status: "succeeded",
      phase: "complete",
      inputUrl: "https://example.com/",
      options: {},
      progress: { current: 6, total: 6, label: "Complete" },
      artifactManifest: {
        runId: "run-1",
        skillId: "website-to-video",
        artifacts: [
          {
            path: "pipeline/website-to-video/run-1/DESIGN.md",
            role: "design",
            contentType: "text/markdown",
            size: 20,
            storage: { provider: "postgres", key: null },
          },
        ],
        skippedSteps: [
          { id: "voice", label: "Voiceover generation", reason: "Voice is not configured." },
        ],
      },
      error: null,
      createdAt: new Date("2026-06-29T12:00:00Z"),
      updatedAt: new Date("2026-06-29T12:01:00Z"),
      startedAt: null,
      completedAt: new Date("2026-06-29T12:01:00Z"),
    }]];

    const response = await handleWorkerApi(
      new Request("https://mf.test/api/workflows/run-1/stages"),
      env,
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      stagePlan: {
        runId: "run-1",
        workflowId: "website-to-video",
        stages: expect.arrayContaining([
          expect.objectContaining({ id: "design", status: "ready", editable: true }),
          expect.objectContaining({ id: "vo-timing", status: "skipped" }),
        ]),
      },
    });
  });
});
