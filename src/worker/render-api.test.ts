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

  it("lets TanStack Start handle non-worker routes", async () => {
    const response = await handleWorkerApi(
      new Request("https://motion-frames.test/"),
      { ENABLE_AI_GEN: "true" } as WorkerEnv,
    );

    expect(response).toBeNull();
  });
});
