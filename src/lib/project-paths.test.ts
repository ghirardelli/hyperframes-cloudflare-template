import { describe, expect, it } from "vitest";

import { promptAgentAssetPath, sanitizeAssetFilename, normalizeProjectPath } from "./project-paths";

describe("project path normalization", () => {
  it("accepts POSIX relative paths", () => {
    expect(normalizeProjectPath("assets/logo.png")).toBe("assets/logo.png");
    expect(normalizeProjectPath("compositions/intro.html")).toBe("compositions/intro.html");
  });

  it("rejects traversal, absolute paths, empty segments, and reserved prefixes", () => {
    expect(() => normalizeProjectPath("/assets/logo.png")).toThrow(/absolute/);
    expect(() => normalizeProjectPath("../secret")).toThrow(/traversal/);
    expect(() => normalizeProjectPath("assets//logo.png")).toThrow(/traversal/);
    expect(() => normalizeProjectPath("versions/old.html")).toThrow(/reserved/);
  });

  it("sanitizes prompt-agent asset filenames into stable ASCII names", () => {
    expect(sanitizeAssetFilename(" Logo Final!.PNG ")).toBe("logo-final.png");
    expect(sanitizeAssetFilename("../hero shot@2x.webp")).toBe("hero-shot-2x.webp");
    expect(sanitizeAssetFilename(".env")).toBe("asset.env");
  });

  it("builds collision-free prompt-agent asset paths under assets", () => {
    expect(
      promptAgentAssetPath("Logo Final.png", [
        "assets/logo-final.png",
        "assets/logo-final-2.png",
      ]),
    ).toBe("assets/logo-final-3.png");
    expect(promptAgentAssetPath("Brand Mark.svg", [])).toBe("assets/brand-mark.svg");
  });
});
