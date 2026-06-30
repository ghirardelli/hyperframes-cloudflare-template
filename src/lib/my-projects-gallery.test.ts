import { describe, expect, it } from "vitest";

import {
  buildProjectLibraryItems,
  formatProjectDuration,
  getProjectTileClassName,
} from "./my-projects-gallery";

describe("my projects gallery helpers", () => {
  it("builds project cards with studio URLs and latest render metadata", () => {
    const items = buildProjectLibraryItems(
      [
        {
          id: "project-1",
          title: "Launch Reel",
          description: "Short product launch cut",
          durationSec: 75,
          updatedAt: "2026-06-30T12:34:00Z",
        },
      ],
      {
        "project-1": [
          {
            id: "render-1",
            url: "/api/renders/render-1",
            format: "mp4",
            createdAt: "2026-06-30T12:40:00Z",
          },
        ],
      },
    );

    expect(items).toEqual([
      expect.objectContaining({
        id: "project-1",
        title: "Launch Reel",
        description: "Short product launch cut",
        durationLabel: "1.3m",
        studioUrl: "/projects/project-1/studio",
        latestRender: expect.objectContaining({
          id: "render-1",
          url: "/api/renders/render-1",
        }),
      }),
    ]);
  });

  it("falls back cleanly when a project has no description or render", () => {
    const items = buildProjectLibraryItems([
      {
        id: "project-2",
        title: "",
        description: null,
        durationSec: 6,
        updatedAt: null,
      },
    ]);

    expect(items[0]).toMatchObject({
      title: "Untitled project",
      description: null,
      durationLabel: "6s",
      latestRender: null,
      studioUrl: "/projects/project-2/studio",
    });
  });

  it("provides stable bento tile classes", () => {
    expect(getProjectTileClassName(0)).toContain("md:col-span-2");
    expect(getProjectTileClassName(1)).toContain("min-h-[22rem]");
    expect(formatProjectDuration(300)).toBe("5m");
  });
});
