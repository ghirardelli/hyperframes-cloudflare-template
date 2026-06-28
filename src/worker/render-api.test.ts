import { describe, expect, it, vi } from "vitest";

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

import { handleWorkerApi, type WorkerEnv } from "./render-api";

describe("handleWorkerApi", () => {
  it("returns deployment config for the React client", async () => {
    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/api/config"),
      { ENABLE_AI_GEN: "true" } as WorkerEnv,
    );

    expect(response).toBeInstanceOf(Response);
    expect(response?.headers.get("cache-control")).toBe("public, max-age=300");
    await expect(response?.json()).resolves.toEqual({
      aiGenEnabled: true,
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
});
