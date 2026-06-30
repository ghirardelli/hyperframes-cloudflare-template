import { describe, expect, it } from "vitest";

import {
  PROJECTS_PAGE_MAIN_CLASS,
  PROJECTS_PAGE_SHELL_CLASS,
  PROJECTS_PRIMARY_ACTION_CLASS,
} from "./projects-page-layout";

describe("projects page layout classes", () => {
  it("keeps the header fixed while the project grid scrolls vertically", () => {
    expect(PROJECTS_PAGE_SHELL_CLASS).toContain("h-dvh");
    expect(PROJECTS_PAGE_SHELL_CLASS).toContain("overflow-hidden");
    expect(PROJECTS_PAGE_MAIN_CLASS).toContain("min-h-0");
    expect(PROJECTS_PAGE_MAIN_CLASS).toContain("overflow-y-auto");
  });

  it("keeps dark primary project actions readable", () => {
    expect(PROJECTS_PRIMARY_ACTION_CLASS).toContain("!text-primary-foreground");
  });
});
