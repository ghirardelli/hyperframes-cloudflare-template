import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  requireAuthContext: vi.fn(),
  chatParamsFromRequest: vi.fn(),
  chat: vi.fn(),
  mergeAgentTools: vi.fn((serverTools: Array<unknown>, clientTools: Array<unknown>) => [
    ...serverTools,
    ...clientTools,
  ]),
  toServerSentEventsResponse: vi.fn(
    () => new Response("stream", { headers: { "content-type": "text/event-stream" } }),
  ),
  createOpenRouterText: vi.fn((model: string, apiKey: string, config: Record<string, unknown>) => ({
    kind: "text",
    name: "openrouter",
    model,
    apiKey,
    config,
  })),
}));

vi.mock("@cloudflare/containers", () => ({
  Container: class {},
  getContainer: () => {
    throw new Error("container rendering is not used in this unit test");
  },
}));

vi.mock("@tanstack/ai", () => ({
  chatParamsFromRequest: apiMocks.chatParamsFromRequest,
  chat: apiMocks.chat,
  mergeAgentTools: apiMocks.mergeAgentTools,
  toServerSentEventsResponse: apiMocks.toServerSentEventsResponse,
}));

vi.mock("@tanstack/ai-openrouter", () => ({
  createOpenRouterText: apiMocks.createOpenRouterText,
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
    requireAuthContext: apiMocks.requireAuthContext,
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

function agentRequest() {
  return new Request("https://motion-frames.test/api/agent/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [] }),
  });
}

function mockAgentParams() {
  apiMocks.chatParamsFromRequest.mockResolvedValue({
    messages: [{ role: "user", content: "make it kinetic" }],
    threadId: "thread-1",
    runId: "run-1",
    tools: [],
    forwardedProps: {
      currentPrompt: "A launch reel",
      durationSec: 8,
      activeProjectTitle: "Launch Reel",
    },
    state: null,
    context: [],
    aguiContext: [],
  });
}

describe("prompt agent worker route", () => {
  beforeEach(() => {
    apiMocks.requireAuthContext.mockReset();
    apiMocks.chatParamsFromRequest.mockReset();
    apiMocks.chat.mockReset();
    apiMocks.mergeAgentTools.mockClear();
    apiMocks.toServerSentEventsResponse.mockClear();
    apiMocks.createOpenRouterText.mockClear();
    apiMocks.chat.mockReturnValue((async function* stream() {})());
  });

  it("rejects unauthenticated prompt-agent requests before parsing AG-UI input", async () => {
    apiMocks.requireAuthContext.mockRejectedValue(new AuthRequiredError());

    const response = await handleWorkerApi(
      agentRequest(),
      { ENABLE_AI_GEN: "true", OPENROUTER_API_KEY: "test-key" } as WorkerEnv,
    );

    expect(response?.status).toBe(401);
    expect(apiMocks.chatParamsFromRequest).not.toHaveBeenCalled();
    await expect(response?.json()).resolves.toEqual({ error: "authentication required" });
  });

  it("rejects bootstrap admins without a tenant organization", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(bootstrapContext);

    const response = await handleWorkerApi(
      agentRequest(),
      { ENABLE_AI_GEN: "true", OPENROUTER_API_KEY: "test-key" } as WorkerEnv,
    );

    expect(response?.status).toBe(403);
    expect(apiMocks.chatParamsFromRequest).not.toHaveBeenCalled();
  });

  it("rejects prompt-agent requests when AI generation is disabled", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);

    const response = await handleWorkerApi(
      agentRequest(),
      { ENABLE_AI_GEN: "false", OPENROUTER_API_KEY: "test-key" } as WorkerEnv,
    );

    expect(response?.status).toBe(403);
    expect(apiMocks.chatParamsFromRequest).not.toHaveBeenCalled();
  });

  it("returns a clear configuration error when OpenRouter is missing", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    mockAgentParams();

    const response = await handleWorkerApi(
      agentRequest(),
      { ENABLE_AI_GEN: "true" } as WorkerEnv,
    );

    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toEqual({
      error: "OpenRouter API key is not configured. Set OPENROUTER_API_KEY as a Cloudflare secret.",
    });
    expect(apiMocks.chat).not.toHaveBeenCalled();
  });

  it("sets up a TanStack AI SSE stream with OpenRouter and forwarded props", async () => {
    apiMocks.requireAuthContext.mockResolvedValue(memberContext);
    mockAgentParams();

    const response = await handleWorkerApi(
      agentRequest(),
      {
        ENABLE_AI_GEN: "true",
        OPENROUTER_API_KEY: "test-key",
        OPENROUTER_MODEL: "openrouter/auto",
      } as WorkerEnv,
    );

    expect(response?.headers.get("content-type")).toContain("text/event-stream");
    expect(apiMocks.createOpenRouterText).toHaveBeenCalledWith(
      "openrouter/auto",
      "test-key",
      expect.objectContaining({
        appTitle: "Motion Frames",
        httpReferer: "https://motion-frames.test",
      }),
    );
    expect(apiMocks.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        runId: "run-1",
        stream: true,
        outputSchema: expect.any(Object),
        context: expect.objectContaining({
          auth: memberContext,
          forwardedPrompt: "A launch reel",
          forwardedDurationSec: 8,
          forwardedActiveProjectTitle: "Launch Reel",
        }),
      }),
    );
    const chatConfig = apiMocks.chat.mock.calls[0][0];
    expect(chatConfig.systemPrompts[0]).toContain("route_hyperframes_workflow");
    expect(chatConfig.systemPrompts[0]).toContain("fullPipelineAvailable=false");
    expect(chatConfig.systemPrompts[0]).toContain("do not claim website capture");
    expect(chatConfig.tools.map((tool: { name: string }) => tool.name)).toEqual(
      expect.arrayContaining([
        "list_hyperframes_skill_catalog",
        "route_hyperframes_workflow",
        "load_hyperframes_skill",
        "start_hyperframes_workflow",
        "get_hyperframes_workflow_run",
        "generate_hyperframe",
      ]),
    );
    expect(apiMocks.toServerSentEventsResponse).toHaveBeenCalled();
  });
});
