import { beforeEach, describe, expect, it, vi } from "vitest";

const transcriptionMocks = vi.hoisted(() => ({
  requireAuthContext: vi.fn(),
  generateTranscription: vi.fn(),
  createOpenaiTranscription: vi.fn((model: string, apiKey: string) => ({
    kind: "transcription",
    name: "openai",
    model,
    apiKey,
  })),
}));

vi.mock("@cloudflare/containers", () => ({
  Container: class {},
  getContainer: () => {
    throw new Error("container rendering is not used in this unit test");
  },
}));

vi.mock("@tanstack/ai", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/ai")>("@tanstack/ai");
  return {
    ...actual,
    generateTranscription: transcriptionMocks.generateTranscription,
  };
});

vi.mock("@tanstack/ai-openai", () => ({
  createOpenaiTranscription: transcriptionMocks.createOpenaiTranscription,
}));

vi.mock("../lib/generate", () => ({
  DEFAULT_MODEL: "google/gemini-3-flash-preview",
  GenerateError: class GenerateError extends Error {
    constructor(message: string, public status = 500) {
      super(message);
    }
  },
  generateComposition: () => {
    throw new Error("generation is not used in this unit test");
  },
}));

vi.mock("../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth-context")>(
    "../lib/auth-context",
  );
  return {
    ...actual,
    requireAuthContext: transcriptionMocks.requireAuthContext,
  };
});

import { AuthRequiredError } from "../lib/auth-context";
import { handleWorkerApi, type WorkerEnv } from "./render-api";

const memberContext = {
  user: { id: "user-1", name: "Member", email: "member@example.com", role: "user" },
  organization: { id: "org-1", name: "Acme" },
};

const bootstrapContext = {
  user: { id: "admin-1", name: "Admin", email: "admin@example.com", role: "admin" },
  organization: { id: "__bootstrap__", name: "Bootstrap admin", isBootstrap: true },
};

function transcriptionRequest(body: Record<string, unknown> = {}) {
  return new Request("https://motion-frames.test/api/agent/transcribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      audio: "data:audio/webm;base64,AAAA",
      mimeType: "audio/webm",
      durationMs: 1200,
      ...body,
    }),
  });
}

describe("prompt agent transcription route", () => {
  beforeEach(() => {
    transcriptionMocks.requireAuthContext.mockReset();
    transcriptionMocks.generateTranscription.mockReset();
    transcriptionMocks.createOpenaiTranscription.mockClear();
  });

  it("rejects unauthenticated transcription before parsing provider input", async () => {
    transcriptionMocks.requireAuthContext.mockRejectedValue(new AuthRequiredError());

    const response = await handleWorkerApi(
      transcriptionRequest(),
      { ENABLE_AI_GEN: "true", OPENAI_API_KEY: "test-key" } as WorkerEnv,
    );

    expect(response?.status).toBe(401);
    expect(transcriptionMocks.generateTranscription).not.toHaveBeenCalled();
  });

  it("rejects bootstrap admins without a tenant organization", async () => {
    transcriptionMocks.requireAuthContext.mockResolvedValue(bootstrapContext);

    const response = await handleWorkerApi(
      transcriptionRequest(),
      { ENABLE_AI_GEN: "true", OPENAI_API_KEY: "test-key" } as WorkerEnv,
    );

    expect(response?.status).toBe(403);
    expect(transcriptionMocks.generateTranscription).not.toHaveBeenCalled();
  });

  it("rejects transcription when AI generation is disabled", async () => {
    transcriptionMocks.requireAuthContext.mockResolvedValue(memberContext);

    const response = await handleWorkerApi(
      transcriptionRequest(),
      { ENABLE_AI_GEN: "false", OPENAI_API_KEY: "test-key" } as WorkerEnv,
    );

    expect(response?.status).toBe(403);
    expect(transcriptionMocks.generateTranscription).not.toHaveBeenCalled();
  });

  it("returns a clear configuration error when OpenAI transcription is missing", async () => {
    transcriptionMocks.requireAuthContext.mockResolvedValue(memberContext);

    const response = await handleWorkerApi(
      transcriptionRequest(),
      { ENABLE_AI_GEN: "true" } as WorkerEnv,
    );

    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toEqual({
      error: "OpenAI API key is not configured. Set OPENAI_API_KEY as a Cloudflare secret for transcription.",
    });
    expect(transcriptionMocks.generateTranscription).not.toHaveBeenCalled();
  });

  it("rejects recordings over the configured duration limit", async () => {
    transcriptionMocks.requireAuthContext.mockResolvedValue(memberContext);

    const response = await handleWorkerApi(
      transcriptionRequest({ durationMs: 5 * 60 * 1000 + 1 }),
      { ENABLE_AI_GEN: "true", OPENAI_API_KEY: "test-key" } as WorkerEnv,
    );

    expect(response?.status).toBe(400);
    expect(transcriptionMocks.generateTranscription).not.toHaveBeenCalled();
  });

  it("transcribes browser audio data urls with the configured OpenAI model", async () => {
    transcriptionMocks.requireAuthContext.mockResolvedValue(memberContext);
    transcriptionMocks.generateTranscription.mockResolvedValue({
      text: "Make the launch video feel warmer",
      language: "en",
      duration: 1.2,
    });

    const response = await handleWorkerApi(
      transcriptionRequest({ language: "en", prompt: "Motion design vocabulary" }),
      {
        ENABLE_AI_GEN: "true",
        OPENAI_API_KEY: "test-key",
        OPENAI_TRANSCRIPTION_MODEL: "gpt-4o-mini-transcribe",
      } as WorkerEnv,
    );

    await expect(response?.json()).resolves.toEqual({
      text: "Make the launch video feel warmer",
      language: "en",
      durationSec: 1.2,
    });
    expect(transcriptionMocks.createOpenaiTranscription).toHaveBeenCalledWith(
      "gpt-4o-mini-transcribe",
      "test-key",
    );
    expect(transcriptionMocks.generateTranscription).toHaveBeenCalledWith({
      adapter: expect.objectContaining({ model: "gpt-4o-mini-transcribe" }),
      audio: "data:audio/webm;base64,AAAA",
      language: "en",
      prompt: "Motion design vocabulary",
      responseFormat: "json",
    });
  });
});
