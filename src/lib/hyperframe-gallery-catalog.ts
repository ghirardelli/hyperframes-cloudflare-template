import { hyperframeGalleryCatalog } from "../generated/hyperframe-gallery-catalog";
import { getComponentMaterializationState } from "./hyperframe-component-registry";
import {
  hyperframeGalleryCatalogSchema,
  selectedGalleryPromptContextSchema,
  type GalleryComponent,
  type GalleryExample,
  type HyperframeGalleryCatalog,
  type SelectedGalleryPromptContext,
  type SelectedGalleryPromptItem,
} from "./hyperframe-gallery-catalog-schema";

export {
  galleryComponentKindSchema,
  galleryComponentSchema,
  galleryExampleSchema,
  galleryPreviewMediaSchema,
  gallerySourceSchema,
  gallerySourceTypeSchema,
  hyperframeGalleryCatalogSchema,
  selectedGalleryPromptContextSchema,
  selectedGalleryPromptItemSchema,
  type GalleryComponent,
  type GalleryComponentKind,
  type GalleryExample,
  type GalleryPreviewMedia,
  type GallerySource,
  type HyperframeGalleryCatalog,
  type SelectedGalleryPromptContext,
  type SelectedGalleryPromptItem,
} from "./hyperframe-gallery-catalog-schema";

const CREDENTIAL_PATTERNS = [
  /github_pat_[A-Za-z0-9_]+/,
  /gh[pousr]_[A-Za-z0-9_]+/,
  /x-access-token/i,
  /BEGIN (?:OPENSSH|RSA|EC|DSA) PRIVATE KEY/,
  /\.ssh\//,
  /credential\.helper/i,
  /https:\/\/[^/\s]+@github\.com/i,
  /\/Users\/[^"'\s]+/,
];

export const GALLERY_EXAMPLE_SELECTION_LIMIT = 8;
export const GALLERY_COMPONENT_SELECTION_LIMIT = 12;

let cachedCatalog: HyperframeGalleryCatalog | null = null;

export function getHyperframeGalleryCatalog(): HyperframeGalleryCatalog {
  if (!cachedCatalog) {
    cachedCatalog = validateHyperframeGalleryCatalog(hyperframeGalleryCatalog);
  }
  return cachedCatalog;
}

export function validateHyperframeGalleryCatalog(
  value: unknown,
): HyperframeGalleryCatalog {
  const parsed = hyperframeGalleryCatalogSchema.parse(value);
  assertNoGalleryCredentialLeaks(parsed);
  return parsed;
}

export function assertNoGalleryCredentialLeaks(value: unknown): void {
  const text = JSON.stringify(value);
  for (const pattern of CREDENTIAL_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(`HyperFrame gallery catalog contains credential-like material: ${pattern}`);
    }
  }
}

export function listGalleryExamples(
  catalog = getHyperframeGalleryCatalog(),
): Array<GalleryExample> {
  return catalog.examples;
}

export function listGalleryComponents(
  catalog = getHyperframeGalleryCatalog(),
): Array<GalleryComponent> {
  return catalog.components;
}

export function listGalleryComponentCategories(
  catalog = getHyperframeGalleryCatalog(),
): Array<{ category: string; count: number }> {
  const counts = new Map<string, number>();
  for (const component of catalog.components) {
    counts.set(component.category, (counts.get(component.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function filterGalleryComponents(
  components: ReadonlyArray<GalleryComponent>,
  category: string,
): Array<GalleryComponent> {
  if (!category || category === "All") return [...components];
  return components.filter((component) => component.category === category);
}

export function toggleGallerySelectionId(
  currentIds: ReadonlyArray<string>,
  id: string,
  limit: number,
): Array<string> {
  if (currentIds.includes(id)) {
    return currentIds.filter((currentId) => currentId !== id);
  }
  return [...currentIds, id].slice(-Math.max(1, limit));
}

export function removeGallerySelectionId(
  currentIds: ReadonlyArray<string>,
  id: string,
): Array<string> {
  return currentIds.filter((currentId) => currentId !== id);
}

export function createSelectedExampleItem(
  example: GalleryExample,
): SelectedGalleryPromptItem {
  return {
    id: example.id,
    kind: "example",
    name: example.title,
    sourceUrl: example.sourceUrl,
    promptText: example.promptText,
    materialization: { state: "prompt-only" },
  };
}

export function createSelectedComponentItem(
  component: GalleryComponent,
): SelectedGalleryPromptItem {
  return {
    id: component.id,
    kind: "component",
    name: component.name,
    sourceUrl: component.sourceUrl,
    promptText: component.promptText,
    materialization: getComponentMaterializationState(component),
  };
}

export function normalizeSelectedGalleryPromptContext(
  value: unknown,
): SelectedGalleryPromptContext {
  const parsed = selectedGalleryPromptContextSchema.safeParse(value);
  return parsed.success ? parsed.data : { examples: [], components: [] };
}

export function countSelectedGalleryItems(
  context: SelectedGalleryPromptContext,
): number {
  const normalized = normalizeSelectedGalleryPromptContext(context);
  return normalized.examples.length + normalized.components.length;
}

export function summarizeSelectedGalleryContext(
  context: SelectedGalleryPromptContext,
): string {
  const normalized = normalizeSelectedGalleryPromptContext(context);
  const total = countSelectedGalleryItems(normalized);
  if (!total) return "No gallery context selected";
  const parts = [];
  if (normalized.examples.length) {
    parts.push(`${normalized.examples.length} example${normalized.examples.length === 1 ? "" : "s"}`);
  }
  if (normalized.components.length) {
    parts.push(
      `${normalized.components.length} component${normalized.components.length === 1 ? "" : "s"}`,
    );
  }
  return parts.join(" + ");
}

export function buildGalleryPromptText(
  context: SelectedGalleryPromptContext,
): string {
  const normalized = normalizeSelectedGalleryPromptContext(context);
  const items = [...normalized.examples, ...normalized.components];
  if (!items.length) return "";

  const lines = items.map((item) => {
    if (item.kind === "component" && item.materialization.state === "materializable") {
      return [
        `- Trusted HyperFrames component: ${item.materialization.componentId} (${item.name})`,
        `  Source: ${item.sourceUrl}`,
        `  Canonical host snippet: ${item.materialization.canonicalSnippet}`,
        "  Do not recreate or author this component's internal HTML. Use the registry-authored block and reference it by component id/snippet only.",
        `  Prompt context: ${compactText(item.promptText, 360)}`,
      ].join("\n");
    }
    return `- ${item.name} (${item.sourceUrl}): ${compactText(item.promptText, 420)}`;
  });
  return `Use this selected HyperFrames gallery context:\n${lines.join("\n")}`;
}

export function appendGalleryPromptText(
  prompt: string,
  context: SelectedGalleryPromptContext,
): string {
  const addition = buildGalleryPromptText(context);
  if (!addition) return prompt;
  const trimmed = prompt.trimEnd();
  return trimmed ? `${trimmed}\n\n${addition}` : addition;
}

function compactText(value: string, max: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, Math.max(0, max - 3))}...` : compact;
}
