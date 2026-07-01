import { z } from "zod";

import {
  normalizeSelectedGalleryPromptContext,
  selectedGalleryPromptContextSchema,
  type SelectedGalleryPromptContext,
} from "./hyperframe-gallery-catalog";

export const WORKFLOW_INTAKE_SOURCE = "main-page-chat";

export const workflowIntakePayloadSchema = z.object({
  source: z.literal(WORKFLOW_INTAKE_SOURCE).default(WORKFLOW_INTAKE_SOURCE),
  prompt: z.string().trim().min(1).max(8_000),
  sourceUrl: z.string().trim().max(2_000).optional(),
  durationSec: z.number().min(1).max(300).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  projectId: z.string().trim().min(1).max(200).optional(),
  selectedGalleryContext: selectedGalleryPromptContextSchema.optional(),
});

export const workflowRunOptionsSchema = z.object({
  durationSec: z.number().min(1).max(300).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  projectId: z.string().trim().min(1).max(200).optional(),
  intake: workflowIntakePayloadSchema.optional(),
}).passthrough();

export type WorkflowIntakePayload = z.infer<typeof workflowIntakePayloadSchema>;
export type WorkflowRunOptions = z.infer<typeof workflowRunOptionsSchema>;

export function normalizeWorkflowIntakePayload(
  value: unknown,
): WorkflowIntakePayload | null {
  const parsed = workflowIntakePayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function normalizeWorkflowRunOptions(value: unknown): WorkflowRunOptions {
  const parsed = workflowRunOptionsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

export function getWorkflowIntakePayload(
  options: Record<string, unknown> | null | undefined,
): WorkflowIntakePayload | null {
  return normalizeWorkflowIntakePayload(options?.intake);
}

export function buildWorkflowRunOptions(input: {
  prompt?: string;
  sourceUrl?: string;
  durationSec?: number;
  title?: string;
  projectId?: string;
  selectedGalleryContext?: SelectedGalleryPromptContext;
}): WorkflowRunOptions {
  const base: WorkflowRunOptions = {
    durationSec: input.durationSec,
    title: input.title,
    projectId: input.projectId,
  };
  const prompt = input.prompt?.trim();
  if (!prompt) return compactOptions(base);

  const intake = workflowIntakePayloadSchema.parse({
    source: WORKFLOW_INTAKE_SOURCE,
    prompt,
    sourceUrl: input.sourceUrl?.trim() || undefined,
    durationSec: input.durationSec,
    title: input.title,
    projectId: input.projectId,
    selectedGalleryContext: input.selectedGalleryContext
      ? normalizeSelectedGalleryPromptContext(input.selectedGalleryContext)
      : undefined,
  });
  return compactOptions({ ...base, intake });
}

export function extractFirstHttpUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"')\]]+/i);
  return match?.[0] ?? null;
}

function compactOptions(options: WorkflowRunOptions): WorkflowRunOptions {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  ) as WorkflowRunOptions;
}
