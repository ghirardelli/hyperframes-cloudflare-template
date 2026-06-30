import { z } from "zod";

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

export const gallerySourceTypeSchema = z.enum([
  "launch-video-repo",
  "catalog-index",
  "catalog-page",
]);

export const gallerySourceSchema = z.object({
  id: z.string().min(1).max(120),
  type: gallerySourceTypeSchema,
  url: z.string().url(),
  ref: z.string().min(1).max(160).optional(),
  revision: z.string().min(1).max(200),
  contentHash: z.string().regex(HASH_PATTERN),
});

export const galleryPreviewMediaSchema = z.object({
  type: z.enum(["video", "image", "gif"]),
  src: z.string().url(),
  poster: z.string().url().optional(),
  alt: z.string().min(1).max(220),
});

const boundedTagSchema = z.string().min(1).max(80);

export const galleryExampleSchema = z.object({
  id: z.string().min(1).max(160),
  title: z.string().min(1).max(180),
  description: z.string().min(1).max(600),
  sourceKind: z.enum(["root-video", "section"]),
  durationSec: z.number().positive().max(3_600),
  width: z.number().int().positive().max(8_000),
  height: z.number().int().positive().max(8_000),
  fps: z.number().positive().max(240).optional(),
  tags: z.array(boundedTagSchema).max(16),
  sourceUrl: z.string().url(),
  sourceRevision: z.string().min(1).max(200),
  previewMedia: galleryPreviewMediaSchema,
  promptText: z.string().min(1).max(1_200),
});

export const galleryComponentKindSchema = z.enum(["block", "component"]);

export const galleryComponentSchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().min(1).max(180),
  kind: galleryComponentKindSchema,
  category: z.string().min(1).max(120),
  description: z.string().min(1).max(800),
  detail: z.string().min(1).max(1_500),
  tags: z.array(boundedTagSchema).max(20),
  sourceUrl: z.string().url(),
  installCommand: z.string().min(1).max(220).optional(),
  usageSnippet: z.string().min(1).max(2_000).optional(),
  durationSec: z.number().positive().max(3_600).optional(),
  width: z.number().int().positive().max(8_000).optional(),
  height: z.number().int().positive().max(8_000).optional(),
  previewMedia: galleryPreviewMediaSchema,
  promptText: z.string().min(1).max(1_500),
});

export const hyperframeGalleryCatalogSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().datetime(),
  sources: z.array(gallerySourceSchema).min(2),
  examples: z.array(galleryExampleSchema).min(1),
  components: z.array(galleryComponentSchema).min(1),
});

export const selectedGalleryPromptItemSchema = z.object({
  id: z.string().min(1).max(160),
  kind: z.enum(["example", "component"]),
  name: z.string().min(1).max(180),
  sourceUrl: z.string().url(),
  promptText: z.string().min(1).max(1_500),
});

export const selectedGalleryPromptContextSchema = z.object({
  examples: z.array(selectedGalleryPromptItemSchema).max(8),
  components: z.array(selectedGalleryPromptItemSchema).max(12),
});

export type GallerySource = z.infer<typeof gallerySourceSchema>;
export type GalleryPreviewMedia = z.infer<typeof galleryPreviewMediaSchema>;
export type GalleryExample = z.infer<typeof galleryExampleSchema>;
export type GalleryComponentKind = z.infer<typeof galleryComponentKindSchema>;
export type GalleryComponent = z.infer<typeof galleryComponentSchema>;
export type HyperframeGalleryCatalog = z.infer<typeof hyperframeGalleryCatalogSchema>;
export type SelectedGalleryPromptItem = z.infer<typeof selectedGalleryPromptItemSchema>;
export type SelectedGalleryPromptContext = z.infer<
  typeof selectedGalleryPromptContextSchema
>;
