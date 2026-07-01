import { describe, expect, it } from "vitest";

import { buildPromptContextFromIds } from "./hyperframe-gallery-workspace";

describe("hyperframe gallery workspace helpers", () => {
  it("preserves placement intent for selected materializable components", () => {
    const context = buildPromptContextFromIds({
      exampleIds: [],
      componentIds: ["app-showcase"],
      componentPlacementIntents: {
        "app-showcase": "Use this as the opening scene.",
      },
    });

    expect(context.components).toHaveLength(1);
    expect(context.components[0]?.materialization).toMatchObject({
      state: "materializable",
      componentId: "app-showcase",
      placementIntent: "Use this as the opening scene.",
    });
  });

  it("preserves in-progress placement whitespace while typing", () => {
    const context = buildPromptContextFromIds({
      exampleIds: [],
      componentIds: ["app-showcase"],
      componentPlacementIntents: {
        "app-showcase": "Opening scene ",
      },
    });

    expect(context.components[0]?.materialization).toMatchObject({
      state: "materializable",
      componentId: "app-showcase",
      placementIntent: "Opening scene ",
    });
  });
});
