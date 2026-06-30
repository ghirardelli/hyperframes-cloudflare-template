import { describe, expect, it } from "vitest";

import {
  appendGalleryPromptText,
  assertNoGalleryCredentialLeaks,
  buildGalleryPromptText,
  countSelectedGalleryItems,
  createSelectedComponentItem,
  createSelectedExampleItem,
  filterGalleryComponents,
  GALLERY_COMPONENT_SELECTION_LIMIT,
  GALLERY_EXAMPLE_SELECTION_LIMIT,
  getHyperframeGalleryCatalog,
  listGalleryComponentCategories,
  listGalleryComponents,
  listGalleryExamples,
  normalizeSelectedGalleryPromptContext,
  removeGallerySelectionId,
  summarizeSelectedGalleryContext,
  toggleGallerySelectionId,
} from "./hyperframe-gallery-catalog";

describe("hyperframe gallery catalog", () => {
  it("validates generated source-backed examples and components", () => {
    const catalog = getHyperframeGalleryCatalog();

    expect(catalog.sources.map((source) => source.id)).toEqual(
      expect.arrayContaining([
        "hyperframes-launches",
        "hyperframes-catalog-index",
        "catalog-page-code-3d-extrude",
      ]),
    );
    expect(catalog.examples[0]).toMatchObject({
      sourceKind: "launch-folder",
      width: 1920,
      height: 1080,
      sourceUrl: expect.stringContaining("https://github.com/heygen-com/hyperframes-launches"),
      previewMedia: expect.objectContaining({ src: expect.any(String) }),
    });
    expect(new Set(catalog.examples.map((example) => example.previewMedia.src)).size).toBeGreaterThan(1);
    expect(catalog.components.map((component) => component.id)).toEqual(
      expect.arrayContaining(["code-3d-extrude", "caption-neon-glow"]),
    );
    expect(JSON.stringify(catalog)).not.toContain("/Users/");
    expect(JSON.stringify(catalog)).not.toContain("github_pat_");
  });

  it("groups components and creates selected prompt context", () => {
    const examples = listGalleryExamples();
    const components = listGalleryComponents();
    const categories = listGalleryComponentCategories();
    const codeExtrude = components.find((component) => component.id === "code-3d-extrude");

    expect(examples.length).toBeGreaterThan(1);
    expect(categories.map((item) => item.category)).toEqual(
      expect.arrayContaining(["Captions", "Code"]),
    );
    expect(filterGalleryComponents(components, "Captions").every((item) => item.category === "Captions")).toBe(true);
    expect(codeExtrude).toBeTruthy();
    expect(codeExtrude?.usageSnippet).toContain("data-composition-id");

    const launchExample =
      examples.find((example) => example.id === "hyperframes-launch") ?? examples[0];
    const context = {
      examples: [createSelectedExampleItem(launchExample)],
      components: [createSelectedComponentItem(codeExtrude!)],
    };
    const promptText = buildGalleryPromptText(context);

    expect(promptText).toContain(launchExample.title);
    expect(promptText).toContain("Code 3D Extrude");
    expect(countSelectedGalleryItems(context)).toBe(2);
    expect(summarizeSelectedGalleryContext(context)).toBe("1 example + 1 component");
    expect(promptText.length).toBeLessThan(1_200);
  });

  it("normalizes invalid selection context and appends without deleting prompt text", () => {
    expect(normalizeSelectedGalleryPromptContext({ components: "nope" })).toEqual({
      examples: [],
      components: [],
    });

    const component = listGalleryComponents().find(
      (item) => item.id === "caption-neon-glow",
    )!;
    const next = appendGalleryPromptText("Keep my existing opener.", {
      examples: [],
      components: [createSelectedComponentItem(component)],
    });

    expect(next).toContain("Keep my existing opener.");
    expect(next).toContain("Neon Glow");
  });

  it("toggles bounded selection ids and removes selected items", () => {
    const exampleIds = Array.from(
      { length: GALLERY_EXAMPLE_SELECTION_LIMIT + 2 },
      (_, index) => `example-${index}`,
    ).reduce<Array<string>>(
      (current, id) => toggleGallerySelectionId(current, id, GALLERY_EXAMPLE_SELECTION_LIMIT),
      [],
    );

    expect(exampleIds).toHaveLength(GALLERY_EXAMPLE_SELECTION_LIMIT);
    expect(exampleIds[0]).toBe("example-2");
    expect(toggleGallerySelectionId(exampleIds, "example-4", GALLERY_EXAMPLE_SELECTION_LIMIT)).not.toContain("example-4");

    const componentIds = ["code-3d-extrude", "caption-neon-glow"];
    expect(removeGallerySelectionId(componentIds, "code-3d-extrude")).toEqual([
      "caption-neon-glow",
    ]);
    expect(GALLERY_COMPONENT_SELECTION_LIMIT).toBeGreaterThan(componentIds.length);
  });

  it("detects credential-like material", () => {
    expect(() =>
      assertNoGalleryCredentialLeaks({
        source: "https://ghp_secret@github.com/heygen-com/hyperframes-launch-video.git",
      }),
    ).toThrow(/credential-like/);
  });
});
