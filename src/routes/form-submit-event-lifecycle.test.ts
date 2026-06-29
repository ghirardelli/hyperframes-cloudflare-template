import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const formRoutes = ["admin.tsx", "profile.tsx"];

describe("form submit handlers", () => {
  it("do not reset forms through React event.currentTarget after async work", () => {
    for (const route of formRoutes) {
      const source = readFileSync(join(process.cwd(), "src/routes", route), "utf8");

      expect(source).not.toMatch(/await[\s\S]*event\.currentTarget\.reset\(\)/);
    }
  });
});
