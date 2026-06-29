import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthContext: vi.fn(),
  containerBodies: [] as Array<Record<string, unknown>>,
  put: vi.fn(),
  inserts: [] as Array<Record<string, unknown>>,
}));

vi.mock("@cloudflare/containers", () => ({
  Container: class {},
  getContainer: () => ({
    fetch: async (req: Request) => {
      mocks.containerBodies.push((await req.json()) as Record<string, unknown>);
      return new Response("MP4BYTES", {
        status: 200,
        headers: { "content-type": "video/mp4" },
      });
    },
  }),
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
  createDb: () => ({
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        mocks.inserts.push(v);
        return Promise.resolve();
      },
    }),
  }),
}));

vi.mock("../auth", () => ({
  createAuth: () => ({ handler: vi.fn() }),
}));

vi.mock("../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth-context")>(
    "../lib/auth-context",
  );
  return {
    ...actual,
    requireAuthContext: mocks.requireAuthContext,
  };
});

import { handleWorkerApi, type WorkerEnv } from "./render-api";

const env = {
  ENABLE_AI_GEN: "true",
  RENDER_CONTAINER: {},
  RENDERS: { put: mocks.put },
} as unknown as WorkerEnv;

const memberContext = {
  user: { id: "user-1", name: "Member", email: "member@example.com", role: "user" },
  organization: { id: "org-1", name: "Acme" },
};

function renderRequest(body: Record<string, unknown>) {
  return new Request("https://motion-frames.test/api/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("render settings passthrough", () => {
  beforeEach(() => {
    mocks.requireAuthContext.mockReset();
    mocks.requireAuthContext.mockResolvedValue(memberContext);
    mocks.containerBodies = [];
    mocks.inserts = [];
    mocks.put.mockReset();
    mocks.put.mockResolvedValue(undefined);
  });

  it("forwards chosen render settings to the render pipeline", async () => {
    const response = await handleWorkerApi(
      renderRequest({ html: "<html></html>", width: 1280, height: 720, durationSec: 10, format: "webm" }),
      env,
    );

    expect(response?.status).toBe(200);
    expect(mocks.containerBodies).toHaveLength(1);
    expect(mocks.containerBodies[0]).toMatchObject({
      width: 1280,
      height: 720,
      durationSec: 10,
      format: "webm",
    });
    expect(mocks.containerBodies[0].files).toBeDefined();
  });

  it("preserves default behavior when render settings are omitted", async () => {
    const response = await handleWorkerApi(renderRequest({ html: "<html></html>" }), env);

    expect(response?.status).toBe(200);
    expect(mocks.containerBodies).toHaveLength(1);
    const body = mocks.containerBodies[0];
    expect(body.files).toBeDefined();
    expect(body).not.toHaveProperty("width");
    expect(body).not.toHaveProperty("height");
    expect(body).not.toHaveProperty("durationSec");
    expect(body).not.toHaveProperty("format");
  });

  it("rejects out-of-range render settings before rendering", async () => {
    const response = await handleWorkerApi(renderRequest({ html: "<html></html>", width: 99999 }), env);

    expect(response?.status).toBe(400);
    expect(mocks.containerBodies).toHaveLength(0);
  });

  it("rejects an unsupported render format", async () => {
    const response = await handleWorkerApi(renderRequest({ html: "<html></html>", format: "gif" }), env);

    expect(response?.status).toBe(400);
    expect(mocks.containerBodies).toHaveLength(0);
  });
});
