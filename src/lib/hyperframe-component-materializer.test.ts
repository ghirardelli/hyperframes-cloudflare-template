import { describe, expect, it } from "vitest";

import {
  MATERIALIZED_COMPONENT_MANIFEST_PATH,
  materializeTrustedHyperframeComponents,
} from "./hyperframe-component-materializer";

const hostHtml = `<!doctype html>
<html>
  <head><title>Host</title></head>
  <body>
    <main data-composition-id="host" data-width="1920" data-height="1080"></main>
  </body>
</html>`;

describe("hyperframe component materializer", () => {
  it("copies trusted App Showcase files and injects a bounded host snippet", () => {
    const result = materializeTrustedHyperframeComponents({
      indexHtml: hostHtml,
      actor: { id: "user-1", type: "user" },
      materializedAt: "2026-06-30T12:00:00.000Z",
      placements: [
        {
          componentId: "app-showcase",
          startSec: 0,
          durationSec: 5.5,
          trackIndex: 1,
          width: 1920,
          height: 1080,
          placementNote: "Open the video with the trusted app showcase block.",
        },
      ],
    });

    expect(result.files).toEqual([
      expect.objectContaining({
        path: "compositions/app-showcase.html",
        contentHash: "sha256:226f722506968b574d84d19bee000aa0601819311971dea398db06b86a94fe8b",
      }),
      expect.objectContaining({
        path: MATERIALIZED_COMPONENT_MANIFEST_PATH,
      }),
    ]);
    expect(result.files[0]?.content).toContain("hyperframes-registry-item: app-showcase");
    expect(result.indexHtml).toContain("hyperframes-materialized-component:app-showcase:begin");
    expect(result.indexHtml).toContain('data-composition-id="app-showcase"');
    expect(result.indexHtml).toContain('data-composition-src="compositions/app-showcase.html"');
    expect(result.indexHtml).toContain('data-start="0"');
    expect(result.indexHtml).toContain('data-duration="5.5"');
    expect(result.indexHtml).toContain('data-track-index="1"');
    expect(result.manifest.components[0]).toMatchObject({
      componentId: "app-showcase",
      installedPaths: ["compositions/app-showcase.html"],
      source: expect.objectContaining({ packageName: "hyperframes" }),
      placements: [
        expect.objectContaining({
          startSec: 0,
          durationSec: 5.5,
          trackIndex: 1,
        }),
      ],
    });
  });

  it("updates existing materialized snippets without duplicating them", () => {
    const first = materializeTrustedHyperframeComponents({
      indexHtml: hostHtml,
      actor: { id: "agent", type: "agent" },
      materializedAt: "2026-06-30T12:00:00.000Z",
      placements: [{ componentId: "app-showcase", startSec: 0, trackIndex: 1 }],
    });
    const second = materializeTrustedHyperframeComponents({
      indexHtml: first.indexHtml,
      actor: { id: "agent", type: "agent" },
      materializedAt: "2026-06-30T12:01:00.000Z",
      placements: [{ componentId: "app-showcase", startSec: 4, trackIndex: 2 }],
    });

    expect(second.indexHtml.match(/data-composition-id="app-showcase"/g)).toHaveLength(1);
    expect(second.indexHtml).toContain('data-start="4"');
    expect(second.indexHtml).toContain('data-track-index="2"');
  });

  it("rejects invalid component ids, unsafe trusted paths, and arbitrary component HTML input", () => {
    expect(() =>
      materializeTrustedHyperframeComponents({
        indexHtml: hostHtml,
        actor: { id: "user-1", type: "user" },
        placements: [{ componentId: "missing-block", startSec: 0 }],
      }),
    ).toThrow(/not materializable/);

    expect(() =>
      materializeTrustedHyperframeComponents({
        indexHtml: hostHtml,
        actor: { id: "user-1", type: "user" },
        placements: [
          {
            componentId: "app-showcase",
            startSec: 0,
            componentHtml: "<!doctype html><p>model invented this</p>",
          },
        ],
      } as unknown),
    ).toThrow(/unrecognized key/i);
  });
});
