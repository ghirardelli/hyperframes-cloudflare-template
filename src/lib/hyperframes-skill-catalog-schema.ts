import { z } from "zod";

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

export const REQUIRED_HYPERFRAMES_SKILL_IDS = [
  "hyperframes",
  "hyperframes-core",
  "hyperframes-animation",
  "hyperframes-creative",
  "website-to-video",
  "product-launch-video",
] as const;

export const HYPERFRAMES_WORKFLOW_RUNNER_BOUNDARY =
  "TODO: add a container-backed HyperFrames workflow runner for capture, artifacts, voice/timing, multi-file builds, lint, validate, snapshots, and Studio delivery.";

export const hyperframesSkillGroupSchema = z.enum(["router", "workflow", "domain"]);

export const hyperframesCatalogSourceSchema = z.object({
  repoUrl: z.string().min(1).max(500),
  ref: z.string().min(1).max(160),
  commitSha: z.string().regex(/^[a-f0-9]{40}$/),
});

export const hyperframesSkillReferenceSchema = z.object({
  path: z.string().min(1).max(500),
  bytes: z.number().int().nonnegative(),
  contentHash: z.string().regex(HASH_PATTERN),
});

export const hyperframesSkillMetadataSchema = z.object({
  name: z.string().min(1).max(160),
});

export const hyperframesSkillSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  group: hyperframesSkillGroupSchema,
  description: z.string().max(4_000),
  path: z.string().min(1).max(500),
  metadata: hyperframesSkillMetadataSchema,
  markdown: z.string().min(1),
  contentHash: z.string().regex(HASH_PATTERN),
  referenceIndex: z.array(hyperframesSkillReferenceSchema),
});

export const hyperframesSkillCatalogSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().datetime(),
  source: hyperframesCatalogSourceSchema,
  requiredSkillIds: z.array(z.string().min(1)).min(REQUIRED_HYPERFRAMES_SKILL_IDS.length),
  skills: z.array(hyperframesSkillSchema).min(REQUIRED_HYPERFRAMES_SKILL_IDS.length),
});

export const hyperframesSkillSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  group: hyperframesSkillGroupSchema,
  description: z.string(),
  path: z.string(),
  contentHash: z.string().regex(HASH_PATTERN),
  referenceCount: z.number().int().nonnegative(),
});

export const hyperframesCatalogListOutputSchema = z.object({
  generatedAt: z.string().datetime(),
  source: hyperframesCatalogSourceSchema,
  totalSkills: z.number().int().nonnegative(),
  requiredSkillIds: z.array(z.string()),
  groups: z.object({
    router: z.array(hyperframesSkillSummarySchema),
    workflow: z.array(hyperframesSkillSummarySchema),
    domain: z.array(hyperframesSkillSummarySchema),
  }),
});

export const hyperframesWorkflowRouteRequestSchema = z.object({
  message: z.string().max(8_000).optional(),
  currentPrompt: z.string().max(8_000).optional(),
  activeProjectTitle: z.string().max(160).optional(),
});

export const hyperframesWorkflowRouteOutputSchema = z.object({
  shouldLoadSkills: z.boolean(),
  workflowId: z.string().nullable(),
  routerSkillId: z.string().nullable(),
  domainSkillIds: z.array(z.string()),
  loadSkillIds: z.array(z.string()),
  fullPipelineAvailable: z.boolean(),
  requiresWorkflowRunner: z.boolean(),
  capabilityNotice: z.string(),
  confidence: z.number().min(0).max(1),
  matchedSignals: z.array(z.string()),
  rationale: z.string(),
  sourceRevision: z.string(),
});

export const hyperframesLoadSkillInputSchema = z.object({
  skillId: z.string().min(1).max(120),
  maxChars: z.number().int().min(500).max(12_000).optional(),
});

export const hyperframesLoadedSkillOutputSchema = z.object({
  found: z.literal(true),
  skillId: z.string(),
  title: z.string(),
  group: hyperframesSkillGroupSchema,
  description: z.string(),
  path: z.string(),
  markdown: z.string().max(12_000),
  truncated: z.boolean(),
  originalChars: z.number().int().nonnegative(),
  returnedChars: z.number().int().nonnegative(),
  contentHash: z.string().regex(HASH_PATTERN),
  referenceIndex: z.array(hyperframesSkillReferenceSchema),
  sourceRevision: z.string(),
});

export const hyperframesSkillNotFoundOutputSchema = z.object({
  found: z.literal(false),
  skillId: z.string(),
  availableSkillIds: z.array(z.string()),
  sourceRevision: z.string(),
});

export const hyperframesLoadSkillOutputSchema = z.discriminatedUnion("found", [
  hyperframesLoadedSkillOutputSchema,
  hyperframesSkillNotFoundOutputSchema,
]);

export type HyperframesSkillCatalog = z.infer<typeof hyperframesSkillCatalogSchema>;
export type HyperframesSkill = z.infer<typeof hyperframesSkillSchema>;
export type HyperframesSkillSummary = z.infer<typeof hyperframesSkillSummarySchema>;
export type HyperframesWorkflowRouteRequest = z.infer<typeof hyperframesWorkflowRouteRequestSchema>;
export type HyperframesWorkflowRouteOutput = z.infer<typeof hyperframesWorkflowRouteOutputSchema>;
export type HyperframesLoadSkillInput = z.infer<typeof hyperframesLoadSkillInputSchema>;
export type HyperframesLoadSkillOutput = z.infer<typeof hyperframesLoadSkillOutputSchema>;
