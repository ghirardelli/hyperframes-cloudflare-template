import { describe, expect, it } from "vitest";

import { normalizeProjectPath } from "./project-paths";

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
});
