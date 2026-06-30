import { describe, expect, it } from "vitest";

import {
  buildGalleryPromptText,
  createSelectedComponentItem,
  listGalleryComponents,
} from "./hyperframe-gallery-catalog";
import {
  getComponentMaterializationState,
  listMaterializableHyperframeComponents,
} from "./hyperframe-component-registry";
import {
  getTrustedMaterializableHyperframeComponent,
  validateTrustedHyperframeComponentRegistry,
} from "./hyperframe-component-registry-server";

describe("hyperframe component registry", () => {
  it("marks App Showcase as materializable with trusted metadata and file hashes", () => {
    const appShowcase = getTrustedMaterializableHyperframeComponent("app-showcase");

    expect(appShowcase).toMatchObject({
      id: "app-showcase",
      canonicalSnippet: expect.stringContaining('data-composition-src="compositions/app-showcase.html"'),
      durationSec: 5.5,
      width: 1920,
      height: 1080,
      installCommand: "npx hyperframes add app-showcase",
    });
    expect(appShowcase?.source.url).toContain("github.com/heygen-com/hyperframes");
    expect(appShowcase?.source.packageName).toBe("hyperframes");
    expect(appShowcase?.files).toEqual([
      expect.objectContaining({
        path: "compositions/app-showcase.html",
        contentHash: "sha256:226f722506968b574d84d19bee000aa0601819311971dea398db06b86a94fe8b",
      }),
    ]);
    expect(appShowcase?.files[0]?.content).toContain("hyperframes-registry-item: app-showcase");
    expect(appShowcase?.files[0]?.content).not.toContain("/Users/");
    expect(appShowcase?.files[0]?.content).not.toContain("github_pat_");
    expect(validateTrustedHyperframeComponentRegistry()).toEqual({ ok: true, componentCount: 1 });
  });

  it("exposes materialization state in selected context without exposing component internals", () => {
    const components = listGalleryComponents();
    const appShowcase = components.find((component) => component.id === "app-showcase");
    const promptOnly = components.find((component) => component.id !== "app-showcase");

    expect(appShowcase).toBeTruthy();
    expect(promptOnly).toBeTruthy();

    const selectedAppShowcase = createSelectedComponentItem(appShowcase!);
    const selectedPromptOnly = createSelectedComponentItem(promptOnly!);

    expect(getComponentMaterializationState(appShowcase!)).toMatchObject({
      state: "materializable",
      componentId: "app-showcase",
      canonicalSnippet: expect.stringContaining("app-showcase"),
    });
    expect(selectedAppShowcase.materialization).toMatchObject({
      state: "materializable",
      componentId: "app-showcase",
      source: expect.objectContaining({ packageName: "hyperframes" }),
    });
    expect(JSON.stringify(selectedAppShowcase.materialization)).not.toContain("<!doctype html>");
    expect(selectedPromptOnly.materialization).toEqual({ state: "prompt-only" });
    expect(listMaterializableHyperframeComponents().map((component) => component.id)).toEqual([
      "app-showcase",
    ]);
  });

  it("adds trusted-component instructions to prompt text without asking users to invent internals", () => {
    const appShowcase = listGalleryComponents().find((component) => component.id === "app-showcase")!;
    const prompt = buildGalleryPromptText({
      examples: [],
      components: [createSelectedComponentItem(appShowcase)],
    });

    expect(prompt).toContain("Trusted HyperFrames component: app-showcase");
    expect(prompt).toContain('data-composition-src="compositions/app-showcase.html"');
    expect(prompt).toContain("Do not recreate");
    expect(prompt).not.toContain("<!doctype html>");
  });
});
