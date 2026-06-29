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

const mocks = vi.hoisted(() => ({
  requireAuthContext: vi.fn(),
  selectRows: [] as Array<Array<Record<string, unknown>>>,
  inserts: [] as Array<Record<string, unknown>>,
  conflictUpdates: [] as Array<Record<string, unknown>>,
}));

function nextSelectRows() {
  return Promise.resolve(mocks.selectRows.shift() ?? []);
}

function selectChain() {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(nextSelectRows),
    limit: vi.fn(nextSelectRows),
  };
  return chain;
}

vi.mock("../db", () => ({
  createDb: () => ({
    select: vi.fn(selectChain),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        mocks.inserts.push(values);
        return {
          onConflictDoUpdate: vi.fn((cfg: { set: Record<string, unknown> }) => {
            mocks.conflictUpdates.push(cfg.set);
            return Promise.resolve();
          }),
          onConflictDoNothing: vi.fn(() => Promise.resolve()),
          returning: vi.fn(() => Promise.resolve([values])),
        };
      }),
    })),
    delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
  }),
}));

vi.mock("../auth", () => ({ createAuth: () => ({ handler: vi.fn() }) }));

vi.mock("../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth-context")>("../lib/auth-context");
  return { ...actual, requireAuthContext: mocks.requireAuthContext };
});

import { AuthRequiredError } from "../lib/auth-context";
import { handleWorkerApi, type WorkerEnv } from "./render-api";

const env = { ENABLE_AI_GEN: "true" } as WorkerEnv;
const member = {
  user: { id: "user-1", name: "Member", email: "m@e.com", role: "user" },
  organization: { id: "org-1", name: "Acme" },
};

describe("studio multi-file API", () => {
  beforeEach(() => {
    mocks.requireAuthContext.mockReset();
    mocks.requireAuthContext.mockResolvedValue(member);
    mocks.selectRows = [];
    mocks.inserts = [];
    mocks.conflictUpdates = [];
  });

  it("rejects unauthenticated file access", async () => {
    mocks.requireAuthContext.mockRejectedValue(new AuthRequiredError());
    const res = await handleWorkerApi(
      new Request("https://mf.test/api/projects/p1/files"),
      env,
    );
    expect(res?.status).toBe(401);
  });

  it("denies cross-organization file access", async () => {
    mocks.selectRows = [[{ id: "p1", organizationId: "org-2" }]]; // requireProjectAccess
    const res = await handleWorkerApi(
      new Request("https://mf.test/api/projects/p1/files"),
      env,
    );
    expect(res?.status).toBe(403);
  });

  it("lists files for the owning organization", async () => {
    mocks.selectRows = [
      [{ id: "p1", organizationId: "org-1" }], // requireProjectAccess
      [{ path: "index.html" }, { path: "compositions/intro.html" }], // list
    ];
    const res = await handleWorkerApi(
      new Request("https://mf.test/api/projects/p1/files"),
      env,
    );
    expect(res?.status).toBe(200);
    await expect(res?.json()).resolves.toEqual({
      files: ["index.html", "compositions/intro.html"],
    });
  });

  it("upserts a file's content", async () => {
    mocks.selectRows = [[{ id: "p1", organizationId: "org-1" }]]; // requireProjectAccess
    const res = await handleWorkerApi(
      new Request("https://mf.test/api/projects/p1/files/index.html", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "<h1>hi</h1>" }),
      }),
      env,
    );
    expect(res?.status).toBe(200);
    await expect(res?.json()).resolves.toEqual({ path: "index.html" });
    expect(mocks.inserts[0]).toMatchObject({
      projectId: "p1",
      organizationId: "org-1",
      path: "index.html",
      content: "<h1>hi</h1>",
    });
    expect(mocks.conflictUpdates[0]).toMatchObject({ content: "<h1>hi</h1>" });
  });

  it("returns a single file's content", async () => {
    mocks.selectRows = [
      [{ id: "p1", organizationId: "org-1" }], // requireProjectAccess
      [{ path: "index.html", content: "<h1>hi</h1>" }], // file lookup
    ];
    const res = await handleWorkerApi(
      new Request("https://mf.test/api/projects/p1/files/index.html"),
      env,
    );
    expect(res?.status).toBe(200);
    await expect(res?.json()).resolves.toEqual({ path: "index.html", content: "<h1>hi</h1>" });
  });
});
