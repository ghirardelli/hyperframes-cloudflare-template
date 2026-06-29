import { createOpenRouterText } from "@tanstack/ai-openrouter";

import { DEFAULT_MODEL } from "./generate";
import type { WorkerEnv } from "../worker/render-api";

export interface PromptAgentProvider {
  adapter: ReturnType<typeof createOpenRouterText>;
  model: string;
}

export class PromptAgentConfigError extends Error {
  constructor(message: string, public status: number = 500) {
    super(message);
    this.name = "PromptAgentConfigError";
  }
}

export function createPromptAgentProvider(
  env: Pick<WorkerEnv, "OPENROUTER_API_KEY" | "OPENROUTER_MODEL">,
  req: Request,
): PromptAgentProvider {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new PromptAgentConfigError(
      "OpenRouter API key is not configured. Set OPENROUTER_API_KEY as a Cloudflare secret.",
      500,
    );
  }

  const model = env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  const referer = req.headers.get("origin") ?? new URL(req.url).origin;

  return {
    adapter: createOpenRouterText(model as never, apiKey, {
      httpReferer: referer,
      appTitle: "Motion Frames",
    }),
    model,
  };
}
