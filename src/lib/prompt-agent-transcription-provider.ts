import { createOpenaiTranscription, type OpenAITranscriptionModel } from "@tanstack/ai-openai";

import type { WorkerEnv } from "../worker/render-api";

export const DEFAULT_TRANSCRIPTION_MODEL = "whisper-1";

export class PromptAgentTranscriptionConfigError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
    this.name = "PromptAgentTranscriptionConfigError";
  }
}

export function isPromptAgentTranscriptionConfigured(
  env: Pick<WorkerEnv, "ENABLE_AI_GEN" | "OPENAI_API_KEY">,
): boolean {
  return env.ENABLE_AI_GEN === "true" && Boolean(env.OPENAI_API_KEY?.trim());
}

export function promptAgentTranscriptionModel(
  env: Pick<WorkerEnv, "OPENAI_TRANSCRIPTION_MODEL">,
): string {
  return env.OPENAI_TRANSCRIPTION_MODEL?.trim() || DEFAULT_TRANSCRIPTION_MODEL;
}

export function createPromptAgentTranscriptionProvider(
  env: Pick<WorkerEnv, "OPENAI_API_KEY" | "OPENAI_TRANSCRIPTION_MODEL">,
) {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new PromptAgentTranscriptionConfigError(
      "OpenAI API key is not configured. Set OPENAI_API_KEY as a Cloudflare secret for transcription.",
    );
  }

  const model = promptAgentTranscriptionModel(env) as OpenAITranscriptionModel;
  return {
    adapter: createOpenaiTranscription(model, apiKey),
    model,
  };
}
