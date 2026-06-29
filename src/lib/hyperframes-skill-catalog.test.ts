import { describe, expect, it } from "vitest";

import {
  assertNoCatalogCredentialLeaks,
  findMissingRequiredHyperframesSkills,
  getHyperframesSkillCatalog,
  listHyperframesSkillCatalog,
  loadHyperframesSkill,
  routeHyperframesWorkflow,
} from "./hyperframes-skill-catalog";

describe("hyperframes skill catalog", () => {
  it("validates the generated private-fork catalog and required skills", () => {
    const catalog = getHyperframesSkillCatalog();

    expect(catalog.source.repoUrl).toBe("https://github.com/aaronpie/hyperframes.git");
    expect(catalog.source.commitSha).toMatch(/^[a-f0-9]{40}$/);
    expect(findMissingRequiredHyperframesSkills(catalog)).toEqual([]);
    expect(catalog.skills.map((skill) => skill.id)).toEqual(
      expect.arrayContaining([
        "hyperframes",
        "hyperframes-core",
        "hyperframes-animation",
        "hyperframes-creative",
        "website-to-video",
        "product-launch-video",
      ]),
    );
  });

  it("detects missing required skills and credential-like material", () => {
    const catalog = getHyperframesSkillCatalog();
    const withoutWebsite = {
      skills: catalog.skills.filter((skill) => skill.id !== "website-to-video"),
    };

    expect(findMissingRequiredHyperframesSkills(withoutWebsite)).toContain("website-to-video");
    expect(() =>
      assertNoCatalogCredentialLeaks({
        source: { repoUrl: "https://ghp_secret@github.com/aaronpie/hyperframes.git" },
      }),
    ).toThrow(/credential-like/);
  });

  it("groups skills for compact list output and bounded markdown loading", () => {
    const list = listHyperframesSkillCatalog();

    expect(list.groups.router.map((skill) => skill.id)).toContain("hyperframes");
    expect(list.groups.workflow.map((skill) => skill.id)).toEqual(
      expect.arrayContaining(["website-to-video", "product-launch-video"]),
    );
    expect(JSON.stringify(list)).not.toContain("# Website to Video");

    const loaded = loadHyperframesSkill({ skillId: "/website-to-video", maxChars: 500 });
    expect(loaded.found).toBe(true);
    if (loaded.found) {
      expect(loaded.skillId).toBe("website-to-video");
      expect(loaded.returnedChars).toBeLessThanOrEqual(500);
      expect(loaded.truncated).toBe(true);
      expect(loaded.referenceIndex.map((reference) => reference.path)).toContain(
        "references/step-0-capture.md",
      );
    }

    const missing = loadHyperframesSkill({ skillId: "not-real" });
    expect(missing).toMatchObject({ found: false, skillId: "not-real" });
  });

  it("routes website, product, faceless, motion, and non-video requests", () => {
    expect(
      routeHyperframesWorkflow({
        message: "Turn this product launch URL into a polished video: https://example.com.",
      }),
    ).toMatchObject({
      shouldLoadSkills: true,
      workflowId: "product-launch-video",
      fullPipelineAvailable: false,
      requiresWorkflowRunner: true,
    });

    const website = routeHyperframesWorkflow({
      message: "Make a website-to-video showcase from https://example.com.",
    });
    expect(website.workflowId).toBe("website-to-video");
    expect(website.fullPipelineAvailable).toBe(false);
    expect(website.capabilityNotice).toContain("no website capture");
    expect(website.capabilityNotice).toContain("STORYBOARD.md");
    expect(website.loadSkillIds).toEqual(
      expect.arrayContaining([
        "hyperframes",
        "website-to-video",
        "hyperframes-core",
        "hyperframes-animation",
        "hyperframes-creative",
      ]),
    );

    expect(
      routeHyperframesWorkflow({ message: "Create a faceless explainer about clean energy." }),
    ).toMatchObject({ workflowId: "faceless-explainer", fullPipelineAvailable: false });

    expect(
      routeHyperframesWorkflow({ message: "Create a kinetic logo reveal motion graphic." }),
    ).toMatchObject({ workflowId: "motion-graphics", fullPipelineAvailable: true });

    expect(
      routeHyperframesWorkflow({ message: "Please tighten this paragraph." }),
    ).toMatchObject({
      shouldLoadSkills: false,
      workflowId: null,
    });
  });
});
