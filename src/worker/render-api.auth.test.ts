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

import { AuthRequiredError, ForbiddenError } from "../lib/auth-context";
import { handleWorkerApi, type WorkerEnv } from "./render-api";

const env = {
  ENABLE_AI_GEN: "true",
  OPENROUTER_API_KEY: "test-key",
} as WorkerEnv;

describe("protected worker APIs", () => {
  beforeEach(() => {
    mocks.requireAuthContext.mockReset();
  });

  it("rejects unauthenticated generate requests before using OpenRouter", async () => {
    mocks.requireAuthContext.mockRejectedValue(new AuthRequiredError());

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "launch reel" }),
      }),
      env,
    );

    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toEqual({ error: "authentication required" });
  });

  it("rejects unauthenticated preview requests", async () => {
    mocks.requireAuthContext.mockRejectedValue(new AuthRequiredError());

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/preview"),
      env,
    );

    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toEqual({ error: "authentication required" });
  });

  it("rejects unauthenticated project preview requests", async () => {
    mocks.requireAuthContext.mockRejectedValue(new AuthRequiredError());

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/projects/project-1/preview"),
      env,
    );

    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toEqual({ error: "authentication required" });
  });

  it("rejects locked users on protected APIs", async () => {
    mocks.requireAuthContext.mockRejectedValue(new ForbiddenError("account locked"));

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/render", {
        method: "POST",
      }),
      env,
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: "account locked" });
  });

  it("blocks bootstrap admins from tenant writes until they have a real organization", async () => {
    mocks.requireAuthContext.mockResolvedValue({
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.com",
        role: "admin",
      },
      organization: {
        id: "__bootstrap__",
        name: "Bootstrap admin",
        isBootstrap: true,
      },
    });

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "launch reel" }),
      }),
      env,
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: "Create a real organization and assign your admin user before using tenant workspace data.",
    });
  });

  it("rejects non-admin users before serving admin APIs", async () => {
    mocks.requireAuthContext.mockResolvedValue({
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
    });

    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/admin/users"),
      env,
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: "admin required" });
  });
});
