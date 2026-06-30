import { beforeEach, describe, expect, it, vi } from "vitest";

const workerMocks = vi.hoisted(() => {
  class MockAuthRequiredError extends Error {
    status = 401;
  }

  class MockForbiddenError extends Error {
    status = 403;
  }

  const authContext = {
    user: {
      id: "user-1",
      name: "Taylor",
      email: "taylor@example.com",
      role: "user",
      banned: false,
    },
    organization: {
      id: "org-1",
      name: "Acme",
      role: "member",
      isBootstrap: false,
    },
  };

  const state = {
    authContext,
    projects: [] as Array<Record<string, unknown>>,
    insertedProjects: [] as Array<Record<string, unknown>>,
    insertedMembers: [] as Array<Record<string, unknown>>,
    projectAccess: new Map<string, Record<string, unknown> | Error>(),
  };

  function tableName(table: unknown): string {
    const symbol = Object.getOwnPropertySymbols(table as object).find(
      (item) => item.toString() === "Symbol(drizzle:Name)",
    );
    return symbol ? String((table as Record<symbol, unknown>)[symbol]) : "";
  }

  class SelectBuilder {
    table = "";
    conditions: Array<unknown> = [];

    constructor(private shape?: Record<string, unknown>) {}

    from(table: unknown) {
      this.table = tableName(table);
      return this;
    }

    leftJoin() {
      return this;
    }

    where(condition?: unknown) {
      if (condition) this.conditions.push(condition);
      return this;
    }

    orderBy() {
      return this;
    }

    limit() {
      return this;
    }

    execute() {
      const rows = this.table === "projects" ? filteredProjects(this.conditions) : [];
      if (this.table === "projects" && this.shape && "project" in this.shape) {
        return rows.map((project) => ({ project }));
      }
      if (this.table === "projects") return rows;
      return [];
    }

    then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve(this.execute()).then(resolve, reject);
    }
  }

  function filteredProjects(conditions: Array<unknown>) {
    const ilikeChecks = conditions.flatMap((condition) => collectIlikeChecks(condition));
    if (!ilikeChecks.length) return state.projects;
    return state.projects.filter((project) =>
      ilikeChecks.some(({ column, needle }) => {
        const value = project[column];
        return (
          typeof value === "string" &&
          value.toLowerCase().includes(needle.toLowerCase())
        );
      }),
    );
  }

  function collectIlikeChecks(value: unknown): Array<{ column: string; needle: string }> {
    if (!value || typeof value !== "object") return [];
    const chunks = (value as { queryChunks?: Array<unknown> }).queryChunks;
    if (!Array.isArray(chunks)) return [];
    const checks: Array<{ column: string; needle: string }> = [];
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      if (
        chunk &&
        typeof chunk === "object" &&
        "name" in chunk &&
        typeof (chunk as { name?: unknown }).name === "string"
      ) {
        const needle = chunks
          .slice(index + 1)
          .find((item): item is string => typeof item === "string");
        if (needle) checks.push({ column: (chunk as { name: string }).name, needle: needle.replace(/%/g, "") });
      }
      checks.push(...collectIlikeChecks(chunk));
    }
    return checks;
  }

  class InsertBuilder {
    rows: Array<Record<string, unknown>> = [];

    constructor(private table: string) {}

    values(value: Record<string, unknown>) {
      this.rows = [value];
      if (this.table === "projects") {
        state.insertedProjects.push(value);
        state.projects.unshift({
          id: value.id,
          organizationId: value.organizationId,
          ownerId: value.ownerId,
          title: value.title,
          description: value.description ?? null,
          prompt: value.prompt ?? null,
          currentHtml: value.currentHtml ?? null,
          durationSec: value.durationSec,
          status: "draft",
          visibility: value.visibility ?? "private",
          createdAt: new Date("2026-06-30T12:00:00Z"),
          updatedAt: new Date("2026-06-30T12:00:00Z"),
        });
      }
      if (this.table === "project_members") state.insertedMembers.push(value);
      return this;
    }

    returning() {
      if (this.table === "projects") return Promise.resolve([state.projects[0]]);
      return Promise.resolve(this.rows);
    }
  }

  class UpdateBuilder {
    patch: Record<string, unknown> = {};

    constructor(private table: string) {}

    set(value: Record<string, unknown>) {
      this.patch = value;
      return this;
    }

    where() {
      return this;
    }

    returning() {
      if (this.table !== "projects") return Promise.resolve([]);
      const project = state.projects[0] ?? {};
      Object.assign(project, this.patch);
      return Promise.resolve([project]);
    }
  }

  const db = {
    select: (shape?: Record<string, unknown>) => new SelectBuilder(shape),
    insert: (table: unknown) => new InsertBuilder(tableName(table)),
    update: (table: unknown) => new UpdateBuilder(tableName(table)),
  };

  function reset() {
    state.projects = [];
    state.insertedProjects = [];
    state.insertedMembers = [];
    state.projectAccess = new Map();
    state.authContext = authContext;
  }

  return {
    AuthRequiredError: MockAuthRequiredError,
    ForbiddenError: MockForbiddenError,
    db,
    reset,
    state,
  };
});

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

vi.mock("../db", () => ({
  createDb: () => workerMocks.db,
}));

vi.mock("../lib/auth-context", () => ({
  AuthRequiredError: workerMocks.AuthRequiredError,
  ForbiddenError: workerMocks.ForbiddenError,
  assertAdmin: () => {},
  isOrganizationAdmin: (context: { user?: { role?: string | null }; organization?: { role?: string | null } }) =>
    [context.user?.role, context.organization?.role].some((role) =>
      (role ?? "").split(",").map((item) => item.trim()).includes("admin"),
    ),
  requireAuthContext: vi.fn(async () => workerMocks.state.authContext),
  requireProjectAccess: vi.fn(async (_context, projectId: string) => {
    const result = workerMocks.state.projectAccess.get(projectId);
    if (result instanceof Error) throw result;
    return result ?? workerMocks.state.projects.find((project) => project.id === projectId);
  }),
  requirePublishedProjectAccess: vi.fn(),
}));

import { handleWorkerApi, type WorkerEnv } from "./render-api";
import { projects } from "../db/schema";

describe("handleWorkerApi", () => {
  beforeEach(() => {
    workerMocks.reset();
  });

  it("returns deployment config for the React client", async () => {
    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/config"),
      { ENABLE_AI_GEN: "true" } as WorkerEnv,
    );

    expect(response).toBeInstanceOf(Response);
    expect(response?.headers.get("cache-control")).toBe("public, max-age=300");
    await expect(response?.json()).resolves.toEqual({
      aiGenEnabled: true,
      websiteToVideoWorkflowEnabled: false,
      modelLabel: "google/gemini-3-flash-preview",
    });
  });

  it("answers Better Auth Dash CORS preflight requests", async () => {
    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/auth/dash/validate", {
        method: "OPTIONS",
        headers: {
          origin: "https://dash.better-auth.com",
          "access-control-request-method": "GET",
          "access-control-request-headers": "authorization",
        },
      }),
      { ENABLE_AI_GEN: "true" } as WorkerEnv,
    );

    expect(response?.status).toBe(204);
    expect(response?.headers.get("access-control-allow-origin")).toBe(
      "https://dash.better-auth.com",
    );
    expect(response?.headers.get("access-control-allow-headers")).toContain(
      "authorization",
    );
  });

  it("lets TanStack Start handle non-worker routes", async () => {
    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/"),
      { ENABLE_AI_GEN: "true" } as WorkerEnv,
    );

    expect(response).toBeNull();
  });

  it("persists optional project descriptions when creating projects", async () => {
    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Launch reel",
          description: "A short launch-week edit",
          prompt: "Make it crisp.",
        }),
      }),
      {} as WorkerEnv,
    );

    expect(response?.status).toBe(201);
    const body = (await response?.json()) as { project: { description?: string | null } };
    expect(workerMocks.state.insertedProjects[0]).toMatchObject({
      title: "Launch reel",
      description: "A short launch-week edit",
    });
    expect(body.project.description).toBe("A short launch-week edit");
  });

  it("trims and clears optional project descriptions when updating metadata", async () => {
    workerMocks.state.projects = [
      {
        id: "project-1",
        organizationId: "org-1",
        ownerId: "user-1",
        title: "Old title",
        description: "Old description",
        durationSec: 6,
        visibility: "private",
      },
    ];
    workerMocks.state.projectAccess.set("project-1", workerMocks.state.projects[0]);

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/projects/project-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: " Renamed ",
          description: "   ",
        }),
      }),
      {} as WorkerEnv,
    );

    expect(response?.status).toBe(200);
    const body = (await response?.json()) as { project: { title: string; description: string | null } };
    expect(body.project.title).toBe("Renamed");
    expect(body.project.description).toBeNull();
  });

  it("rejects project metadata updates without edit access", async () => {
    workerMocks.state.projectAccess.set(
      "project-1",
      new workerMocks.ForbiddenError("project access denied"),
    );

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/projects/project-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Nope",
          description: "Do not save this",
        }),
      }),
      {} as WorkerEnv,
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: "project access denied",
    });
  });

  it("searches accessible project descriptions without returning inaccessible matches", async () => {
    workerMocks.state.projects = [
      {
        id: "project-1",
        organizationId: "org-1",
        ownerId: "user-1",
        title: "Accessible",
        description: "Product launch countdown",
        prompt: null,
        durationSec: 6,
        visibility: "private",
      },
      {
        id: "project-2",
        organizationId: "org-1",
        ownerId: "other-user",
        title: "Hidden",
        description: "Product launch countdown",
        prompt: null,
        durationSec: 6,
        visibility: "private",
      },
    ];
    workerMocks.state.projectAccess.set("project-1", workerMocks.state.projects[0]);
    workerMocks.state.projectAccess.set(
      "project-2",
      new workerMocks.ForbiddenError("project access denied"),
    );

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/projects/search?q=countdown"),
      {} as WorkerEnv,
    );

    expect(response?.status).toBe(200);
    const body = (await response?.json()) as { projects: Array<{ id: string; description?: string | null }> };
    expect(body.projects).toEqual([
      expect.objectContaining({
        id: "project-1",
        description: "Product launch countdown",
      }),
    ]);
  });

  it("defines descriptions as first-class nullable project metadata", () => {
    expect(projects.description).toBeDefined();
    expect(projects.description.notNull).toBe(false);
  });
});
