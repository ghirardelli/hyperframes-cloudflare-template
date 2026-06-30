import { z } from "zod";

import type {
  TrustedComponentFileMetadata,
  TrustedComponentSourceMetadata,
} from "./hyperframe-component-registry-schema";

export const MATERIALIZED_COMPONENT_MANIFEST_PATH =
  ".hyperframes/materialized-components.json";

export const materializeComponentPlacementSchema = z.object({
  componentId: z.string().trim().min(1).max(160),
  startSec: z.number().min(0).max(3_600),
  durationSec: z.number().positive().max(3_600).optional(),
  trackIndex: z.number().int().min(0).max(100).optional(),
  width: z.number().int().positive().max(8_000).optional(),
  height: z.number().int().positive().max(8_000).optional(),
  placementNote: z.string().trim().max(500).optional(),
}).strict();

export const materializeTrustedHyperframeComponentsInputSchema = z.object({
  indexHtml: z.string(),
  placements: z.array(materializeComponentPlacementSchema).min(1).max(24),
  actor: z.object({
    id: z.string().min(1).max(200),
    type: z.enum(["user", "agent", "system"]),
  }),
  materializedAt: z.string().datetime().optional(),
  snapshotId: z.string().min(1).max(200).nullable().optional(),
}).strict();

export const materializedComponentPlacementSchema = materializeComponentPlacementSchema.extend({
  durationSec: z.number().positive().max(3_600),
  trackIndex: z.number().int().min(0).max(100),
  width: z.number().int().positive().max(8_000),
  height: z.number().int().positive().max(8_000),
  hostSnippet: z.string(),
});

export const materializedComponentManifestSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().datetime(),
  actor: z.object({
    id: z.string(),
    type: z.enum(["user", "agent", "system"]),
  }),
  snapshotId: z.string().nullable(),
  components: z.array(z.object({
    componentId: z.string(),
    name: z.string(),
    installCommand: z.string(),
    source: z.custom<TrustedComponentSourceMetadata>(),
    canonicalSnippet: z.string(),
    installedPaths: z.array(z.string()),
    files: z.array(z.custom<TrustedComponentFileMetadata>()),
    placements: z.array(materializedComponentPlacementSchema),
    materializedAt: z.string().datetime(),
  })),
});

export const materializeHyperframeComponentsToolInputSchema = z.object({
  projectId: z.string().trim().min(1).max(200).optional(),
  placements: z.array(materializeComponentPlacementSchema).min(1).max(24),
}).strict();

export const materializeHyperframeComponentsToolOutputSchema = z.object({
  projectId: z.string(),
  indexHtml: z.string(),
  installedPaths: z.array(z.string()),
  manifestPath: z.literal(MATERIALIZED_COMPONENT_MANIFEST_PATH),
  manifest: materializedComponentManifestSchema,
  warnings: z.array(z.string()),
});

export type MaterializeComponentPlacement = z.infer<
  typeof materializeComponentPlacementSchema
>;
export type MaterializeTrustedHyperframeComponentsInput = z.infer<
  typeof materializeTrustedHyperframeComponentsInputSchema
>;
export type MaterializedComponentPlacement = z.infer<
  typeof materializedComponentPlacementSchema
>;
export type MaterializedComponentManifest = z.infer<
  typeof materializedComponentManifestSchema
>;
export type MaterializeHyperframeComponentsToolInput = z.infer<
  typeof materializeHyperframeComponentsToolInputSchema
>;
export type MaterializeHyperframeComponentsToolOutput = z.infer<
  typeof materializeHyperframeComponentsToolOutputSchema
>;
