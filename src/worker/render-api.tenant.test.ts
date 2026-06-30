import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@cloudflare/containers", () => ({
  Container: class {},
  getContainer: () => {
    throw new Error("container rendering is not used in this unit test");
  },
}));

vi.mock("../lib/generate", () => ({
  DEFAULT_MODEL: "google/gemini-3-flash-preview",
  GenerateError: class GenerateError extends Error {
    status = 500;
  },
  generateComposition: () => {
    throw new Error("generation is not used in this unit test");
  },
}));

const apiMocks = vi.hoisted(() => ({
  tableName: (table: unknown): string => {
    const symbol = Object.getOwnPropertySymbols(table as object).find(
      (item) => item.toString() === "Symbol(drizzle:Name)",
    );
    return symbol ? String((table as Record<symbol, unknown>)[symbol]) : "";
  },
  requireAuthContext: vi.fn(),
  createUser: vi.fn(),
  changePassword: vi.fn(),
  selectShapes: [] as Array<unknown>,
  selectRows: [] as Array<Array<Record<string, unknown>>>,
  returningRows: [] as Array<Array<Record<string, unknown>>>,
  inserts: [] as Array<{ values: Record<string, unknown> }>,
  updates: [] as Array<{ values: Record<string, unknown> }>,
  deletes: [] as Array<{ table: string }>,
}));

function nextSelectRows() {
  return Promise.resolve(apiMocks.selectRows.shift() ?? []);
}

function nextReturningRows(fallback: Record<string, unknown>) {
  return Promise.resolve(apiMocks.returningRows.shift() ?? [fallback]);
}

function selectChain(shape?: unknown) {
  apiMocks.selectShapes.push(shape);
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(nextSelectRows),
    limit: vi.fn(nextSelectRows),
    then: vi.fn((resolve: (value: Array<Record<string, unknown>>) => unknown, reject?: (reason: unknown) => unknown) =>
      nextSelectRows().then(resolve, reject),
    ),
  };
  return chain;
}

function updateChain() {
  let values: Record<string, unknown> = {};
  const chain = {
    set: vi.fn((nextValues: Record<string, unknown>) => {
      values = nextValues;
      apiMocks.updates.push({ values });
      return chain;
    }),
    where: vi.fn(() => chain),
    returning: vi.fn(() => nextReturningRows(values)),
  };
  return chain;
}

vi.mock("../db", () => ({
  createDb: () => ({
    select: vi.fn(selectChain),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        apiMocks.inserts.push({ values });
        return {
          returning: vi.fn(() => nextReturningRows(values)),
          onConflictDoUpdate: vi.fn(() => Promise.resolve()),
          onConflictDoNothing: vi.fn(() => Promise.resolve()),
        };
      }),
    })),
    update: vi.fn(updateChain),
    delete: vi.fn((table: unknown) => ({
      where: vi.fn(() => {
        apiMocks.deletes.push({ table: apiMocks.tableName(table) });
        return Promise.resolve();
      }),
    })),
  }),
}));

vi.mock("../auth", () => ({
  createAuth: () => ({
    api: {
      createUser: apiMocks.createUser,
      changePassword: apiMocks.changePassword,
    },
    handler: vi.fn(),
  }),
}));

vi.mock("../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth-context")>(
    "../lib/auth-context",
  );
  return {
    ...actual,
    requireAuthContext: apiMocks.requireAuthContext,
  };
});

import { handleWorkerApi, type WorkerEnv } from "./render-api";

const baseEnv = {
  ENABLE_AI_GEN: "true",
  OPENROUTER_API_KEY: "test-key",
  RENDERS: {
    get: vi.fn(),
  },
} as unknown as WorkerEnv;

const adminContext = {
  user: {
    id: "admin-1",
    name: "Admin",
    email: "admin@example.com",
    role: "admin",
  },
  organization: {
    id: "org-1",
    name: "Acme",
  },
};

const memberContext = {
  user: {
    id: "user-1",
    name: "Member",
    email: "member@example.com",
    role: "user",
  },
  organization: {
    id: "org-1",
    name: "Acme",
  },
};

describe("tenant-aware worker APIs", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    apiMocks.requireAuthContext.mockReset();
    apiMocks.createUser.mockReset();
    apiMocks.changePassword.mockReset();
    apiMocks.selectShapes = [];
    apiMocks.selectRows = [];
    apiMocks.returningRows = [];
    apiMocks.inserts = [];
    apiMocks.updates = [];
    apiMocks.deletes = [];
  });

  it("creates invited users in an existing organization", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(adminContext);
    apiMocks.createUser.mockResolvedValue({ user: { id: "new-user", email: "new@example.com" } });
    apiMocks.selectRows = [[{ id: "org-1", name: "Acme" }]];

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "New User",
          email: "New@Example.com",
          password: "password-1234",
          role: "user",
          organizationId: "org-1",
        }),
      }),
      baseEnv,
    );

    expect(response?.status).toBe(201);
    expect(apiMocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "new@example.com",
          name: "New User",
          role: "user",
        }),
      }),
    );
    expect(apiMocks.inserts).toContainEqual(
      expect.objectContaining({
        values: expect.objectContaining({
          organizationId: "org-1",
          userId: "new-user",
        }),
      }),
    );
  });

  it("creates a new organization inline when inviting a user", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(adminContext);
    apiMocks.createUser.mockResolvedValue({ user: { id: "new-admin" } });
    apiMocks.returningRows = [[{ id: "org-new", name: "New Org", slug: "new-org" }]];

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "New Admin",
          email: "admin2@example.com",
          password: "password-1234",
          role: "admin",
          organizationName: "New Org",
        }),
      }),
      baseEnv,
    );

    expect(response?.status).toBe(201);
    expect(apiMocks.inserts[0]?.values).toMatchObject({
      name: "New Org",
    });
    expect(apiMocks.inserts[1]?.values).toMatchObject({
      organizationId: "org-new",
      userId: "new-admin",
    });
  });

  it("ignores tenant and role mutation attempts from profile updates", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    apiMocks.returningRows = [[{ id: "user-1", name: "Renamed", email: "member@example.com" }]];

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Renamed",
          organizationId: "org-2",
          role: "admin",
          banned: true,
        }),
      }),
      baseEnv,
    );

    expect(response?.status).toBe(200);
    expect(apiMocks.updates[0]?.values).toMatchObject({ name: "Renamed" });
    expect(apiMocks.updates[0]?.values).not.toHaveProperty("organizationId");
    expect(apiMocks.updates[0]?.values).not.toHaveProperty("role");
    expect(apiMocks.updates[0]?.values).not.toHaveProperty("banned");
  });

  it("surfaces password change failures without changing profile data", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    apiMocks.changePassword.mockRejectedValue(new Error("invalid current password"));

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/profile/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: "wrong",
          newPassword: "new-password-1234",
        }),
      }),
      baseEnv,
    );

    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toEqual({ error: "invalid current password" });
  });

  it("denies cross-organization project access", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    apiMocks.selectRows = [[{ id: "project-2", organizationId: "org-2" }]];

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/projects/project-2"),
      baseEnv,
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: "organization access denied" });
  });

  it("denies private same-organization project access to non-members", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    apiMocks.selectRows = [[{ id: "project-2", organizationId: "org-1", ownerId: "other-user", visibility: "private" }], []];

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/projects/project-2"),
      baseEnv,
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: "project access denied" });
  });

  it("allows organization-shared project access inside the organization", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    apiMocks.selectRows = [[{ id: "project-2", organizationId: "org-1", ownerId: "other-user", visibility: "organization" }]];

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/projects/project-2"),
      baseEnv,
    );

    expect(response?.status).toBe(200);
  });

  it("creates projects as private and records owner membership", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    apiMocks.returningRows = [[{ id: "project-new", organizationId: "org-1", ownerId: "user-1", visibility: "private" }]];

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Private draft" }),
      }),
      baseEnv,
    );

    expect(response?.status).toBe(201);
    expect(apiMocks.inserts[0]?.values).toMatchObject({ visibility: "private", ownerId: "user-1" });
    expect(apiMocks.inserts[1]?.values).toMatchObject({
      projectId: apiMocks.inserts[0]?.values.id,
      userId: "user-1",
      role: "owner",
    });
  });

  it("lists projects with a library-sized selection instead of full project rows", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    apiMocks.selectRows = [
      [
        {
          id: "project-1",
          organizationId: "org-1",
          ownerId: "user-1",
          title: "Launch reel",
          description: "A short launch-week edit",
          durationSec: 6,
          status: "draft",
          visibility: "private",
          createdAt: new Date("2026-06-30T12:00:00Z"),
          updatedAt: new Date("2026-06-30T12:30:00Z"),
        },
      ],
    ];

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/projects"),
      baseEnv,
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      projects: [
        expect.objectContaining({
          id: "project-1",
          title: "Launch reel",
          description: "A short launch-week edit",
        }),
      ],
    });
    expect(apiMocks.selectShapes[0]).toEqual(
      expect.objectContaining({
        id: expect.anything(),
        title: expect.anything(),
        description: expect.anything(),
        updatedAt: expect.anything(),
      }),
    );
    expect(apiMocks.selectShapes[0]).not.toHaveProperty("currentHtml");
    expect(apiMocks.selectShapes[0]).not.toHaveProperty("prompt");
  });

  it("deletes project database rows and stored project artifacts permanently", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const r2Delete = vi.fn(async () => undefined);
    apiMocks.selectRows = [
      [{ id: "project-1", organizationId: "org-1", ownerId: "user-1", title: "Launch reel", visibility: "private" }],
      [
        { r2Key: "assets/orgs/org-1/users/user-1/projects/project-1/workspace/assets/logo.png", storageProvider: "r2", storageKey: null },
        { r2Key: null, storageProvider: "bunny-storage", storageKey: "orgs/org-1/users/user-1/projects/project-1/workspace/assets/hero.png" },
      ],
      [
        { storageProvider: "bunny-storage", storageKey: "orgs/org-1/users/user-1/projects/project-1/workspace/DESIGN.md", streamVideoId: null },
        { storageProvider: "bunny-stream", storageKey: "stream-entry", streamVideoId: "stream-entry" },
      ],
      [
        { storageProvider: "bunny-storage", storageKey: "orgs/org-1/users/user-1/projects/project-1/versions/v1/index.html", streamVideoId: null },
      ],
      [
        { r2Key: "renders/org-1/render.mp4", storageProvider: "r2", storageKey: "renders/org-1/render.mp4", bunnyStorageKey: null, streamVideoId: null },
        { r2Key: null, storageProvider: "bunny-stream", storageKey: "stream-render", bunnyStorageKey: "orgs/org-1/users/user-1/projects/project-1/renders/render-2/output.mp4", streamVideoId: "stream-render" },
      ],
      [
        {
          artifactManifest: {
            artifacts: [
              { storage: { provider: "bunny-storage", key: "orgs/org-1/users/user-1/projects/project-1/workspace/workflow.txt" } },
              { storage: { provider: "bunny-stream", key: "stream-workflow", streamVideoId: "stream-workflow" } },
            ],
          },
        },
      ],
    ];

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/projects/project-1", {
        method: "DELETE",
      }),
      {
        ...baseEnv,
        RENDERS: { delete: r2Delete },
        BUNNY_STORAGE_ZONE_NAME: "zone",
        BUNNY_STORAGE_ACCESS_KEY: "storage-secret",
        BUNNY_STORAGE_ENDPOINT: "https://la.storage.bunnycdn.com",
        BUNNY_STREAM_LIBRARY_ID: "123",
        BUNNY_STREAM_ACCESS_KEY: "stream-secret",
        BUNNY_STREAM_API_BASE: "https://video.bunnycdn.com",
      } as unknown as WorkerEnv,
    );

    const body = await response?.json();
    expect(response?.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(r2Delete).toHaveBeenCalledWith("assets/orgs/org-1/users/user-1/projects/project-1/workspace/assets/logo.png");
    expect(r2Delete).toHaveBeenCalledWith("renders/org-1/render.mp4");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://la.storage.bunnycdn.com/zone/orgs/org-1/users/user-1/projects/project-1/workspace/assets/hero.png",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://video.bunnycdn.com/library/123/videos/stream-render",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://video.bunnycdn.com/library/123/videos/stream-workflow",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(apiMocks.deletes.map((item) => item.table)).toEqual([
      "renders",
      "workflow_runs",
      "projects",
    ]);
  });

  it("lets a project owner share with the organization and records an audit row", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    apiMocks.selectRows = [[{ id: "project-1", organizationId: "org-1", ownerId: "user-1", visibility: "private" }]];
    apiMocks.returningRows = [[{ id: "project-1", visibility: "organization" }]];

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/projects/project-1/share", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visibility: "organization" }),
      }),
      baseEnv,
    );

    expect(response?.status).toBe(200);
    expect(apiMocks.updates[0]?.values).toMatchObject({ visibility: "organization" });
    expect(apiMocks.inserts).toContainEqual(
      expect.objectContaining({
        values: expect.objectContaining({
          projectId: "project-1",
          action: "visibility",
          previousValue: "private",
          newValue: "organization",
        }),
      }),
    );
  });

  it("serves a project preview to a same-organization member", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    apiMocks.selectRows = [
      [{ id: "project-1", organizationId: "org-1" }], // requireProjectAccess
      [], // project_files index.html lookup (no files yet)
      [{ currentHtml: "<html><body>preview-body</body></html>" }], // currentHtml mirror fallback
    ];

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/projects/project-1/preview"),
      baseEnv,
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("text/html");
    await expect(response?.text()).resolves.toContain("preview-body");
  });

  it("persists Studio source edits and records a version", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    // requireProjectAccess lookup, then update().returning()
    apiMocks.selectRows = [[{ id: "project-1", organizationId: "org-1", ownerId: "user-1", visibility: "private" }]];
    apiMocks.returningRows = [[{ id: "project-1", currentHtml: "<h1>edited</h1>" }]];

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/projects/project-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ html: "<h1>edited</h1>" }),
      }),
      baseEnv,
    );

    expect(response?.status).toBe(200);
    expect(apiMocks.updates[0]?.values).toMatchObject({ currentHtml: "<h1>edited</h1>" });
    expect(apiMocks.inserts).toContainEqual(
      expect.objectContaining({
        values: expect.objectContaining({
          projectId: "project-1",
          organizationId: "org-1",
          html: "<h1>edited</h1>",
        }),
      }),
    );
  });

  it("denies cross-organization project preview", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    apiMocks.selectRows = [[{ id: "project-9", organizationId: "org-2" }]];

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/projects/project-9/preview"),
      baseEnv,
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: "organization access denied" });
  });

  it("does not serve cross-organization render objects", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    apiMocks.selectRows = [[{ organizationId: "org-2" }]];

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/r/renders/org-2/example.mp4"),
      baseEnv,
    );

    expect(response?.status).toBe(404);
    expect(baseEnv.RENDERS.get).not.toHaveBeenCalled();
  });

  it("denies cross-organization published project remix", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    apiMocks.selectRows = [[{ id: "published-2", organizationId: "org-2" }]];

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/published/published-2/remix", {
        method: "POST",
      }),
      baseEnv,
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: "organization access denied" });
  });
});
