import { describe, expect, it } from "vitest";

import { queryKeys } from "./query-keys";

describe("queryKeys", () => {
  it("keeps user/config/project keys stable and scoped", () => {
    expect(queryKeys.me()).toEqual(["motion-frames", "me"]);
    expect(queryKeys.config()).toEqual(["motion-frames", "config"]);
    expect(queryKeys.projects.list()).toEqual(["motion-frames", "projects", "list"]);
    expect(queryKeys.projects.renders("project-1")).toEqual([
      "motion-frames",
      "projects",
      "detail",
      "project-1",
      "renders",
    ]);
  });

  it("keeps admin, catalog, and workflow keys out of Studio-specific paths", () => {
    expect(queryKeys.admin.users()).toEqual(["motion-frames", "admin", "users"]);
    expect(queryKeys.catalog()).toEqual(["motion-frames", "catalog"]);
    expect(queryKeys.workflows.run("run-1")).toEqual([
      "motion-frames",
      "workflows",
      "run",
      "run-1",
    ]);
    expect(queryKeys.workflows.stages("run-1")).toEqual([
      "motion-frames",
      "workflows",
      "run",
      "run-1",
      "stages",
    ]);
    expect(queryKeys.workflows.artifact("run-1", "DESIGN.md")).toEqual([
      "motion-frames",
      "workflows",
      "run",
      "run-1",
      "stages",
      "artifact",
      "DESIGN.md",
    ]);
  });
});
