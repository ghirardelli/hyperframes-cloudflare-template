import { generateTranscription } from "@tanstack/ai";

import {
  promptAgentTranscriptionRequestSchema,
  promptAgentTranscriptionResultSchema,
} from "../lib/prompt-agent-contract";
import {
  PromptAgentTranscriptionConfigError,
  createPromptAgentTranscriptionProvider,
} from "../lib/prompt-agent-transcription-provider";
import type { AppAuthContext } from "../lib/auth-context";
import type { WorkerEnv } from "./render-api";

const MAX_TRANSCRIPTION_BODY_BYTES = 10 * 1024 * 1024;

export interface PromptAgentTranscriptionOptions {
  env: WorkerEnv;
  req: Request;
  auth: AppAuthContext;
}

export async function handlePromptAgentTranscription({
  env,
  req,
}: PromptAgentTranscriptionOptions): Promise<Response> {
  if (env.ENABLE_AI_GEN !== "true") {
    return jsonError(
      'AI generation is disabled on this deployment. Set ENABLE_AI_GEN="true" in wrangler.jsonc vars to enable generation.',
      403,
    );
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_TRANSCRIPTION_BODY_BYTES) {
    return jsonError("recording is too large", 413);
  }

  const body = await req.json().catch(() => null);
  const parsed = promptAgentTranscriptionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "invalid transcription request", 400);
  }

  let provider;
  try {
    provider = createPromptAgentTranscriptionProvider(env);
  } catch (err) {
    if (err instanceof PromptAgentTranscriptionConfigError) {
      return jsonError(err.message, err.status);
    }
    return jsonError(messageFromError(err), 500);
  }

  try {
    const result = await generateTranscription({
      adapter: provider.adapter,
      audio: parsed.data.audio,
      language: parsed.data.language,
      prompt: parsed.data.prompt,
      responseFormat: "json",
    });
    const output = promptAgentTranscriptionResultSchema.parse({
      text: result.text,
      language: result.language,
      durationSec: result.duration,
    });
    return Response.json(output, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return jsonError(messageFromError(err), 502);
  }
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function messageFromError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
