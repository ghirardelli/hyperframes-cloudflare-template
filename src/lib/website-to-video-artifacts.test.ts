import { describe, expect, it } from "vitest";

import {
  composeWebsiteToVideoArtifacts,
  normalizeCaptureSummary,
  validateWorkspaceFiles,
} from "./website-to-video-artifacts";

describe("website-to-video artifact composition", () => {
  it("normalizes capture output into bounded model context", () => {
    const summary = normalizeCaptureSummary({
      url: "https://example.com",
      title: "Example Product",
      description: "A useful product",
      text: "Hero ".repeat(2000),
      screenshots: [
        { path: "screenshots/home.png", width: 1440, height: 1200 },
      ],
      assets: [
        { path: "assets/logo.png", contentType: "image/png", size: 123 },
      ],
    });

    expect(summary.url).toBe("https://example.com/");
    expect(summary.title).toBe("Example Product");
    expect(summary.text.length).toBeLessThanOrEqual(4_000);
    expect(summary.screenshots).toHaveLength(1);
    expect(summary.assets).toHaveLength(1);
  });

  it("generates required first-pass workflow files and honest skipped steps", () => {
    const output = composeWebsiteToVideoArtifacts({
      runId: "run-1",
      sourceUrl: "https://example.com",
      durationSec: 8,
      capture: normalizeCaptureSummary({
        url: "https://example.com",
        title: "Example Product",
        description: "The fastest way to understand a product.",
        text: "Hero, features, proof, call to action.",
      }),
      skillRevision: "abc123",
    });

    const paths = output.files.map((file) => file.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "DESIGN.md",
        "SCRIPT.md",
        "STORYBOARD.md",
        "index.html",
      ]),
    );
    expect(output.files.find((file) => file.path === "DESIGN.md")?.content).toContain(
      "Example Product",
    );
    expect(output.skippedSteps.map((step) => step.id)).toEqual(
      expect.arrayContaining(["voice", "timing", "final-render"]),
    );
  });

  it("validates required files, path safety, and artifact byte limits", () => {
    const valid = [
      { path: "DESIGN.md", content: "# Design", contentType: "text/markdown; charset=utf-8" },
      { path: "SCRIPT.md", content: "# Script", contentType: "text/markdown; charset=utf-8" },
      { path: "STORYBOARD.md", content: "# Storyboard", contentType: "text/markdown; charset=utf-8" },
      { path: "index.html", content: "<!doctype html><title>Video</title>", contentType: "text/html; charset=utf-8" },
    ];

    expect(validateWorkspaceFiles(valid, { maxFiles: 8, maxArtifactBytes: 4_000 })).toMatchObject({
      ok: true,
    });
    expect(
      validateWorkspaceFiles(valid.filter((file) => file.path !== "SCRIPT.md"), {
        maxFiles: 8,
        maxArtifactBytes: 4_000,
      }),
    ).toMatchObject({ ok: false, reason: expect.stringContaining("SCRIPT.md") });
    expect(
      validateWorkspaceFiles([{ path: "../secret.txt", content: "x", contentType: "text/plain" }, ...valid], {
        maxFiles: 8,
        maxArtifactBytes: 4_000,
      }),
    ).toMatchObject({ ok: false, reason: expect.stringContaining("invalid path") });
  });
});
