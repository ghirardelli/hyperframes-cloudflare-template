import { z } from "zod";

export const TRUSTED_COMPONENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

export const trustedComponentSourceMetadataSchema = z.object({
  url: z.string().url(),
  packageName: z.string().min(1).max(120),
  packageVersion: z.string().min(1).max(80),
  revision: z.string().min(1).max(200),
});

export const trustedComponentFileMetadataSchema = z.object({
  path: z.string().min(1).max(260),
  contentHash: z.string().regex(TRUSTED_COMPONENT_HASH_PATTERN),
});

export const trustedComponentFileSchema = trustedComponentFileMetadataSchema.extend({
  content: z.string().min(1),
});

export const materializableHyperframeComponentMetadataSchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().min(1).max(180),
  kind: z.enum(["block", "component"]),
  installCommand: z.string().min(1).max(220),
  source: trustedComponentSourceMetadataSchema,
  canonicalSnippet: z.string().min(1).max(2_000),
  durationSec: z.number().positive().max(3_600),
  width: z.number().int().positive().max(8_000),
  height: z.number().int().positive().max(8_000),
  files: z.array(trustedComponentFileMetadataSchema).min(1),
});

export const trustedMaterializableHyperframeComponentSchema =
  materializableHyperframeComponentMetadataSchema.extend({
    files: z.array(trustedComponentFileSchema).min(1),
  });

const trustedRegistryBaseSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().datetime(),
  generator: z.object({
    script: z.string().min(1).max(200),
    packageName: z.string().min(1).max(120),
    packageVersion: z.string().min(1).max(80),
  }),
});

export const trustedHyperframeComponentRegistryMetadataSchema =
  trustedRegistryBaseSchema.extend({
    components: z.array(materializableHyperframeComponentMetadataSchema),
  });

export const trustedHyperframeComponentRegistrySchema =
  trustedRegistryBaseSchema.extend({
    components: z.array(trustedMaterializableHyperframeComponentSchema),
  });

export const promptOnlyComponentMaterializationStateSchema = z.object({
  state: z.literal("prompt-only"),
});

export const materializableComponentSelectionStateSchema = z.object({
  state: z.literal("materializable"),
  componentId: z.string().min(1).max(160),
  source: trustedComponentSourceMetadataSchema,
  installCommand: z.string().min(1).max(220),
  canonicalSnippet: z.string().min(1).max(2_000),
  durationSec: z.number().positive().max(3_600),
  width: z.number().int().positive().max(8_000),
  height: z.number().int().positive().max(8_000),
  files: z.array(trustedComponentFileMetadataSchema).min(1),
  placementIntent: z.string().max(500).optional(),
});

export const componentMaterializationStateSchema = z.discriminatedUnion("state", [
  promptOnlyComponentMaterializationStateSchema,
  materializableComponentSelectionStateSchema,
]);

export type TrustedComponentSourceMetadata = z.infer<
  typeof trustedComponentSourceMetadataSchema
>;
export type TrustedComponentFileMetadata = z.infer<
  typeof trustedComponentFileMetadataSchema
>;
export type TrustedComponentFile = z.infer<typeof trustedComponentFileSchema>;
export type MaterializableHyperframeComponentMetadata = z.infer<
  typeof materializableHyperframeComponentMetadataSchema
>;
export type TrustedMaterializableHyperframeComponent = z.infer<
  typeof trustedMaterializableHyperframeComponentSchema
>;
export type TrustedHyperframeComponentRegistryMetadata = z.infer<
  typeof trustedHyperframeComponentRegistryMetadataSchema
>;
export type TrustedHyperframeComponentRegistry = z.infer<
  typeof trustedHyperframeComponentRegistrySchema
>;
export type ComponentMaterializationState = z.infer<
  typeof componentMaterializationStateSchema
>;
