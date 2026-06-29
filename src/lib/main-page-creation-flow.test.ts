import { describe, expect, it } from "vitest";

import {
  CREATION_MODE_STORAGE_KEY,
  buildRenderRequestBody,
  getExportResolutionPreset,
  normalizeDurationSec,
  readStoredCreationMode,
  resolveCreationMode,
  writeStoredCreationMode,
} from "./main-page-creation-flow";

class MemoryStorage {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("main page creation flow helpers", () => {
  it("persists and restores valid creation modes", () => {
    const storage = new MemoryStorage();

    writeStoredCreationMode("manual", storage);

    expect(storage.values.get(CREATION_MODE_STORAGE_KEY)).toBe("manual");
    expect(readStoredCreationMode(storage)).toBe("manual");
  });

  it("ignores invalid stored creation modes and falls back when AI is unavailable", () => {
    const storage = new MemoryStorage();
    storage.setItem(CREATION_MODE_STORAGE_KEY, "sideways");

    expect(readStoredCreationMode(storage)).toBeNull();
    expect(resolveCreationMode("agent", false)).toBe("manual");
    expect(resolveCreationMode(null, true)).toBe("agent");
  });

  it("normalizes duration into the generation-supported range", () => {
    expect(normalizeDurationSec("8")).toBe(8);
    expect(normalizeDurationSec(0)).toBe(1);
    expect(normalizeDurationSec(999)).toBe(120);
    expect(normalizeDurationSec("not a number", 10)).toBe(10);
  });

  it("builds render request bodies from export presets and format", () => {
    expect(
      buildRenderRequestBody({
        html: "<html></html>",
        projectId: "project-1",
        resolutionId: "4k",
        format: "webm",
      }),
    ).toEqual({
      html: "<html></html>",
      projectId: "project-1",
      width: 3840,
      height: 2160,
      format: "webm",
    });
  });

  it("falls back to 1080p when a resolution id is unexpected", () => {
    expect(getExportResolutionPreset("custom" as never)).toMatchObject({
      id: "1080p",
      width: 1920,
      height: 1080,
    });
  });
});
