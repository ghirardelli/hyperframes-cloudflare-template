import { describe, expect, it } from "vitest";

import {
  COMPONENT_FILTER_BUTTON_CLASS,
  COMPONENT_FILTER_ROW_CLASS,
  MAIN_PAGE_GRID_CLASS,
  SELECTED_CONTEXT_BOX_CLASS,
  SELECTED_CONTEXT_CHIP_CLASS,
} from "./main-page-layout";

describe("main page layout classes", () => {
  it("uses a 60/40 desktop grid and single-column mobile layout", () => {
    expect(MAIN_PAGE_GRID_CLASS).toContain("grid-cols-1");
    expect(MAIN_PAGE_GRID_CLASS).toContain("lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]");
    expect(MAIN_PAGE_GRID_CLASS).toContain("lg:h-[calc(100dvh_-_4rem)]");
    expect(MAIN_PAGE_GRID_CLASS).toContain("lg:min-h-0");
    expect(MAIN_PAGE_GRID_CLASS).toContain("lg:items-stretch");
  });

  it("wraps compact component filters without horizontal scrolling", () => {
    expect(COMPONENT_FILTER_ROW_CLASS).toContain("flex-wrap");
    expect(COMPONENT_FILTER_ROW_CLASS).not.toContain("overflow-x-auto");
    expect(COMPONENT_FILTER_BUTTON_CLASS).toContain("component-filter-button");
    expect(COMPONENT_FILTER_BUTTON_CLASS).toContain("max-w-full");
  });

  it("uses a colored selected-context treatment with readable chips", () => {
    expect(SELECTED_CONTEXT_BOX_CLASS).toContain("bg-emerald-50");
    expect(SELECTED_CONTEXT_BOX_CLASS).toContain("border-emerald-200");
    expect(SELECTED_CONTEXT_BOX_CLASS).toContain("max-h-56");
    expect(SELECTED_CONTEXT_BOX_CLASS).toContain("overflow-y-auto");
    expect(SELECTED_CONTEXT_BOX_CLASS).toContain("lg:max-h-[24dvh]");
    expect(SELECTED_CONTEXT_CHIP_CLASS).toContain("bg-white");
  });
});
